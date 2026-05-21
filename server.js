// === Theo Sign - Backend Server (Supabase Edition) ===
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const supabase = require('./lib/supabase');

const app = express();
const PORT = process.env.PORT || 8080;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = 'deepseek-chat';

// --- Setup ---
app.use(express.json());
app.use(express.static('public'));

// Ensure temp uploads directory for local dev
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// --- Multer for temporary file upload (before sending to Supabase Storage) ---
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

// --- Middleware: Validate Access Code (via Supabase) ---
async function validateAccessCode(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Access code required.' });
  const code = authHeader.replace('Bearer ', '').trim();

  // Check master admin code
  let masterCode;
  try { masterCode = await supabase.getSetting('master_code'); } catch (e) { masterCode = 'KX92-ROOT'; }
  if (code === (masterCode || 'KX92-ROOT')) {
    req.accessCode = code;
    req.isAdmin = true;
    return next();
  }

  try {
    const row = await supabase.findAccessCode(code);
    if (!row) return res.status(401).json({ error: 'Invalid access code.' });
    if (row.disabled) return res.status(403).json({ error: 'Access code is disabled.' });
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Access code has expired.' });
    }
    if (row.usage_limit >= 0 && row.usage_count >= row.usage_limit) {
      return res.status(403).json({ error: 'Access code usage limit reached.' });
    }
    req.accessCode = code;
    req.accessCodeData = row;
    req.isAdmin = false;
    next();
  } catch (err) {
    console.error('[Auth] Error:', err.message);
    return res.status(500).json({ error: 'Authentication service unavailable.' });
  }
}

// === API ROUTES ===

app.post('/api/auth/login', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Access code required.' });

  // Check master admin code
  let masterCode;
  try { masterCode = await supabase.getSetting('master_code'); } catch (e) { masterCode = 'KX92-ROOT'; }
  if (code === (masterCode || 'KX92-ROOT')) {
    return res.json({ role: 'admin', message: 'Admin access granted.' });
  }

  try {
    const row = await supabase.findAccessCode(code);
    if (!row) return res.status(401).json({ error: 'Invalid access code.' });
    if (row.disabled) return res.status(403).json({ error: 'Access code is disabled.' });
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Access code has expired.' });
    }
    if (row.usage_limit >= 0 && row.usage_count >= row.usage_limit) {
      return res.status(403).json({ error: 'Access code usage limit reached.' });
    }
    await supabase.incrementUsage(code);
    res.json({ role: 'user', message: 'Access granted.' });
  } catch (err) {
    console.error('[Login] Error:', err.message);
    res.status(500).json({ error: 'Login service unavailable.' });
  }
});

