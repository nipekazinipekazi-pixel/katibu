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
    const analysis = await generateAIAnalysis();
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
function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert Forex and financial market analyst. Analyze the chart and provide trading insights in JSON format only. No markdown, no explanation, just valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
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

async function generateAIAnalysis() {
  try {
    const prompt = `Analyze this Forex chart for a trading opportunity. Provide a JSON response with EXACTLY these fields:
{
  "market_direction": "bullish" or "bearish" or "sideways",
  "confidence_percentage": number between 50-99,
  "suggested_action": "buy" or "sell" or "wait",
  "entry_zone": "a price range like 1.1050 - 1.1070",
  "stop_loss": "a price level like 1.1020",
  "take_profit": "a price level like 1.1120",
  "next_5min_movement_probability": number between 50-95,
  "reasoning": "detailed technical analysis explaining your decision"
}

Base your analysis on common Forex technical indicators: support/resistance levels, moving averages (50 EMA, 200 EMA), RSI, MACD, candlestick patterns, and market structure. Provide realistic forex price levels.`;

    const responseText = await callDeepSeek(prompt);
    
    // Try to extract JSON from response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Validate and fill defaults
    return {
      market_direction: ['bullish', 'bearish', 'sideways'].includes(analysis.market_direction) ? analysis.market_direction : 'sideways',
      confidence_percentage: Math.min(99, Math.max(50, analysis.confidence_percentage || 75)),
      suggested_action: ['buy', 'sell', 'wait'].includes(analysis.suggested_action) ? analysis.suggested_action : 'wait',
      entry_zone: analysis.entry_zone || '1.1000 - 1.1020',
      stop_loss: analysis.stop_loss || '1.0950',
      take_profit: analysis.take_profit || '1.1100',
      next_5min_movement_probability: Math.min(95, Math.max(50, typeof analysis.next_5min_movement_probability === 'object' ? (analysis.next_5min_movement_probability.up || 65) : (analysis.next_5min_movement_probability || 65))),
      reasoning: analysis.reasoning || 'Analysis completed successfully.',
      analyzed_at: new Date().toISOString()
    };
  } catch (err) {
    console.error('DeepSeek analysis error:', err.message);
    // Fallback analysis if API fails
    return {
      market_direction: 'sideways',
      confidence_percentage: 50,
      suggested_action: 'wait',
      entry_zone: '1.1000 - 1.1020',
      stop_loss: '1.0950',
      take_profit: '1.1100',
      next_5min_movement_probability: 55,
      reasoning: 'Analysis service temporarily unavailable. Showing default neutral analysis.',
      analyzed_at: new Date().toISOString()
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
