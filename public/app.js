// === Theo Sign - Frontend Application ===

const STATE = {
  currentView: 'hero',
  accessCode: null,
  isAdmin: false,
  selectedFile: null,
  currentAnalysis: null,
  uploads: [],
  adminCodes: [],
  adminUsers: [],
  adminUploads: [],
  adminAnalytics: null,
  lang: 'en',
  mobileMenuOpen: false,
};

const API_BASE = window.__API_BASE__ || '/api';

// === LANGUAGE SUPPORT (English only) ===
const LANG = {
  en: {
    appName: 'Theo Sign',
    tagline: 'AI-powered Forex market analysis. Upload MetaTrader 4 charts and receive probability-based trading insights.',
    enterCode: 'Enter Access Code',
    accessPlatform: 'Access Platform',
    authenticating: 'Authenticating...',
    pleaseEnterCode: 'Please enter an access code.',
    signOut: 'Sign Out',
    chartAnalysis: 'Chart Analysis',
    uploadDesc: 'Upload a MetaTrader 4 screenshot for AI-powered market analysis',
    dropHere: 'Drop your MT4 chart screenshot here or',
    browse: 'browse',
    supports: 'Supports PNG, JPG, JPEG, GIF, BMP, WEBP (max 10MB)',
    cancel: 'Cancel',
    analyzeChart: 'Analyze Chart',
    analyzing: 'Analyzing...',
    analysisHistory: 'Analysis History',
    noHistory: 'No analysis history yet. Upload a chart to get started.',
    signalCard: 'Signal Card',
    direction: 'Direction',
    confidence: 'Confidence',
    entryPrice: 'Entry Price',
    expiry: 'Expiry',
    signalTime: 'Signal Time',
    timezone: 'Timezone',
    pair: 'Pair',
    timeframe: 'Timeframe',
    gales: 'Gales',
    gale1: '1st Gale',
    gale2: '2nd Gale',
    gale3: '3rd Gale',
    nextSignal: 'Next Signal',
    reasoning: 'AI Reasoning',
    noReasoning: 'No reasoning available.',
    analysisComplete: 'Analysis complete!',
    failed: 'Analysis failed. Please try again.',
    sessionExpired: 'Session expired. Please log in again.',
    call: 'CALL',
    put: 'PUT',
    hold: 'HOLD',
    minutes: 'min',
    refresh: 'Refresh',
  },
};

function t(key) {
  return LANG[STATE.lang][key] || key;
}