app.post('/api/upload', validateAccessCode, upload.single('chart'), async (req, res) => {
  if (req.isAdmin) return res.status(403).json({ error: 'Admin accounts cannot upload charts.' });
  if (!req.file) return res.status(400).json({ error: 'No chart image uploaded.' });

  try {
    const uploadId = uuidv4();
    const lang = req.body.lang || req.query.lang || 'en';
    const filePath = path.join(uploadsDir, req.file.filename);

    // Read file buffer for Supabase Storage upload
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = req.file.mimetype;

    // Upload image to Supabase Storage
    let storageInfo = { path: null, url: null };
    try {
      storageInfo = await supabase.uploadChartImage(fileBuffer, req.file.filename, mimeType);
    } catch (storageErr) {
      console.error('[Storage] Upload failed:', storageErr.message);
      // Continue without storage — analysis still works
    }

    // Generate analysis
    const analysis = await generateAIAnalysis(lang, filePath);

    // Save upload record to Supabase
    await supabase.createUpload({
      access_code: req.accessCode,
      filename: req.file.filename,
      original_name: req.file.originalname,
      storage_path: storageInfo.path,
      analysis_result: analysis,
    });

    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

    res.json({ id: uploadId, filename: req.file.filename, original_name: req.file.originalname, analysis });
  } catch (err) {
    console.error('[Upload] Error:', err.message);
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

app.get('/api/uploads', validateAccessCode, async (req, res) => {
  if (req.isAdmin) return res.status(403).json({ error: 'Use admin endpoints.' });
  try {
    const rows = await supabase.getUploadsByCode(req.accessCode);
    res.json(rows || []);
  } catch (err) {
    console.error('[Uploads] Error:', err.message);
    res.status(500).json({ error: 'Failed to load uploads.' });
  }
});

// === ADMIN ROUTES ===

app.get('/api/admin/codes', validateAccessCode, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  try {
    const codes = await supabase.getAllAccessCodes();
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/codes', validateAccessCode, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  const { code, usage_limit, expires_at } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required.' });
  try {
    await supabase.createAccessCode({ code, usage_limit: usage_limit ?? -1, expires_at: expires_at || null });
    res.json({ success: true, code });
  } catch (err) {
    if (err.message?.includes('duplicate') || err.code === '23505') {
      return res.status(409).json({ error: 'Code already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/codes/:code', validateAccessCode, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  const { disabled, usage_limit, expires_at } = req.body;
  const updates = {};
  if (disabled !== undefined) updates.disabled = disabled;
  if (usage_limit !== undefined) updates.usage_limit = usage_limit;
  if (expires_at !== undefined) updates.expires_at = expires_at;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update.' });
  try {
    await supabase.updateAccessCode(req.params.code, updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/codes/:code', validateAccessCode, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  try {
    await supabase.deleteAccessCode(req.params.code);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', validateAccessCode, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  try {
    const users = await supabase.getActiveUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/uploads', validateAccessCode, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  try {
    const rows = await supabase.getAllUploads();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/manual-analysis', validateAccessCode, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  const { access_code, pair, direction, confidence, entry_price, timeframe, expiry, reasoning } = req.body;
  if (!access_code || !pair || !direction) {
    return res.status(400).json({ error: 'access_code, pair, and direction are required.' });
  }
  const uploadId = uuidv4();
  const analysis = {
    signal_time: getUTCTimeString(),
    timezone: 'UTC',
    pair,
    expiry: expiry || '5 min',
    direction: direction.toUpperCase(),
    direction_emoji: direction.toUpperCase() === 'CALL' ? '🟢' : direction.toUpperCase() === 'PUT' ? '🔴' : '🟡',
    confidence: Math.min(99, Math.max(50, parseInt(confidence) || 75)),
    entry_price: entry_price || '—',
    timeframe: timeframe || 'M5',
    gales: {
      first: getUTCTimeString(5),
      second: getUTCTimeString(10),
      third: getUTCTimeString(15),
    },
    next_signal: getUTCTimeString(5),
    reasoning: reasoning || 'Manual analysis by admin.',
    analyzed_at: new Date().toISOString(),
    lang: 'en',
    is_manual: true,
  };
  try {
    await supabase.createUpload({
      access_code,
      filename: 'manual',
      original_name: 'manual-entry',
      storage_path: null,
      analysis_result: analysis,
    });
    res.json({ success: true, id: uploadId, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/analytics', validateAccessCode, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden.' });
  try {
    const analytics = await supabase.getAnalytics();
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Simulated Analysis Generator (fallback when DeepSeek API key is not set) ===
function generateSimulatedAnalysis(lang = 'en') {
  const isSwahili = lang === 'sw';
  const currentTime = getUTCTimeString();
  const gale5 = getUTCTimeString(5);
  const gale10 = getUTCTimeString(10);
  const gale15 = getUTCTimeString(15);
  const now = new Date();

  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const seed = (hour * 60 + minute) % 12;

  const pairs = ['EUR/USD', 'GBP/JPY', 'XAU/USD', 'BTC/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'EUR/JPY', 'USD/CAD', 'NZD/USD', 'USDCHF-OTC', 'EUR/USD-OTC'];
  const directions = ['CALL', 'PUT', 'HOLD', 'CALL', 'PUT', 'CALL'];
  const confidences = [65, 75, 80, 70, 85, 60, 78, 72, 88, 68, 82, 76];
  const prices = ['1.08450', '186.342', '2,342.10', '64,230', '1.2678', '149.56', '0.6745', '162.89', '1.3580', '0.6123', '0.8912', '1.0540'];
  const timeframes = ['M5', 'M1', 'M15', 'M5', 'M5', 'M1', 'M5', 'M15', 'M1', 'M5', 'M5', 'M15'];
  const reasons = isSwahili
    ? [
        'Muundo wa mishumaa tatu mfululizo za kijani unaonyesha nguvu ya kununua.',
        'RASI imefika katika eneo la kuuzwa zaidi (overbought), inatarajiwa kurejea chini.',
        'Mishumaa ya Doji kwenye kiwango cha support inaashiria mabadiliko ya trend.',
        'Kuvunja kwa kiwango cha resistance kwa nguvu, CALL imethibitishwa.',
        'Muundo wa marubozu mweusi unaonyesha shinikizo kubwa la kuuza.',
        'Kiwango cha support kimeshikilia mara tatu, inatarajiwa kurudi juu.',
        'MACD inaonesha msalaba wa dhahabu (golden cross) kwenye M5.',
        'Mstari wa Bollinger Bands umepanuka, volatility inaongezeka.',
        'Kiashiria cha RSI kiko kwenye 45, nafasi safi ya kuingia.',
        'Mitungi miwili (double bottom) imeundwa, CALL inapendekezwa.',
      ]
    : [
        'Three consecutive bullish candlesticks with higher lows indicate strong buying pressure. Price is respecting the upward trendline on M5.',
        'RSI has reached overbought territory at 72 with a bearish divergence. Expect a pullback to the nearest support level.',
        'Doji candlestick at major support level followed by a bullish engulfing pattern suggests a trend reversal to the upside.',
        'Strong breakout above the resistance level with above-average volume. The breakout is confirmed with a retest. CALL signal is validated.',
        'Marubozu black candlestick closing near session low indicates strong selling pressure. Lower highs forming on the 15-min chart.',
        'Triple bottom support holding firm at key level. Price rejected with long lower wicks. Bounce expected towards resistance.',
        'MACD golden cross on M5 timeframe with histogram turning positive. Momentum is shifting bullish.',
        'Bollinger Bands expanding after contraction period. Price breaking above upper band suggests strong bullish momentum.',
        'RSI at 45 with room to move in either direction. Price consolidating in a symmetrical triangle — awaiting breakout.',
        'Double bottom pattern completed with neckline breakout. Target measured move suggests 20-pips upside potential.',
      ];

  const idx = seed % pairs.length;
  const direction = directions[seed % directions.length];
  const directionEmoji = direction === 'CALL' ? '🟢' : direction === 'PUT' ? '🔴' : '🟡';
  const confidence = confidences[seed % confidences.length];
  const pair = pairs[idx];
  const entryPrice = prices[idx];
  const timeframe = timeframes[idx];
  const reasoning = reasons[seed % reasons.length];

  return {
    signal_time: currentTime,
    timezone: 'UTC',
    pair,
    expiry: '5 min',
    direction,
    direction_emoji: directionEmoji,
    confidence,
    entry_price: entryPrice,
    timeframe,
    gales: { first: gale5, second: gale10, third: gale15 },
    next_signal: gale5,
    reasoning,
    analyzed_at: now.toISOString(),
    lang,
    is_simulated: true,
  };
}

// === AI Analysis Generator (DeepSeek AI) ===
function callDeepSeek(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: messages,
      max_tokens: 300,
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

function getUTCTimeString(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

async function generateAIAnalysis(lang = 'en', imagePath = null) {
  // If no DeepSeek API key is set, use simulated analysis
  if (!DEEPSEEK_API_KEY) {
    console.log('No DEEPSEEK_API_KEY set. Using simulated analysis.');
    return generateSimulatedAnalysis(lang);
  }

  const isSwahili = lang === 'sw';
  const currentTime = getUTCTimeString();
  const gale5 = getUTCTimeString(5);
  const gale10 = getUTCTimeString(10);
  const gale15 = getUTCTimeString(15);
  
  const systemPrompt = isSwahili
    ? 'Wewe ni mchambuzi mtaalamu wa Forex na masoko ya fedha. Chambua CHATI HALISI iliyoambatishwa. Usibuni au kutengeneza data. Ikiwa huoni chati vizuri, rudisha HOLD na confidence 50. Rudisha JSON pekee, hakuna alama za ziada.'
    : 'You are an expert Forex chart analyst. You MUST analyze the ACTUAL chart image attached. Do NOT fabricate or invent data. If you cannot clearly see the chart, return HOLD with confidence 50. Return ONLY valid JSON with no markdown. CRITICAL: Base your analysis strictly on what you visually observe in the chart image.';
  
  let userMessages = [];
  
  const textContent = isSwahili
    ? `Chambua chati hii ya Forex. Wakati wa sasa: ${currentTime} UTC.

Angalia chati halisi na urudishe JSON hii:
{
  "pair": "jozi halisi la sarafu kwenye chati, mfano EUR/USD",
  "direction": "CALL (bei itapanda) au PUT (bei itashuka) au HOLD (si wazi)",
  "confidence": nambari 50-99 (hakikisha inaakisi uhakika wako halisi),
  "entry_price": "bei halisi ya kuingia inayoonekana kwenye chati",
  "timeframe": "M1, M5, au M15 (muda wa chati unaoonekana)",
  "reasoning": "uchambuzi wa kina kwa Kiswahili — eleza muundo wa mishumaa, support/resistance, RSI, au mienendo inayoonekana"
}

MUHIMU: Usibuni data. Ikiwa huoni chati vizuri, rudisha "direction": "HOLD", "confidence": 50.`
    : `Analyze this Forex chart screenshot for binary options trading.

Current UTC time: ${currentTime} UTC — Time fields will be set by the system.

INSTRUCTIONS:
1. Look CAREFULLY at the chart image attached
2. Identify what you actually see — candlestick patterns, trend direction, support/resistance levels, indicators
3. Be realistic — if the chart is unclear or you cannot see enough detail, return HOLD with confidence 50
4. DO NOT fabricate patterns that aren't there
5. DO NOT make up price levels — use what's actually visible

Return this JSON format ONLY:
{
  "pair": "the actual currency pair visible in the chart, e.g. EUR/USD, GBP/JPY, USDINR-OTC",
  "direction": "CALL (uptrend visible) or PUT (downtrend visible) or HOLD (unclear/neutral)",
  "confidence": number 50-99 (reflect your genuine certainty based on what you see),
  "entry_price": "the actual entry price visible on the chart, or '—' if unclear",
  "timeframe": "M1, M5, or M15 (the timeframe shown on the chart)",
  "reasoning": "specific technical analysis — describe actual candlestick patterns, trend lines, support/resistance zones, RSI levels, or price action you observe in THIS chart"
}

CRITICAL: Base your analysis ONLY on what is actually visible in the chart image. Do not invent data.`;
  
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const ext = path.extname(imagePath).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' ? 'jpeg' : ext;
      
      userMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${textContent}\n\nHere is the chart screenshot to analyze:\n![chart screenshot](data:image/${mimeType};base64,${base64Image})` }
      ];
    } catch (readErr) {
      console.error('Error reading image file:', readErr.message);
      userMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textContent }
      ];
    }
  } else {
    userMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: textContent }
    ];
  }
  
  try {
    const responseText = await callDeepSeek(userMessages);
    
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    
    const analysis = JSON.parse(jsonMatch[0]);
    const now = new Date();
    
    const direction = typeof analysis.direction === 'string' ? analysis.direction.toUpperCase() : 'HOLD';
    const directionEmoji = direction === 'CALL' ? '🟢' : direction === 'PUT' ? '🔴' : '🟡';
    
    return {
      signal_time: currentTime,
      timezone: 'UTC',
      pair: analysis.pair || 'EUR/USD',
      expiry: '5 min',
      direction: direction,
      direction_emoji: directionEmoji,
      confidence: Math.min(99, Math.max(50, parseInt(analysis.confidence) || 75)),
      entry_price: analysis.entry_price || '—',
      timeframe: analysis.timeframe || 'M5',
      gales: { first: gale5, second: gale10, third: gale15 },
      next_signal: gale5,
      reasoning: analysis.reasoning || (isSwahili ? 'Hakuna uchambuzi uliopatikana.' : 'No analysis available.'),
      analyzed_at: now.toISOString(),
      lang: lang
    };
  } catch (err) {
    console.error('DeepSeek analysis error:', err.message);
    console.log('Falling back to simulated analysis.');
    return generateSimulatedAnalysis(lang);
  }
}

// Serve the SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  // Test Supabase connection
  const connected = await supabase.testConnection();
  if (!connected) {
    console.warn('⚠️  Supabase connection failed. Check your SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  } else {
    // Ensure storage bucket exists
    await supabase.ensureStorageBucket();
  }

  app.listen(PORT, () => {
    console.log(`Theo Sign running on http://localhost:${PORT}`);
    console.log(`Supabase: ${connected ? '✅ Connected' : '❌ Not connected'}`);
    if (!DEEPSEEK_API_KEY) {
      console.log('⚠️  No DEEPSEEK_API_KEY set. Using simulated analysis mode.');
    }
  });
}

start();
