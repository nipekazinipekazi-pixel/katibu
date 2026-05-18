const express = require('express');
const initSqlJs = require('sql.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const MASTER_ADMIN_CODE = 'KX92-ROOT';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-fbb7008fec474bdaaee31971973fc796';
const DEEPSEEK_MODEL = 'deepseek-chat';
const DB_PATH = path.join(__dirname, 'theosign.db');

// --- Setup ---
app.use(express.json());
app.use(express.static('public'));

// Ensure uploads directory
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// --- SQLite Database (sql.js - pure JS, no native modules needed) ---
let db;

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('Error saving DB:', e.message);
  }
}

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (e) {
    console.error('Query error:', e.message, sql, params);
    return [];
  }
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function queryRun(sql, params = []) {
  try {
    db.run(sql, params);
    saveDb();
    return true;
  } catch (e) {
    console.error('Run error:', e.message, sql, params);
    throw e;
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();
  let buffer;
  try {
    buffer = fs.readFileSync(DB_PATH);
  } catch (e) {
    buffer = null;
  }
  db = buffer ? new SQL.Database(buffer) : new SQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS access_codes (
    code TEXT PRIMARY KEY, disabled INTEGER DEFAULT 0,
    usage_limit INTEGER DEFAULT -1, usage_count INTEGER DEFAULT 0,
    expires_at TEXT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY, access_code TEXT NOT NULL,
    filename TEXT NOT NULL, original_name TEXT NOT NULL,
    uploaded_at TEXT DEFAULT (datetime('now')), analysis_result TEXT NULL
  )`);
  const existing = queryAll('SELECT code FROM access_codes LIMIT 1');
  if (existing.length === 0) {
    queryRun("INSERT INTO access_codes (code, usage_limit) VALUES (?, ?)", ['DEMO-1234', 10]);
    queryRun("INSERT INTO access_codes (code, usage_limit) VALUES (?, ?)", ['TRADE-5678', 5]);
  }
  saveDb();
  console.log('Database initialized');
}

// --- Multer for screenshot uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only image files are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// --- Middleware: Validate Access Code ---
function validateAccessCode(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Access code required.' });
  const code = authHeader.replace('Bearer ', '').trim();
  if (code === MASTER_ADMIN_CODE) {
    req.accessCode = code; req.isAdmin = true; return next();
  }
  const row = queryOne('SELECT * FROM access_codes WHERE code = ?', [code]);
  if (!row) return res.status(401).json({ error: 'Invalid access code.' });
  if (row.disabled) return res.status(403).json({ error: 'Access code is disabled.' });
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(403).json({ error: 'Access code has expired.' });
  }
  if (row.usage_limit >= 0 && row.usage_count >= row.usage_limit) {
    return res.status(403).json({ error: 'Access code usage limit reached.' });
  }
  req.accessCode = code; req.accessCodeData = row; req.isAdmin = false;
  next();
}

// === API ROUTES ===

app.post('/api/auth/login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Access code required.' });
  if (code === MASTER_ADMIN_CODE) {
    return res.json({ role: 'admin', message: 'Admin access granted.' });
  }
  const row = queryOne('SELECT * FROM access_codes WHERE code = ?', [code]);
  if (!row) return res.status(401).json({ error: 'Invalid access code.' });
  if (row.disabled) return res.status(403).json({ error: 'Access code is disabled.' });
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(403).json({ error: 'Access code has expired.' });
  }
  if (row.usage_limit >= 0 && row.usage_count >= row.usage_limit) {
    return res.status(403).json({ error: 'Access code usage limit reached.' });
  }
  queryRun('UPDATE access_codes SET usage_count = usage_count + 1 WHERE code = ?', [code]);
  res.json({ role: 'user', message: 'Access granted.' });
});

app.post('/api/upload', validateAccessCode, upload.single('chart'), async (req, res) => {
  if (req.isAdmin) return res.status(403).json({ error: 'Admin accounts cannot upload charts.' });
  if (!req.file) return res.status(400).json({ error: 'No chart image uploaded.' });
  try {
    const uploadId = uuidv4();
    const lang = req.body.lang || req.query.lang || 'en';
    const analysis = await generateAIAnalysis(lang);
    queryRun('INSERT INTO uploads (id, access_code, filename, original_name, analysis_result) VALUES (?, ?, ?, ?, ?)',
      [uploadId, req.accessCode, req.file.filename, req.file.originalname, JSON.stringify(analysis)]);
    res.json({ id: uploadId, filename: req.file.filename, original_name: req.file.originalname, analysis });
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

app.get('/api/uploads', validateAccessCode, (req, res) => {
  if (req.isAdmin) return res.status(403).json({ error: 'Use admin endpoints.' });
  const rows = queryAll('SELECT * FROM uploads WHERE access_code = ? ORDER BY uploaded_at DESC', [req.accessCode]);
  res.json(rows.map((r) => ({ ...r, analysis_result: JSON.parse(r.analysis_result || '{}') })));
});

app.get('/api/uploads/:id', validateAccessCode, (req, res) => {
  if (req.isAdmin) return res.status(403).json({ error: 'Use admin endpoints.' });
  const row = queryOne('SELECT * FROM uploads WHERE id = ? AND access_code = ?', [req.params.id, req.accessCode]);
  if (!row) return res.status(404).json({ error: 'Upload not found.' });
  row.analysis_result = JSON.parse(row.analysis_result || '{}');
  res.json(row);
});

// === ADMIN ROUTES (Secret) ===

app.get('/api/admin/codes', validateAccessCode, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  res.json(queryAll('SELECT * FROM access_codes ORDER BY created_at DESC'));
});

app.post('/api/admin/codes', validateAccessCode, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  const { code, usage_limit, expires_at } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required.' });
  try {
    queryRun('INSERT INTO access_codes (code, usage_limit, expires_at) VALUES (?, ?, ?)',
      [code, usage_limit ?? -1, expires_at || null]);
    res.json({ success: true, code });
  } catch (e) { res.status(409).json({ error: 'Code already exists.' }); }
});

app.put('/api/admin/codes/:code', validateAccessCode, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  const { disabled, usage_limit, expires_at } = req.body;
  const updates = []; const params = [];
  if (disabled !== undefined) { updates.push('disabled = ?'); params.push(disabled ? 1 : 0); }
  if (usage_limit !== undefined) { updates.push('usage_limit = ?'); params.push(usage_limit); }
  if (expires_at !== undefined) { updates.push('expires_at = ?'); params.push(expires_at); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });
  params.push(req.params.code);
  queryRun(`UPDATE access_codes SET ${updates.join(', ')} WHERE code = ?`, params);
  res.json({ success: true });
});

app.delete('/api/admin/codes/:code', validateAccessCode, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  queryRun('DELETE FROM access_codes WHERE code = ?', [req.params.code]);
  queryRun('DELETE FROM uploads WHERE access_code = ?', [req.params.code]);
  res.json({ success: true });
});

app.get('/api/admin/users', validateAccessCode, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  const codes = queryAll('SELECT * FROM access_codes ORDER BY created_at DESC');
  const users = codes.map((c) => {
    const uc = queryOne('SELECT COUNT(*) as cnt FROM uploads WHERE access_code = ?', [c.code]);
    const la = queryOne('SELECT MAX(uploaded_at) as ma FROM uploads WHERE access_code = ?', [c.code]);
    return { ...c, upload_count: uc ? uc.cnt : 0, last_active: la ? la.ma : null };
  });
  res.json(users);
});

app.get('/api/admin/uploads', validateAccessCode, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  const rows = queryAll('SELECT * FROM uploads ORDER BY uploaded_at DESC');
  res.json(rows.map((r) => ({ ...r, analysis_result: JSON.parse(r.analysis_result || '{}') })));
});

app.get('/api/admin/analytics', validateAccessCode, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  const totalCodes = queryOne('SELECT COUNT(*) as count FROM access_codes').count;
  const activeCodes = queryOne("SELECT COUNT(*) as count FROM access_codes WHERE disabled = 0").count;
  const disabledCodes = queryOne("SELECT COUNT(*) as count FROM access_codes WHERE disabled = 1").count;
  const totalUploads = queryOne('SELECT COUNT(*) as count FROM uploads').count;
  const totalUsageResult = queryOne('SELECT SUM(usage_count) as total FROM access_codes');
  const totalUsage = totalUsageResult && totalUsageResult.total ? totalUsageResult.total : 0;
  const expiredResult = queryOne("SELECT COUNT(*) as count FROM access_codes WHERE expires_at IS NOT NULL AND expires_at < datetime('now')");
  res.json({ totalCodes, activeCodes, disabledCodes, totalUploads, totalUsage, expiredCodes: expiredResult ? expiredResult.count : 0 });
});

// === AI Analysis Generator (DeepSeek AI) ===
function callDeepSeek(prompt, systemPrompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt || 'You are an expert Forex and financial market analyst.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.choices[0].message.content.trim());
        } catch (e) {
          reject(new Error('Failed to parse DeepSeek response: ' + body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateAIAnalysis(lang = 'en') {
  const isSwahili = lang === 'sw';
  
  const systemPrompt = isSwahili
    ? 'Wewe ni mchambuzi mtaalamu wa Forex na masoko ya fedha. Toa ishara za biashara kwa muundo unaosomeka. Rudisha JSON pekee, hakuna alama za ziada.'
    : 'You are an expert Forex and financial market analyst. Provide trading signals in a clear format. Return only valid JSON, no markdown.';
  
  const userPrompt = isSwahili
    ? `Chambua chati hii ya Forex. Toa JSON ifuatayo:
{
  "pair": "JOZI ya sarafu kama EUR/USD",
  "direction": "CALL" au "PUT" au "HOLD",
  "confidence": asilimia 50-99,
  "entry_price": "bei ya kuingia",
  "timeframe": "M1, M5, M15",
  "expiry": "dakika 5",
  "signal_time": "saa ya sasa kwa UTC-3 kama 13:05",
  "timezone": "UTC -3",
  "gales": {
    "1st": "dakika 5",
    "2nd": "dakika 10",
    "3rd": "dakika 15"
  },
  "reasoning": "Maelezo ya uchambuzi wa kiufundi kwa Kiswahili"
}`

    : `Analyze this Forex chart and provide a trading signal. Return EXACTLY this JSON format:
{
  "pair": "currency pair like EUR/USD or USDINR-OTC",
  "direction": "CALL" or "PUT" or "HOLD",
  "confidence": number 50-99,
  "entry_price": "entry price level",
  "timeframe": "M1, M5, or M15",
  "expiry": "5 min",
  "signal_time": "current time in UTC-3 like 13:05",
  "timezone": "UTC -3",
  "gales": {
    "1st": "+5 min time like 13:10",
    "2nd": "+10 min time like 13:15",
    "3rd": "+15 min time like 13:20"
  },
  "reasoning": "detailed technical analysis in English"
}

Base analysis on: support/resistance, candlestick patterns, RSI, MACD, and price action. Be realistic.`;
  
  try {
    const responseText = await callDeepSeek(userPrompt, systemPrompt);
    
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    
    const analysis = JSON.parse(jsonMatch[0]);
    const now = new Date();
    
    // Calculate gale times in UTC-3
    const utcMinus3 = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const h = utcMinus3.getHours().toString().padStart(2, '0');
    const m = utcMinus3.getMinutes().toString().padStart(2, '0');
    const currentTime = `${h}:${m}`;
    
    const addMin = (min) => {
      const d = new Date(utcMinus3.getTime() + min * 60 * 1000);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };
    
    const direction = typeof analysis.direction === 'string' ? analysis.direction.toUpperCase() : 'HOLD';
    const directionEmoji = direction === 'CALL' ? '🟢' : direction === 'PUT' ? '🔴' : '🟡';
    
    return {
      signal_time: analysis.signal_time || currentTime,
      timezone: 'UTC -3',
      pair: analysis.pair || 'USDINR-OTC',
      expiry: '5 min',
      direction: direction,
      direction_emoji: directionEmoji,
      confidence: Math.min(99, Math.max(50, parseInt(analysis.confidence) || 75)),
      entry_price: analysis.entry_price || '—',
      timeframe: analysis.timeframe || 'M5',
      gales: {
        first: analysis.gales?.['1st'] || addMin(5),
        second: analysis.gales?.['2nd'] || addMin(10),
        third: analysis.gales?.['3rd'] || addMin(15),
      },
      next_signal: addMin(5),
      reasoning: analysis.reasoning || (isSwahili ? 'Hakuna uchambuzi uliopatikana.' : 'No analysis available.'),
      analyzed_at: now.toISOString(),
      lang: lang
    };
  } catch (err) {
    console.error('DeepSeek analysis error:', err.message);
    const now = new Date();
    const utcMinus3 = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const addMin = (min) => {
      const d = new Date(utcMinus3.getTime() + min * 60 * 1000);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };
    
    return {
      signal_time: `${utcMinus3.getHours().toString().padStart(2,'0')}:${utcMinus3.getMinutes().toString().padStart(2,'0')}`,
      timezone: 'UTC -3',
      pair: 'USDINR-OTC',
      expiry: '5 min',
      direction: 'HOLD',
      direction_emoji: '🟡',
      confidence: 50,
      entry_price: '—',
      timeframe: 'M5',
      gales: { first: addMin(5), second: addMin(10), third: addMin(15) },
      next_signal: addMin(5),
      reasoning: isSwahili ? 'Huduma ya uchambuzi haipatikani kwa sasa. Tafadhali jaribu tena.' : 'Analysis service temporarily unavailable. Please try again.',
      analyzed_at: now.toISOString(),
      lang: lang
    };
  }
}

// Serve the SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Theo Sign running on http://localhost:${PORT}`);
    console.log(`Demo codes: DEMO-1234, TRADE-5678`);
    console.log(`Master admin code is confidential.`);
  });
}
start();