// === UTILITIES ===
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showToast(message, type = 'info') {
  const existing = $('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateFull(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Convert UTC HH:MM string to local timezone HH:MM
function utcToLocal(utcTime) {
  if (!utcTime || !utcTime.includes(':')) return utcTime || '--:--';
  const [h, m] = utcTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return utcTime;
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  const lh = d.getHours().toString().padStart(2, '0');
  const lm = d.getMinutes().toString().padStart(2, '0');
  return `${lh}:${lm}`;
}

// --- Live Countdown Timer ---
const countdownIntervals = {};

// Get milliseconds until a UTC HH:MM time today
function msUntilUtcTime(utcTime) {
  if (!utcTime || !utcTime.includes(':')) return 0;
  const [h, m] = utcTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  const now = new Date();
  const target = new Date();
  target.setUTCHours(h, m, 0, 0);
  let diff = target.getTime() - now.getTime();
  // If target time has passed today, add 24h
  if (diff < 0) diff += 24 * 60 * 60 * 1000;
  return diff;
}

// Format milliseconds as MM:SS
function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const secs = (totalSec % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

// Start a live countdown that updates element text every second
function startCountdown(elementId, utcTime) {
  // Stop any existing countdown for this element
  if (countdownIntervals[elementId]) {
    clearInterval(countdownIntervals[elementId]);
  }
  
  const el = document.getElementById(elementId);
  if (!el) return;
  
  function tick() {
    const ms = msUntilUtcTime(utcTime);
    if (ms <= 1000) {
      el.textContent = 'EXPIRED ⏰';
      el.style.color = '#ef4444';
      if (countdownIntervals[elementId]) {
        clearInterval(countdownIntervals[elementId]);
        delete countdownIntervals[elementId];
      }
      return;
    }
    el.textContent = formatCountdown(ms);
  }
  
  tick();
  countdownIntervals[elementId] = setInterval(tick, 1000);
}

// Stop all running countdowns (call on navigation)
function stopAllCountdowns() {
  Object.keys(countdownIntervals).forEach((key) => {
    clearInterval(countdownIntervals[key]);
    delete countdownIntervals[key];
  });
  // Also stop the live clock
  stopLiveClock();
}

// --- Live Real-Time Clock ---
let liveClockInterval = null;

function startLiveClock(elementId) {
  // Stop any existing clock
  if (liveClockInterval) {
    clearInterval(liveClockInterval);
    liveClockInterval = null;
  }
  const el = document.getElementById(elementId);
  if (!el) return;

  function updateClock() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  }

  updateClock();
  liveClockInterval = setInterval(updateClock, 1000);
}

function stopLiveClock() {
  if (liveClockInterval) {
    clearInterval(liveClockInterval);
    liveClockInterval = null;
  }
}

const CURRENCY_FLAGS = {
  'EUR': '\u{1F1EA}\u{1F1FA}', 'USD': '\u{1F1FA}\u{1F1F8}', 'GBP': '\u{1F1EC}\u{1F1E7}',
  'JPY': '\u{1F1EF}\u{1F1F5}', 'CHF': '\u{1F1E8}\u{1F1ED}', 'AUD': '\u{1F1E6}\u{1F1FA}',
  'CAD': '\u{1F1E8}\u{1F1E6}', 'NZD': '\u{1F1F3}\u{1F1FF}', 'INR': '\u{1F1EE}\u{1F1F3}',
  'CNY': '\u{1F1E8}\u{1F1F3}', 'BRL': '\u{1F1E7}\u{1F1F7}', 'ZAR': '\u{1F1FF}\u{1F1E6}',
  'MXN': '\u{1F1F2}\u{1F1FD}', 'SGD': '\u{1F1F8}\u{1F1EC}', 'HKD': '\u{1F1ED}\u{1F1F0}',
  'SEK': '\u{1F1F8}\u{1F1EA}', 'NOK': '\u{1F1F3}\u{1F1F4}', 'DKK': '\u{1F1E9}\u{1F1F0}',
  'PLN': '\u{1F1F5}\u{1F1F1}', 'TRY': '\u{1F1F9}\u{1F1F7}', 'RUB': '\u{1F1F7}\u{1F1FA}',
  'KRW': '\u{1F1F0}\u{1F1F7}', 'XAU': '\u{1F4B0}', 'XAG': '\u{1F4B0}',
};

function getPairFlags(pair) {
  if (!pair) return '';
  const upper = pair.toUpperCase();
  let parts = [];
  if (upper.includes('/')) {
    parts = upper.split('/');
  } else if (upper.includes('-')) {
    parts = upper.split('-');
  } else {
    for (const key of Object.keys(CURRENCY_FLAGS)) {
      if (upper.startsWith(key)) {
        parts.push(key);
        const rest = upper.slice(key.length);
        if (rest) parts.push(rest);
        break;
      }
    }
    if (parts.length === 0) return '';
  }
  const flag1 = CURRENCY_FLAGS[parts[0]] || '';
  const flag2 = CURRENCY_FLAGS[parts[1]] || '';
  return flag1 + flag2;
}

// === SIMPLE CLIENT-SIDE ROUTING ===
function navigateTo(view, data = {}) {
  // Stop any running countdowns before navigating
  stopAllCountdowns();
  STATE.currentView = view;
  // Update URL
  const path = view === 'hero' ? '/' : view === 'landing' ? '/login' : view === 'dashboard' ? '/dashboard' : view === 'admin' ? '/admin' : '/';
  window.history.pushState({ view }, '', path);
  renderApp(view);
}

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
  const path = window.location.pathname;
  const view = path === '/' || path === '' ? 'hero' : path === '/login' ? 'landing' : path === '/dashboard' ? 'dashboard' : path === '/admin' ? 'admin' : 'hero';
  STATE.currentView = view;
  renderApp(view);
});

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const isFormData = options.body instanceof FormData;

  if (STATE.accessCode) {
    headers['Authorization'] = `Bearer ${STATE.accessCode}`;
  }

  const fetchHeaders = isFormData
    ? Object.fromEntries(Object.entries(headers).filter(([k]) => k !== 'Content-Type'))
    : headers;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: fetchHeaders,
    body: options.body || undefined,
  });

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    try { data = JSON.parse(text); } catch (e) {
      throw new Error('Backend API is not available. Please deploy the backend to Vercel.');
    }
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function renderApp(view) {
  const app = $('#app');
  if (!app) return;
  app.innerHTML = '';

  switch (view) {
    case 'hero':
      renderHeroPage(app);
      break;
    case 'landing':
      renderLanding(app);
      break;
    case 'dashboard':
      renderDashboard(app);
      break;
    case 'admin':
      renderAdminDashboard(app);
      break;
    default:
      renderHeroPage(app);
  }

  // Close mobile menu on navigation
  STATE.mobileMenuOpen = false;
}

