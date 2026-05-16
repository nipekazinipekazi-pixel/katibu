const express = require('express');
const initSqlJs = require('sql.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const MASTER_ADMIN_CODE = 'KX92-ROOT';
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

app.post('/api/upload', validateAccessCode, upload.single('chart'), (req, res) => {
  if (req.isAdmin) return res.status(403).json({ error: 'Admin accounts cannot upload charts.' });
  if (!req.file) return res.status(400).json({ error: 'No chart image uploaded.' });
  const uploadId = uuidv4();
  const analysis = generateAIAnalysis();
  queryRun('INSERT INTO uploads (id, access_code, filename, original_name, analysis_result) VALUES (?, ?, ?, ?, ?)',
    [uploadId, req.accessCode, req.file.filename, req.file.originalname, JSON.stringify(analysis)]);
  res.json({ id: uploadId, filename: req.file.filename, original_name: req.file.originalname, analysis });
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

// === AI Analysis Generator (Simulated) ===
function generateAIAnalysis() {
  const directions = ['bullish', 'bearish', 'sideways'];
  const direction = directions[Math.floor(Math.random() * 3)];
  const confidence = Math.floor(Math.random() * 31) + 65;
  let suggestedAction;
  if (direction === 'bullish') suggestedAction = Math.random() > 0.2 ? 'buy' : 'wait';
  else if (direction === 'bearish') suggestedAction = Math.random() > 0.2 ? 'sell' : 'wait';
  else suggestedAction = 'wait';
  const entryLow = (Math.random() * 100 + 1.05).toFixed(4);
  const entryHigh = (parseFloat(entryLow) + Math.random() * 0.002).toFixed(4);
  const stopLoss = direction === 'bullish' ? (parseFloat(entryLow) - Math.random() * 0.003).toFixed(4) : (parseFloat(entryHigh) + Math.random() * 0.003).toFixed(4);
  const takeProfit = direction === 'bullish' ? (parseFloat(entryHigh) + Math.random() * 0.005).toFixed(4) : (parseFloat(entryLow) - Math.random() * 0.005).toFixed(4);
  const next5minProb = Math.floor(Math.random() * 41) + 50;
  const reasoningOptions = {
    bullish: ['Price action shows higher highs and higher lows forming on the M5 chart, indicating strong bullish momentum. The 50 EMA is crossing above the 200 EMA with increasing volume.', 'Bullish engulfing candlestick pattern detected at key support level. RSI is showing bullish divergence with room to run before reaching overbought territory.', 'Strong breakout above resistance with above-average volume. Market structure suggests continuation of the uptrend with confluence from multiple timeframes.'],
    bearish: ['Price rejected at resistance level with a long upper wick, indicating selling pressure. MACD shows bearish crossover with increasing histogram momentum.', 'Bearish flag pattern confirmed on the M15 timeframe. Volume profile shows distribution at current levels, suggesting institutional selling.', 'Break below key support level with momentum. The 20 EMA has turned downward and price is trading below all major moving averages.'],
    sideways: ['Price consolidating within a tight range between support and resistance. RSI is hovering around 50 with no clear directional bias. Waiting for a breakout confirmation.', 'Low volatility environment with contracting Bollinger Bands. Volume declining, suggesting indecision in the market. Best to wait for a clear signal.', 'Multiple timeframe analysis shows conflicting signals. Higher timeframe is bullish but lower timeframe shows bearish pressure. No clear edge currently.'],
  };
  const reasoning = reasoningOptions[direction][Math.floor(Math.random() * 3)];
  return { market_direction: direction, confidence_percentage: confidence, suggested_action: suggestedAction, entry_zone: `${entryLow} - ${entryHigh}`, stop_loss: stopLoss, take_profit: takeProfit, next_5min_movement_probability: next5minProb, reasoning, analyzed_at: new Date().toISOString() };
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