// ============================================================
// HERO LANDING PAGE
// ============================================================
function renderHeroPage(container) {
  container.innerHTML = `
    <!-- NAVBAR -->
    <nav class="hero-nav" id="heroNav">
      <div class="hero-nav-inner">
        <div class="hero-nav-left">
          <a href="/" class="hero-logo" onclick="event.preventDefault();navigateTo('hero')">Theo Sign</a>
        </div>
        <button class="hamburger" id="hamburgerBtn" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
        <div class="hero-nav-center" id="navLinks">
          <a href="#signals" onclick="document.getElementById('signals-section').scrollIntoView({behavior:'smooth'})">Signals</a>
          <a href="#pricing" onclick="document.getElementById('pricing-section').scrollIntoView({behavior:'smooth'})">Pricing</a>
          <a href="#features" onclick="document.getElementById('features-section').scrollIntoView({behavior:'smooth'})">Features</a>
        </div>
        <div class="hero-nav-right">
          <a href="/login" class="nav-login-link" onclick="event.preventDefault();navigateTo('landing')">Login</a>
          <button class="nav-cta-btn" onclick="navigateTo('landing')">GET STARTED</button>
        </div>
      </div>
    </nav>

    <!-- HERO SECTION -->
    <section class="hero-section" id="hero-section">
      <div class="hero-bg-chart"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-badge">AI-POWERED PRECISION</div>
        <h1 class="hero-title">Master the Markets with <span class="hero-highlight">Precision Signals</span></h1>
        <p class="hero-subtitle">Real-time AI-driven Forex analysis. Upload your MT4 charts and receive probability-based trading insights with entry prices, gale levels, and confidence ratings.</p>
        <div class="hero-actions">
          <button class="hero-btn-primary" onclick="navigateTo('landing')">Get Started Now</button>
          <a href="#signals" class="hero-btn-secondary" onclick="document.getElementById('signals-section').scrollIntoView({behavior:'smooth'})">View Performance</a>
        </div>
      </div>
    </section>

    <!-- LIVE SIGNAL FEED -->
    <section class="signals-section" id="signals-section">
      <div class="signals-header">
        <div class="signals-header-top">
          <h2>Live Signal Feed</h2>
          <div class="live-badge">
            <span class="live-dot"></span>
            LIVE UPDATE
          </div>
        </div>
        <p>Real-time AI-generated trading signals based on current market analysis</p>
      </div>
      <div class="signals-grid">
        <div class="signal-card-hero">
          <div class="signal-card-top">
            <span class="signal-icon">₿</span>
            <span class="signal-label">CRYPTO</span>
            <span class="signal-result success">+3.53%</span>
          </div>
          <div class="signal-pair-name">BTC/USD</div>
          <div class="signal-entry">ENTRY <strong>$64,230.00</strong></div>
          <div class="signal-target">TARGET <strong>$66,500.00</strong></div>
        </div>
        <div class="signal-card-hero">
          <div class="signal-card-top">
            <span class="signal-icon">🥇</span>
            <span class="signal-label">COMMODITY</span>
            <span class="signal-result success">+1.37%</span>
          </div>
          <div class="signal-pair-name">XAU/USD</div>
          <div class="signal-entry">ENTRY <strong>$2,342.10</strong></div>
          <div class="signal-target">TARGET <strong>$2,310.00</strong></div>
        </div>
        <div class="signal-card-hero">
          <div class="signal-card-top">
            <span class="signal-icon">💶</span>
            <span class="signal-label">FOREX</span>
            <span class="signal-result success">+0.69%</span>
          </div>
          <div class="signal-pair-name">EUR/USD</div>
          <div class="signal-entry">ENTRY <strong>1.08450</strong></div>
          <div class="signal-target">TARGET <strong>1.09200</strong></div>
        </div>
      </div>
    </section>

    <!-- FEATURES SECTION -->
    <section class="features-section" id="features-section">
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🛡️</div>
          <h3>90% Accuracy</h3>
          <p>Our AI models analyze thousands of data points to deliver highly accurate trading signals you can trust.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Real-time Alerts</h3>
          <p>Get instant notifications on market movements and trading opportunities as they happen.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Expert Analysis</h3>
          <p>Deep technical analysis combining candlestick patterns, RSI, MACD, and support/resistance levels.</p>
        </div>
      </div>
    </section>

    <!-- PRICING SECTION -->
    <section class="pricing-section" id="pricing-section">
      <h2 class="pricing-heading">Join 5,000+ Profitable Traders</h2>
      <div class="pricing-card">
        <div class="pricing-label">Monthly Access</div>
        <div class="pricing-price">10,000 TSh<span class="pricing-period">/month</span></div>
        <div class="pricing-sub">Less than a cup of coffee! ☕</div>
        <ul class="pricing-features">
          <li>✓ All VIP Signals</li>
          <li>✓ Telegram Bot Access</li>
          <li>✓ 24/7 Support</li>
          <li>✓ AI-Powered Analysis</li>
        </ul>
        <button class="pricing-btn" onclick="navigateTo('landing')">Subscribe Now</button>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="hero-footer">
      <div class="footer-inner">
        <div class="footer-left">
          <div class="footer-logo">Theo Sign</div>
          <p class="footer-copy">© 2024 Theo Sign. All rights reserved.</p>
          <p class="footer-disclaimer">Trading involves risk. Past performance does not guarantee future results. This is not financial advice.</p>
        </div>
        <div class="footer-right">
          <a href="#">Terms of Service</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Risk Disclosure</a>
        </div>
      </div>
    </footer>
  `;

  // Mobile hamburger menu
  const hamburger = $('#hamburgerBtn');
  const navLinks = $('#navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      STATE.mobileMenuOpen = !STATE.mobileMenuOpen;
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('show');
    });
  }

  // Close mobile menu when clicking a link
  navLinks?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('active');
      navLinks?.classList.remove('show');
      STATE.mobileMenuOpen = false;
    });
  });
}

// ============================================================
// LANDING PAGE (Login)
// ============================================================
function renderLanding(container) {
  container.innerHTML = `
    <div class="landing">
      <div class="landing-content">
        <div class="logo">
          <div class="logo-icon">TS</div>
          <span class="logo-text">Theo Sign</span>
        </div>
        <p class="tagline">AI-powered Forex market analysis. Upload MetaTrader 4 charts and receive probability-based trading insights.</p>
        <div class="auth-form">
          <div class="input-group">
            <label for="accessCode">Enter Access Code</label>
            <input type="password" id="accessCode" placeholder="••••••••" autocomplete="off" />
          </div>
          <div class="error-msg" id="loginError"></div>
          <button class="btn-primary" id="loginBtn">Access Platform</button>
          <a href="/" class="back-link" onclick="event.preventDefault();navigateTo('hero')">← Back to Home</a>
        </div>
      </div>
    </div>
  `;

  const input = $('#accessCode');
  const btn = $('#loginBtn');
  const errorEl = $('#loginError');

  async function handleLogin() {
    const code = input.value.trim();
    if (!code) {
      errorEl.textContent = 'Please enter an access code.';
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Authenticating...';
    errorEl.classList.remove('show');

    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      STATE.accessCode = code;
      if (data.role === 'admin') {
        STATE.isAdmin = true;
        navigateTo('admin');
      } else {
        STATE.isAdmin = false;
        navigateTo('dashboard');
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Access Platform';
    }
  }

  btn.addEventListener('click', handleLogin);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  input.focus();
}

// ============================================================
// USER DASHBOARD
// ============================================================
function renderDashboard(container) {
  container.innerHTML = `
    <div class="dashboard">
      <header class="dash-header">
        <div class="dash-header-left">
          <div class="dash-logo">TS</div>
          <span class="dash-title">Theo Sign</span>
          <span class="dash-code-badge">${STATE.accessCode}</span>
        </div>
        <div class="dash-header-right">
          <div class="live-clock-box">
            <span class="live-clock-icon">🕐</span>
            <span class="live-clock-time" id="liveClock">00:00:00</span>
          </div>
          <button class="btn-icon" id="refreshBtn" title="Refresh">↻</button>
          <button class="btn-logout" id="logoutBtn">Sign Out</button>
        </div>
      </header>

      <div class="dash-body">
        <div class="upload-section">
          <h2>${t('chartAnalysis')}</h2>
          <p>${t('uploadDesc')}</p>
          <div class="upload-area" id="uploadArea">
            <div class="upload-area-icon">📈</div>
            <div class="upload-area-text">${t('dropHere')} <strong>${t('browse')}</strong></div>
            <div class="upload-area-hint">${t('supports')}</div>
            <input type="file" id="fileInput" accept="image/png,image/jpeg,image/jpg,image/gif,image/bmp,image/webp" />
            <img class="upload-preview" id="uploadPreview" />
          </div>
          <div class="upload-actions" style="display:none" id="uploadActions">
            <button class="btn-secondary" id="cancelUploadBtn">${t('cancel')}</button>
            <button class="btn-analyze" id="analyzeBtn">${t('analyzeChart')}</button>
          </div>
        </div>

        <div class="analysis-result" id="analysisResult"></div>

        <div class="history-section">
          <h2>${t('analysisHistory')}</h2>
          <div id="historyContainer"></div>
        </div>
      </div>
    </div>
  `;

  loadUserHistory();
  startLiveClock('liveClock');

  const uploadArea = $('#uploadArea');
  const fileInput = $('#fileInput');
  const uploadPreview = $('#uploadPreview');
  const uploadActions = $('#uploadActions');
  const cancelBtn = $('#cancelUploadBtn');
  const analyzeBtn = $('#analyzeBtn');

  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFileSelect(e.target.files[0]);
    }
  });

  // Support paste from clipboard (Ctrl+V screenshots)
  document.addEventListener('paste', (e) => {
    // Only handle paste if dashboard is the current view
    const isDashboard = document.querySelector('.dashboard') !== null;
    if (!isDashboard) return;
    
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(file);
          showToast('Image pasted from clipboard!', 'info');
        }
        break;
      }
    }
  });

  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large. Max 10MB.', 'error');
      return;
    }

    STATE.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadPreview.src = e.target.result;
      uploadPreview.classList.add('show');
      uploadArea.querySelector('.upload-area-icon').style.display = 'none';
      uploadArea.querySelector('.upload-area-text').style.display = 'none';
      uploadArea.querySelector('.upload-area-hint').style.display = 'none';
      uploadActions.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }

  cancelBtn.addEventListener('click', () => {
    resetUpload();
  });

  analyzeBtn.addEventListener('click', () => {
    if (!STATE.selectedFile) return;
    analyzeChart(STATE.selectedFile);
  });

  function resetUpload() {
    STATE.selectedFile = null;
    fileInput.value = '';
    uploadPreview.classList.remove('show');
    uploadPreview.src = '';
    uploadArea.querySelector('.upload-area-icon').style.display = '';
    uploadArea.querySelector('.upload-area-text').style.display = '';
    uploadArea.querySelector('.upload-area-hint').style.display = '';
    uploadActions.style.display = 'none';
  }

  $('#logoutBtn').addEventListener('click', () => {
    STATE.accessCode = null;
    STATE.isAdmin = false;
    navigateTo('hero');
  });

  $('#refreshBtn').addEventListener('click', loadUserHistory);
}

async function loadUserHistory() {
  try {
    const data = await api('/uploads');
    STATE.uploads = data || [];
    renderHistory();
  } catch (err) {
    if (STATE.currentView === 'dashboard') {
      showToast('Failed to load history.', 'error');
    }
  }
}

function renderHistory() {
  const container = $('#historyContainer');
  if (!container) return;

  if (!STATE.uploads.length) {
    container.innerHTML = '<div class="history-empty">No analysis history yet. Upload a chart to get started.</div>';
    return;
  }

  container.innerHTML = STATE.uploads.map((upload) => {
    const a = upload.analysis_result || {};
    const pair = a.pair || 'EUR/USD';
    const direction = a.direction || 'HOLD';
    const directionEmoji = a.direction_emoji || '🟡';
    const signalTime = a.signal_time || '--:--';
    const conf = a.confidence || 0;
    const gales = a.gales || {};
    const flags = getPairFlags(pair);
    const dirLabel = direction === 'CALL' ? 'UP' : direction === 'PUT' ? 'DOWN' : 'HOLD';
    const entryPrice = a.entry_price || '—';
    const reasoning = a.reasoning || '';
    const isManual = a.is_manual ? ' (Manual)' : '';

    let confClass = 'medium';
    if (conf >= 80) confClass = 'high';
    else if (conf <= 60) confClass = 'low';

    return `
      <div class="history-item" data-upload-id="${upload.id}">
        <div class="history-item-header">
          <div class="history-direction ${direction.toLowerCase()}">
            ${directionEmoji} ${pair} · ${dirLabel} · ${conf}%
          </div>
          <div class="history-meta">
            <span>${timeAgo(upload.uploaded_at)}${isManual}</span>
          </div>
        </div>
        <div class="history-expanded" id="historyDetail_${upload.id}">
          <div class="signal-card-new signal-card-compact">
            <div class="signal-line-time">⏰ ${utcToLocal(signalTime)}</div>
            <div class="signal-line-expiry">💰${a.expiry || '5 min'} Exp</div>
            <div class="signal-line-main">
              ${pair} → ${dirLabel} ${directionEmoji}
            </div>
            <div class="signal-line-pair">
              ${pair}${flags}
            </div>
            
            <div class="signal-gales">
              <div class="gale-row">
                <span class="gale-label">1st GALE</span>
                <span class="gale-arrow">--></span>
                <span class="gale-time">TIME UNTIL ${utcToLocal(gales.first)}</span>
              </div>
              <div class="gale-row">
                <span class="gale-label">2nd GALE</span>
                <span class="gale-arrow">--></span>
                <span class="gale-time">TIME UNTIL ${utcToLocal(gales.second)}</span>
              </div>
              <div class="gale-row">
                <span class="gale-label">3rd GALE</span>
                <span class="gale-arrow">--></span>
                <span class="gale-time">TIME UNTIL ${utcToLocal(gales.third)}</span>
              </div>
            </div>

            <div class="signal-details">
              <div class="signal-detail-item">
                <span class="sd-label">Entry Price</span>
                <span class="sd-value">${entryPrice}</span>
              </div>
              <div class="signal-detail-item">
                <span class="sd-label">Confidence</span>
                <span class="sd-value ${confClass}">${conf}%</span>
              </div>
              <div class="signal-detail-item">
                <span class="sd-label">Timeframe</span>
                <span class="sd-value">${a.timeframe || 'M5'}</span>
              </div>
            </div>

            ${reasoning ? `
            <div class="reasoning-box">
              <div class="stat-label">AI Reasoning</div>
              <p>${reasoning}</p>
            </div>` : ''}

            <div class="signal-timestamp">${formatDateFull(a.analyzed_at)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.history-item').forEach((item) => {
    item.addEventListener('click', () => {
      const detail = item.querySelector('.history-expanded');
      detail.classList.toggle('show');
    });
  });
}

async function analyzeChart(file) {
  const btn = $('#analyzeBtn');
  const resultEl = $('#analysisResult');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzing...';

  const formData = new FormData();
  formData.append('chart', file);
  formData.append('lang', STATE.lang);

  try {
    const data = await api('/upload', {
      method: 'POST',
      body: formData,
    });

    STATE.currentAnalysis = data.analysis;
    renderAnalysisResult(data.analysis);
    showToast('Analysis complete!', 'success');

    const uploadArea = $('#uploadArea');
    const uploadPreview = $('#uploadPreview');
    const uploadActions = $('#uploadActions');
    uploadPreview.classList.remove('show');
    uploadArea.querySelector('.upload-area-icon').style.display = '';
    uploadArea.querySelector('.upload-area-text').style.display = '';
    uploadArea.querySelector('.upload-area-hint').style.display = '';
    uploadActions.style.display = 'none';
    $('#fileInput').value = '';
    STATE.selectedFile = null;

    loadUserHistory();
  } catch (err) {
    showToast(err.message || t('failed'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = t('analyzeChart');
  }
}

function renderAnalysisResult(a) {
  const el = $('#analysisResult');
  if (!el) return;

  const pair = a.pair || 'EUR/USD';
  const signalTime = utcToLocal(a.signal_time);
  const direction = a.direction || 'HOLD';
  const directionEmoji = a.direction_emoji || '🟡';
  const entryPrice = a.entry_price || '—';
  const expiry = a.expiry || '5 min';
  const timeframe = a.timeframe || 'M5';
  const confidence = a.confidence || 75;
  const gales = a.gales || { first: '--:--', second: '--:--', third: '--:--' };
  const reasoning = a.reasoning || 'No analysis available.';
  const flags = getPairFlags(pair);

  const dirLabel = direction === 'CALL' ? 'UP' : direction === 'PUT' ? 'DOWN' : 'HOLD';

  el.innerHTML = `
    <div class="signal-card-new">
      <div class="signal-line-time">⏰ ${signalTime}</div>
      <div class="signal-line-expiry">💰${expiry} Exp</div>
      <div class="signal-line-main">
        ${pair} → ${dirLabel} ${directionEmoji}
      </div>
      <div class="signal-line-pair">
        ${pair}${flags}
      </div>
      
      <div class="signal-gales">
        <div class="gale-row">
          <span class="gale-label">1st GALE</span>
          <span class="gale-arrow">--></span>
          <span class="gale-time">TIME UNTIL ${utcToLocal(gales.first)}</span>
        </div>
        <div class="gale-row">
          <span class="gale-label">2nd GALE</span>
          <span class="gale-arrow">--></span>
          <span class="gale-time">TIME UNTIL ${utcToLocal(gales.second)}</span>
        </div>
        <div class="gale-row">
          <span class="gale-label">3rd GALE</span>
          <span class="gale-arrow">--></span>
          <span class="gale-time">TIME UNTIL ${utcToLocal(gales.third)}</span>
        </div>
      </div>

      <div class="signal-details">
        <div class="signal-detail-item">
          <span class="sd-label">Entry Price</span>
          <span class="sd-value">${entryPrice}</span>
        </div>
        <div class="signal-detail-item">
          <span class="sd-label">Confidence</span>
          <span class="sd-value ${confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low'}">${confidence}%</span>
        </div>
        <div class="signal-detail-item">
          <span class="sd-label">Timeframe</span>
          <span class="sd-value">${timeframe}</span>
        </div>
      </div>

      <div class="reasoning-box">
        <div class="stat-label">AI Reasoning</div>
        <p>${reasoning}</p>
      </div>

      <div class="signal-timestamp">${formatDateFull(a.analyzed_at)}</div>
    </div>
  `;

  el.classList.add('show');
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
function renderAdminDashboard(container) {
  container.innerHTML = `
    <div class="admin-dash">
      <header class="dash-header" style="border-color: rgba(0,208,132,0.3)">
        <div class="dash-header-left">
          <div class="dash-logo">TS</div>
          <span class="dash-title">Admin</span>
          <span class="dash-code-badge" style="color:var(--accent);border-color:var(--accent)">root</span>
        </div>
        <div class="dash-header-right">
          <button class="btn-icon" id="adminRefreshBtn" title="Refresh">↻</button>
          <button class="btn-logout" id="adminLogoutBtn">Sign Out</button>
        </div>
      </header>

      <div class="admin-body">
        <div class="admin-stats" id="adminStats"></div>

        <div class="tabs">
          <button class="tab active" data-tab="codes">Access Codes</button>
          <button class="tab" data-tab="users">Active Users</button>
          <button class="tab" data-tab="uploads">Upload History</button>
          <button class="tab" data-tab="manual">Manual Analysis</button>
        </div>

        <div id="adminContent"></div>
      </div>
    </div>
  `;

  loadAdminData();

  container.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderAdminTabContent(tab.dataset.tab);
    });
  });

  $('#adminLogoutBtn').addEventListener('click', () => {
    STATE.accessCode = null;
    STATE.isAdmin = false;
    navigateTo('hero');
  });

  $('#adminRefreshBtn').addEventListener('click', loadAdminData);
}

async function loadAdminData() {
  try {
    const [analytics, codes, users, uploads] = await Promise.all([
      api('/admin/analytics'),
      api('/admin/codes'),
      api('/admin/users'),
      api('/admin/uploads'),
    ]);

    STATE.adminAnalytics = analytics;
    STATE.adminCodes = codes;
    STATE.adminUsers = users;
    STATE.adminUploads = uploads;

    renderAdminStats();
    renderAdminTabContent(document.querySelector('.tab.active')?.dataset.tab || 'codes');
  } catch (err) {
    showToast('Failed to load admin data.', 'error');
  }
}

function renderAdminStats() {
  const container = $('#adminStats');
  if (!container || !STATE.adminAnalytics) return;

  const a = STATE.adminAnalytics;
  container.innerHTML = `
    <div class="admin-stat-card">
      <div class="admin-stat-value">${a.totalCodes}</div>
      <div class="admin-stat-label">Total Codes</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-value" style="color:var(--green)">${a.activeCodes}</div>
      <div class="admin-stat-label">Active</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-value" style="color:var(--red)">${a.disabledCodes}</div>
      <div class="admin-stat-label">Disabled</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-value">${a.totalUploads}</div>
      <div class="admin-stat-label">Total Uploads</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-value">${a.totalUsage}</div>
      <div class="admin-stat-label">Total Usage</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-value" style="color:var(--yellow)">${a.expiredCodes}</div>
      <div class="admin-stat-label">Expired</div>
    </div>
  `;
}

function renderAdminTabContent(tab) {
  const container = $('#adminContent');
  if (!container) return;

  switch (tab) {
    case 'codes':
      renderAdminCodes(container);
      break;
    case 'users':
      renderAdminUsers(container);
      break;
    case 'uploads':
      renderAdminUploads(container);
      break;
    case 'manual':
      renderAdminManualAnalysis(container);
      break;
    default:
      container.innerHTML = '';
  }
}

function renderAdminCodes(container) {
  container.innerHTML = `
    <div class="admin-section">
      <h2>Access Codes <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400">${STATE.adminCodes.length} total</span></h2>
      <div class="create-code-form">
        <input type="text" id="newCodeInput" placeholder="Code (e.g. TRADE-9999)" />
        <input type="number" id="newCodeLimit" placeholder="Usage limit (-1 for unlimited)" value="-1" style="min-width:100px;max-width:140px" />
        <input type="date" id="newCodeExpiry" placeholder="Expiry date (optional)" style="min-width:130px;max-width:160px" />
        <button class="btn-sm" id="createCodeBtn">Create Code</button>
      </div>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Usage</th>
              <th>Limit</th>
              <th>Expires</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="codesTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = $('#codesTableBody');
  tbody.innerHTML = STATE.adminCodes.map((c) => {
    const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
    let statusText = 'Active';
    let statusClass = 'active-status';
    if (c.disabled) { statusText = 'Disabled'; statusClass = 'disabled-status'; }
    else if (isExpired) { statusText = 'Expired'; statusClass = 'disabled-status'; }

    return `
      <tr>
        <td style="font-family:monospace;font-weight:600;color:var(--text-primary)">${c.code}</td>
        <td><span class="${statusClass}">${statusText}</span></td>
        <td>${c.usage_count}</td>
        <td>${c.usage_limit === -1 ? '∞' : c.usage_limit}</td>
        <td>${c.expires_at ? formatDate(c.expires_at) : '—'}</td>
        <td>${formatDate(c.created_at)}</td>
        <td>
          <div class="admin-actions">
            <button class="btn-tiny ${c.disabled ? 'success' : 'danger'}" data-action="toggle" data-code="${c.code}">
              ${c.disabled ? 'Enable' : 'Disable'}
            </button>
            <button class="btn-tiny danger" data-action="delete" data-code="${c.code}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  $('#createCodeBtn').addEventListener('click', async () => {
    const code = $('#newCodeInput').value.trim();
    if (!code) { showToast('Please enter a code.', 'error'); return; }
    const usage_limit = parseInt($('#newCodeLimit').value) || -1;
    const expires_at = $('#newCodeExpiry').value || null;

    try {
      await api('/admin/codes', {
        method: 'POST',
        body: JSON.stringify({ code, usage_limit, expires_at }),
      });
      showToast(`Code "${code}" created!`, 'success');
      $('#newCodeInput').value = '';
      $('#newCodeLimit').value = '-1';
      $('#newCodeExpiry').value = '';
      loadAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  tbody.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = btn.dataset.code;
      const action = btn.dataset.action;
      try {
        if (action === 'delete') {
          await api(`/admin/codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
          showToast(`Code "${code}" deleted.`, 'success');
        } else {
          const isDisabled = btn.textContent.trim() === 'Enable';
          await api(`/admin/codes/${encodeURIComponent(code)}`, {
            method: 'PUT',
            body: JSON.stringify({ disabled: !isDisabled }),
          });
          showToast(`Code "${code}" ${isDisabled ? 'enabled' : 'disabled'}.`, 'success');
        }
        loadAdminData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderAdminUsers(container) {
  container.innerHTML = `
    <div class="admin-section">
      <h2>Active Users <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400">${STATE.adminUsers.length} total</span></h2>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Usage</th>
              <th>Uploads</th>
              <th>Last Active</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="usersTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = $('#usersTableBody');
  tbody.innerHTML = STATE.adminUsers.map((u) => {
    const isExpired = u.expires_at && new Date(u.expires_at) < new Date();
    let statusText = 'Active';
    let statusClass = 'active-status';
    if (u.disabled) { statusText = 'Disabled'; statusClass = 'disabled-status'; }
    else if (isExpired) { statusText = 'Expired'; statusClass = 'disabled-status'; }
    return `
      <tr>
        <td style="font-family:monospace;font-weight:600;color:var(--text-primary)">${u.code}</td>
        <td><span class="${statusClass}">${statusText}</span></td>
        <td>${u.usage_count}/${u.usage_limit === -1 ? '∞' : u.usage_limit}</td>
        <td>${u.upload_count}</td>
        <td>${u.last_active ? timeAgo(u.last_active) : '—'}</td>
        <td>${formatDate(u.created_at)}</td>
      </tr>
    `;
  }).join('');
}

function renderAdminUploads(container) {
  container.innerHTML = `
    <div class="admin-section">
      <h2>Upload History <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400">${STATE.adminUploads.length} total</span></h2>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Access Code</th>
              <th>File</th>
              <th>Pair</th>
              <th>Direction</th>
              <th>Confidence</th>
              <th>Uploaded</th>
            </tr>
          </thead>
          <tbody id="uploadsTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = $('#uploadsTableBody');
  tbody.innerHTML = STATE.adminUploads.map((u) => {
    const a = u.analysis_result || {};
    const dir = a.direction || '—';
    const conf = a.confidence != null ? `${a.confidence}%` : '—';
    return `
      <tr>
        <td style="font-family:monospace;font-size:0.75rem;color:var(--text-muted)">${u.id.slice(0, 8)}</td>
        <td>${u.access_code}</td>
        <td>${u.original_name || u.filename}</td>
        <td>${a.pair || '—'}</td>
        <td>${dir}</td>
        <td>${conf}</td>
        <td>${formatDate(u.uploaded_at)}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// ADMIN MANUAL ANALYSIS (New Feature)
// ============================================================
function renderAdminManualAnalysis(container) {
  container.innerHTML = `
    <div class="admin-section">
      <h2>Manual Analysis Entry</h2>
      <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:20px;">
        Use this form to manually create analysis results when the AI service is unavailable.
      </p>
      <div class="manual-form">
        <div class="manual-form-row">
          <div class="manual-form-group">
            <label>Access Code</label>
            <select id="manualAccessCode">
              <option value="">— Select a user —</option>
              ${STATE.adminUsers.map(u => `<option value="${u.code}">${u.code} ${u.disabled ? '(disabled)' : ''}</option>`).join('')}
              ${STATE.adminCodes.filter(c => !STATE.adminUsers.find(u => u.code === c.code)).map(c => `<option value="${c.code}">${c.code}</option>`).join('')}
            </select>
          </div>
          <div class="manual-form-group">
            <label>Currency Pair</label>
            <input type="text" id="manualPair" placeholder="e.g. EUR/USD" value="EUR/USD" />
          </div>
        </div>
        <div class="manual-form-row">
          <div class="manual-form-group">
            <label>Direction</label>
            <select id="manualDirection">
              <option value="CALL">CALL (Price will go UP) 🟢</option>
              <option value="PUT">PUT (Price will go DOWN) 🔴</option>
              <option value="HOLD">HOLD (Wait) 🟡</option>
            </select>
          </div>
          <div class="manual-form-group">
            <label>Confidence (50-99%)</label>
            <input type="number" id="manualConfidence" min="50" max="99" value="75" />
          </div>
        </div>
        <div class="manual-form-row">
          <div class="manual-form-group">
            <label>Entry Price</label>
            <input type="text" id="manualEntryPrice" placeholder="e.g. 1.0850" />
          </div>
          <div class="manual-form-group">
            <label>Timeframe</label>
            <select id="manualTimeframe">
              <option value="M1">M1 (1 Minute)</option>
              <option value="M5" selected>M5 (5 Minutes)</option>
              <option value="M15">M15 (15 Minutes)</option>
              <option value="M30">M30 (30 Minutes)</option>
              <option value="H1">H1 (1 Hour)</option>
            </select>
          </div>
        </div>
        <div class="manual-form-group" style="margin-top:12px">
          <label>Reasoning / Analysis Notes</label>
          <textarea id="manualReasoning" rows="4" placeholder="Enter the analysis reasoning and explanation..."></textarea>
        </div>
        <button class="btn-sm" id="submitManualBtn" style="margin-top:16px;padding:12px 24px;font-size:0.95rem">
          Submit Analysis
        </button>
        <div id="manualResult" style="margin-top:16px"></div>
      </div>
    </div>
  `;

  $('#submitManualBtn').addEventListener('click', async () => {
    const access_code = $('#manualAccessCode').value;
    const pair = $('#manualPair').value.trim();
    const direction = $('#manualDirection').value;
    const confidence = parseInt($('#manualConfidence').value) || 75;
    const entry_price = $('#manualEntryPrice').value.trim();
    const timeframe = $('#manualTimeframe').value;
    const reasoning = $('#manualReasoning').value.trim();

    if (!access_code) {
      showToast('Please select an access code.', 'error');
      return;
    }
    if (!pair) {
      showToast('Please enter a currency pair.', 'error');
      return;
    }

    const btn = $('#submitManualBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      const data = await api('/admin/manual-analysis', {
        method: 'POST',
        body: JSON.stringify({ access_code, pair, direction, confidence, entry_price, timeframe, reasoning }),
      });
      
      const resultEl = $('#manualResult');
      
      resultEl.innerHTML = `
        <div class="signal-card-new" style="margin-top:12px">
          <div style="color:var(--green);font-weight:600;margin-bottom:8px">✅ Analysis submitted successfully!</div>
          <div class="signal-line-time">⏰ ${utcToLocal(data.analysis.signal_time)}</div>
          <div class="signal-line-main">${data.analysis.pair} → ${data.analysis.direction} ${data.analysis.direction_emoji}</div>
          <div class="signal-details">
            <div class="signal-detail-item">
              <span class="sd-label">Confidence</span>
              <span class="sd-value">${data.analysis.confidence}%</span>
            </div>
            <div class="signal-detail-item">
              <span class="sd-label">Entry Price</span>
              <span class="sd-value">${data.analysis.entry_price}</span>
            </div>
          </div>
          <div class="reasoning-box"><p>${data.analysis.reasoning}</p></div>
        </div>
      `;

      showToast('Manual analysis submitted!', 'success');
      $('#manualAccessCode').value = '';
      $('#manualPair').value = 'EUR/USD';
      $('#manualConfidence').value = '75';
      $('#manualEntryPrice').value = '';
      $('#manualReasoning').value = '';
      
      // Refresh admin data
      loadAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Analysis';
    }
  });
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
  // Determine initial view based on URL path
  const path = window.location.pathname;
  let initialView = 'hero';
  if (path === '/login') initialView = 'landing';
  else if (path === '/dashboard') initialView = 'dashboard';
  else if (path === '/admin') initialView = 'admin';
  
  STATE.currentView = initialView;
  renderApp(initialView);
});
