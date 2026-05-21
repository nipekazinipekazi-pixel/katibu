import os

# Read the current app.js
with open('public/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

print(f"Read app.js: {len(js)} bytes")

# ============================================================
# 1. Add LANG object and language state after STATE definition
# ============================================================

old_state_end = """  adminAnalytics: null,
};

const API_BASE = '/api';"""

new_lang_section = """  adminAnalytics: null,
  lang: 'en',
};

const API_BASE = '/api';

// === LANGUAGE SUPPORT ===
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
    langEn: 'EN',
    langSw: 'SW',
    switchLang: 'Switch to Swahili',
  },
  sw: {
    appName: 'Theo Sign',
    tagline: 'Uchambuzi wa soko la Forex unaoendeshwa na AI. Pakia chati za MetaTrader 4 na upokee maarifa ya biashara yenye uwezekano.',
    enterCode: 'Weka Nambari ya Ufikiaji',
    accessPlatform: 'Ingia Kwenye Mfumo',
    authenticating: 'Inathibitisha...',
    pleaseEnterCode: 'Tafadhali weka nambari ya ufikiaji.',
    signOut: 'Ondoka',
    chartAnalysis: 'Uchambuzi wa Chati',
    uploadDesc: 'Pakia picha ya skrini ya MetaTrader 4 kwa uchambuzi wa soko unaoendeshwa na AI',
    dropHere: 'Dondosha picha ya chati yako ya MT4 hapa au',
    browse: 'vinjari',
    supports: 'Inasaidia PNG, JPG, JPEG, GIF, BMP, WEBP (max 10MB)',
    cancel: 'Ghairi',
    analyzeChart: 'Chambua Chati',
    analyzing: 'Inachambua...',
    analysisHistory: 'Historia ya Uchambuzi',
    noHistory: 'Hakuna historia ya uchambuzi bado. Pakia chati kuanza.',
    signalCard: 'Ishara ya Biashara',
    direction: 'Mwelekeo',
    confidence: 'Uhakika',
    entryPrice: 'Bei ya Kuingia',
    expiry: 'Muda wa kuisha',
    signalTime: 'Muda wa Ishara',
    timezone: 'Saa za eneo',
    pair: 'Jozi',
    timeframe: 'Muda wa chati',
    gales: 'Mawimbi',
    gale1: 'Wimbi la 1',
    gale2: 'Wimbi la 2',
    gale3: 'Wimbi la 3',
    nextSignal: 'Ishara Inayofuata',
    reasoning: 'Uchambuzi wa AI',
    noReasoning: 'Hakuna uchambuzi uliopatikana.',
    analysisComplete: 'Uchambuzi umekamilika!',
    failed: 'Uchambuzi umeshindwa. Tafadhali jaribu tena.',
    sessionExpired: 'Muda wa kikao umeisha. Tafadhali ingia tena.',
    call: 'CALL',
    put: 'PUT',
    hold: 'HOLD',
    minutes: 'dak',
    refresh: 'Onyesha upya',
    langEn: 'EN',
    langSw: 'SW',
    switchLang: 'Badilisha hadi Kiingereza',
  },
};

function t(key) {
  return LANG[STATE.lang][key] || key;
}"""

js = js.replace(old_state_end, new_lang_section)
print("1. Added LANG support")

# ============================================================
# 2. Update renderLanding to include language toggle
# ============================================================

old_landing = """  container.innerHTML = `
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
        </div>
      </div>
    </div>
  `;

  const input = $('#accessCode');
  const btn = $('#loginBtn');
  const errorEl = $('#loginError');

  function handleLogin() {
    const code = input.value.trim();
    if (!code) {
      errorEl.textContent = 'Please enter an access code.';
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Authenticating...';
    errorEl.classList.remove('show');

    api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then((data) => {
        STATE.accessCode = code;
        if (data.role === 'admin') {
          STATE.isAdmin = true;
          navigateTo('admin');
        } else {
          STATE.isAdmin = false;
          navigateTo('dashboard');
        }
      })
      .catch((err) => {
        errorEl.textContent = err.message;
        errorEl.classList.add('show');
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Access Platform';
      });
  }

  btn.addEventListener('click', handleLogin);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  input.focus();
}"""

new_landing = """  container.innerHTML = `
    <div class="landing">
      <div class="lang-toggle-top">
        <button class="lang-btn ${STATE.lang === 'en' ? 'active' : ''}" data-lang="en">${t('langEn')}</button>
        <button class="lang-btn ${STATE.lang === 'sw' ? 'active' : ''}" data-lang="sw">${t('langSw')}</button>
      </div>
      <div class="landing-content">
        <div class="logo">
          <div class="logo-icon">TS</div>
          <span class="logo-text">${t('appName')}</span>
        </div>
        <p class="tagline">${t('tagline')}</p>
        <div class="auth-form">
          <div class="input-group">
            <label for="accessCode">${t('enterCode')}</label>
            <input type="password" id="accessCode" placeholder="\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022" autocomplete="off" />
          </div>
          <div class="error-msg" id="loginError"></div>
          <button class="btn-primary" id="loginBtn">${t('accessPlatform')}</button>
        </div>
      </div>
    </div>
  `;

  // Language toggle
  container.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.lang = btn.dataset.lang;
      renderLanding(container);
    });
  });

  const input = $('#accessCode');
  const btn = $('#loginBtn');
  const errorEl = $('#loginError');

  function handleLogin() {
    const code = input.value.trim();
    if (!code) {
      errorEl.textContent = t('pleaseEnterCode');
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = t('authenticating');
    errorEl.classList.remove('show');

    api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then((data) => {
        STATE.accessCode = code;
        if (data.role === 'admin') {
          STATE.isAdmin = true;
          navigateTo('admin');
        } else {
          STATE.isAdmin = false;
          navigateTo('dashboard');
        }
      })
      .catch((err) => {
        errorEl.textContent = err.message;
        errorEl.classList.add('show');
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = t('accessPlatform');
      });
  }

  btn.addEventListener('click', handleLogin);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  input.focus();
}"""

js = js.replace(old_landing, new_landing)
print("2. Updated renderLanding with language toggle")

# ============================================================
# 3. Update renderDashboard to add lang toggle in header
# ============================================================

old_dash_header = """          <button class="btn-icon" id="refreshBtn" title="Refresh">\\u21bb</button>
          <button class="btn-logout" id="logoutBtn">Sign Out</button>"""

new_dash_header = """          <button class="btn-icon lang-btn ${STATE.lang === 'en' ? 'active' : ''}" data-lang-dash="en" title="English">EN</button>
          <button class="btn-icon lang-btn ${STATE.lang === 'sw' ? 'active' : ''}" data-lang-dash="sw" title="Kiswahili">SW</button>
          <button class="btn-icon" id="refreshBtn" title="${t('refresh')}">\\u21bb</button>
          <button class="btn-logout" id="logoutBtn">${t('signOut')}</button>"""

js = js.replace(old_dash_header, new_dash_header)
print("3. Updated dashboard header with lang toggle")

# Check if the lang toggle event listener is needed in renderDashboard
old_dash_listeners_end = """  $('#logoutBtn').addEventListener('click', () => {
    STATE.accessCode = null;
    STATE.isAdmin = false;
    navigateTo('landing');
  });

  $('#refreshBtn').addEventListener('click', loadUserHistory);
}"""

new_dash_listeners_end = """  // Language toggle in dashboard
  container.querySelectorAll('[data-lang-dash]').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.lang = btn.dataset.langDash;
      renderDashboard(container);
    });
  });

  $('#logoutBtn').addEventListener('click', () => {
    STATE.accessCode = null;
    STATE.isAdmin = false;
    navigateTo('landing');
  });

  $('#refreshBtn').addEventListener('click', loadUserHistory);
}"""

js = js.replace(old_dash_listeners_end, new_dash_listeners_end)
print("4. Added lang toggle listeners in dashboard")

# ============================================================
# 4. Update analyzeChart to pass lang parameter
# ============================================================

old_analyze = """  const formData = new FormData();
  formData.append('chart', file);"""

new_analyze = """  const formData = new FormData();
  formData.append('chart', file);
  formData.append('lang', STATE.lang);"""

js = js.replace(old_analyze, new_analyze)
print("5. Added lang param to upload")

# ============================================================
# 5. Fix renderAnalysisResult - use actual server field names
# ============================================================

old_render_result = """function renderAnalysisResult(a) {
  const el = $('#analysisResult');
  if (!el) return;

  const dir = a.market_direction || 'unknown';
  const action = a.suggested_action || 'wait';
  const conf = a.confidence_percentage || 0;

  let confClass = 'medium';
  if (conf >= 80) confClass = 'high';
  else if (conf <= 70) confClass = 'low';

  let dirArrow = '\\u2192';
  if (dir === 'bullish') dirArrow = '\\u2191';
  else if (dir === 'bearish') dirArrow = '\\u2193';

  el.innerHTML = `
    <div class="analysis-header">
      <h2>Analysis Results</h2>
      <span class="analysis-timestamp">${formatDateFull(a.analyzed_at)}</span>
    </div>
    <div class="analysis-grid">
      <div class="stat-card">
        <div class="stat-label">Market Direction</div>
        <div class="stat-value ${dir}">
          <span class="direction-indicator">
            <span class="direction-arrow">${dirArrow}</span>
            ${capitalize(dir)}
          </span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Confidence</div>
        <div class="stat-value">${conf}%</div>
        <div class="confidence-bar">
          <div class="confidence-fill ${confClass}" style="width:${conf}%"></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Suggested Action</div>
        <div class="stat-value ${action}">${capitalize(action)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Entry Zone</div>
        <div class="stat-value" style="font-size:1.1rem">${a.entry_zone || '\\u2014'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Stop Loss</div>
        <div class="stat-value" style="color:var(--red)">${a.stop_loss || '\\u2014'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Take Profit</div>
        <div class="stat-value" style="color:var(--green)">${a.take_profit || '\\u2014'}</div>
      </div>
    </div>
    <div class="reasoning-box">
      <div class="stat-label">AI Reasoning</div>
      <p>${a.reasoning || 'No reasoning provided.'}</p>
    </div>
  `;

  el.classList.add('show');
}"""

new_render_result = """function renderAnalysisResult(a) {
  const el = $('#analysisResult');
  if (!el) return;

  const dir = (a.direction || 'HOLD').toUpperCase();
  const conf = a.confidence || 75;
  const pair = a.pair || 'USDINR-OTC';
  const sigTime = a.signal_time || '\\u2014\\u2014:\\u2014\\u2014';
  const tz = a.timezone || 'UTC -3';
  const expiry = a.expiry || '5 min';
  const entry = a.entry_price || '\\u2014\\u2014\\u2014';
  const timeframe = a.timeframe || 'M5';
  const gales = a.gales || {};
  const first = gales.first || '\\u2014\\u2014:\\u2014\\u2014';
  const second = gales.second || '\\u2014\\u2014:\\u2014\\u2014';
  const third = gales.third || '\\u2014\\u2014:\\u2014\\u2014';
  const reasoning = a.reasoning || t('noReasoning');

  let confClass = 'medium';
  if (conf >= 80) confClass = 'high';
  else if (conf <= 60) confClass = 'low';

  const isCall = dir === 'CALL';
  const isPut = dir === 'PUT';
  const isHold = dir === 'HOLD';
  const dirColor = isCall ? 'var(--green)' : isPut ? 'var(--red)' : 'var(--yellow)';
  const dirEmoji = isCall ? '\\ud83d\\udfe2' : isPut ? '\\ud83d\\udd34' : '\\ud83d\\udfe1';
  const dirLabel = isCall ? t('call') : isPut ? t('put') : t('hold');

  el.innerHTML = `
    <div class="analysis-header">
      <h2>${t('signalCard')}</h2>
      <span class="analysis-timestamp">${formatDateFull(a.analyzed_at)}</span>
    </div>

    <!-- Signal Card -->
    <div class="signal-card">
      <div class="signal-badge ${dir}">${dirEmoji} ${dirLabel}</div>
      <div class="signal-meta">
        <div class="signal-meta-item"><span class="sig-label">${t('pair')}</span><span class="sig-value">${pair}</span></div>
        <div class="signal-meta-item"><span class="sig-label">${t('signalTime')}</span><span class="sig-value">${sigTime}</span></div>
        <div class="signal-meta-item"><span class="sig-label">${t('timezone')}</span><span class="sig-value">${tz}</span></div>
        <div class="signal-meta-item"><span class="sig-label">${t('expiry')}</span><span class="sig-value">${expiry}</span></div>
        <div class="signal-meta-item"><span class="sig-label">${t('timeframe')}</span><span class="sig-value">${timeframe}</span></div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="analysis-grid">
      <div class="stat-card">
        <div class="stat-label">${t('direction')}</div>
        <div class="stat-value" style="color:${dirColor}">
          <span class="direction-indicator">
            ${dirEmoji} ${dirLabel}
          </span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${t('confidence')}</div>
        <div class="stat-value">${conf}%</div>
        <div class="confidence-bar">
          <div class="confidence-fill ${confClass}" style="width:${conf}%"></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${t('entryPrice')}</div>
        <div class="stat-value entry-price">${entry}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${t('expiry')}</div>
        <div class="stat-value" style="font-size:1rem">${expiry}</div>
      </div>
    </div>

    <!-- Gales Section -->
    <div class="gales-section">
      <div class="stat-label">${t('gales')}</div>
      <div class="gales-grid">
        <div class="gale-item">
          <span class="gale-label">${t('gale1')}</span>
          <span class="gale-time">${first}</span>
        </div>
        <div class="gale-item">
          <span class="gale-label">${t('gale2')}</span>
          <span class="gale-time">${second}</span>
        </div>
        <div class="gale-item">
          <span class="gale-label">${t('gale3')}</span>
          <span class="gale-time">${third}</span>
        </div>
      </div>
    </div>

    <div class="reasoning-box">
      <div class="stat-label">${t('reasoning')}</div>
      <p>${reasoning}</p>
    </div>
  `;

  el.classList.add('show');
}"""

js = js.replace(old_render_result, new_render_result)
print("6. Updated renderAnalysisResult with signal card format")

# ============================================================
# 6. Fix renderHistory to use correct field names (direction, confidence, gales, etc.)
# ============================================================

old_render_history_before = """function renderHistory() {
  const container = $('#historyContainer');
  if (!container) return;

  if (!STATE.uploads.length) {
    container.innerHTML = '<div class="history-empty">No analysis history yet. Upload a chart to get started.</div>';
    return;
  }

  container.innerHTML = STATE.uploads.map((upload) => {
    const a = upload.analysis_result || {};
    const dir = a.market_direction || 'unknown';
    const action = a.suggested_action || '\\u2014';
    const conf = a.confidence_percentage || 0;

    let dirEmoji = '\\u27a1\\ufe0f';
    if (dir === 'bullish') dirEmoji = '\\ud83d\\udfe2';
    else if (dir === 'bearish') dirEmoji = '\\ud83d\\udd34';
    else if (dir === 'sideways') dirEmoji = '\\ud83d\\udfe1';

    return `
      <div class="history-item" data-upload-id="${upload.id}">
        <div class="history-item-header">
          <div class="history-direction ${dir}">${dirEmoji} ${capitalize(dir)} \\u00b7 ${capitalize(action)}</div>
          <div class="history-meta">
            <span>${conf}% conf</span>
            <span>${timeAgo(upload.uploaded_at)}</span>
          </div>
        </div>
        <div class="history-expanded" id="historyDetail_${upload.id}">
          <div class="analysis-grid" style="margin-bottom:0">
            <div class="stat-card">
              <div class="stat-label">Direction</div>
              <div class="stat-value ${dir}">${capitalize(dir)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Confidence</div>
              <div class="stat-value">${conf}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Action</div>
              <div class="stat-value ${action}">${capitalize(action)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Entry Zone</div>
              <div class="stat-value" style="font-size:1rem;font-weight:600">${a.entry_zone || '\\u2014'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Stop Loss</div>
              <div class="stat-value" style="font-size:1rem;font-weight:600;color:var(--red)">${a.stop_loss || '\\u2014'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Take Profit</div>
              <div class="stat-value" style="font-size:1rem;font-weight:600;color:var(--green)">${a.take_profit || '\\u2014'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Analyzed</div>
              <div class="stat-value" style="font-size:0.85rem;font-weight:400">${formatDateFull(a.analyzed_at)}</div>
            </div>
            <div class="stat-card full-width">
              <div class="stat-label">Reasoning</div>
              <p style="font-size:0.85rem;line-height:1.6;color:var(--text-secondary);margin-top:4px">${a.reasoning || 'No reasoning available.'}</p>
            </div>
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
}"""

new_render_history = """function renderHistory() {
  const container = $('#historyContainer');
  if (!container) return;

  if (!STATE.uploads.length) {
    container.innerHTML = '<div class="history-empty">' + t('noHistory') + '</div>';
    return;
  }

  container.innerHTML = STATE.uploads.map((upload) => {
    const a = upload.analysis_result || {};
    const dir = (a.direction || 'HOLD').toUpperCase();
    const conf = a.confidence || 75;
    const pair = a.pair || 'USDINR-OTC';
    const entry = a.entry_price || '\\u2014';
    const gales = a.gales || {};

    const isCall = dir === 'CALL';
    const isPut = dir === 'PUT';
    const dirEmoji = isCall ? '\\ud83d\\udfe2' : isPut ? '\\ud83d\\udd34' : '\\ud83d\\udfe1';
    const dirLabel = isCall ? t('call') : isPut ? t('put') : t('hold');
    const dirColor = isCall ? 'bullish' : isPut ? 'bearish' : '';

    return `
      <div class="history-item" data-upload-id="${upload.id}">
        <div class="history-item-header">
          <div class="history-direction ${dirColor}">${dirEmoji} ${dirLabel} \\u00b7 ${pair}</div>
          <div class="history-meta">
            <span>${conf}% ${t('confidence').toLowerCase()}</span>
            <span>${timeAgo(upload.uploaded_at)}</span>
          </div>
        </div>
        <div class="history-expanded" id="historyDetail_${upload.id}">
          <div class="analysis-grid" style="margin-bottom:0">
            <div class="stat-card">
              <div class="stat-label">${t('direction')}</div>
              <div class="stat-value" style="color:${isCall ? 'var(--green)' : isPut ? 'var(--red)' : 'var(--yellow)'}">${dirEmoji} ${dirLabel}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('confidence')}</div>
              <div class="stat-value">${conf}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('pair')}</div>
              <div class="stat-value" style="font-size:1rem">${pair}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('entryPrice')}</div>
              <div class="stat-value" style="font-size:1rem;font-weight:600">${entry}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('signalTime')}</div>
              <div class="stat-value" style="font-size:0.95rem">${a.signal_time || '\\u2014\\u2014:\\u2014\\u2014'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('gale1')}</div>
              <div class="stat-value" style="font-size:0.95rem">${gales.first || '\\u2014\\u2014:\\u2014\\u2014'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('gale2')}</div>
              <div class="stat-value" style="font-size:0.95rem">${gales.second || '\\u2014\\u2014:\\u2014\\u2014'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('gale3')}</div>
              <div class="stat-value" style="font-size:0.95rem">${gales.third || '\\u2014\\u2014:\\u2014\\u2014'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('expiry')}</div>
              <div class="stat-value" style="font-size:0.95rem">${a.expiry || '5 min'}</div>
            </div>
            <div class="stat-card full-width">
              <div class="stat-label">${t('reasoning')}</div>
              <p style="font-size:0.85rem;line-height:1.6;color:var(--text-secondary);margin-top:4px">${a.reasoning || t('noReasoning')}</p>
            </div>
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
}"""

js = js.replace(old_render_history_before, new_render_history)
print("7. Updated renderHistory with correct field names")

# ============================================================
# 7. Fix renderAdminUploads to use correct field names
# ============================================================

old_admin_uploads = """      <td class="${a.market_direction || ''}">${capitalize(a.market_direction || '\\u2014')}</td>
        <td>${a.confidence_percentage || '\\u2014'}%</td>
        <td class="${a.suggested_action || ''}">${capitalize(a.suggested_action || '\\u2014')}</td>"""

new_admin_uploads = """      <td style="${a.direction === 'CALL' ? 'color:var(--green)' : a.direction === 'PUT' ? 'color:var(--red)' : ''}">${a.direction || '\\u2014'}</td>
        <td>${a.confidence || '\\u2014'}%</td>
        <td style="${a.direction === 'CALL' ? 'color:var(--green)' : a.direction === 'PUT' ? 'color:var(--red)' : ''}">${a.direction === 'CALL' ? 'BUY' : a.direction === 'PUT' ? 'SELL' : 'WAIT'}</td>"""

js = js.replace(old_admin_uploads, new_admin_uploads)
print("8. Updated renderAdminUploads with correct field names")

# ============================================================
# 9. Update dashboard section titles to use t() function
# ============================================================

# Update upload section title
js = js.replace("""          <h2>Chart Analysis</h2>
          <p>Upload a MetaTrader 4 screenshot for AI-powered market analysis</p>""", """          <h2>${t('chartAnalysis')}</h2>
          <p>${t('uploadDesc')}</p>""")

# Update upload area text
js = js.replace("""            <div class="upload-area-text">Drop your MT4 chart screenshot here or <strong>browse</strong></div>
            <div class="upload-area-hint">Supports PNG, JPG, JPEG, GIF, BMP, WEBP (max 10MB)</div>""", """            <div class="upload-area-text">${t('dropHere')} <strong>${t('browse')}</strong></div>
            <div class="upload-area-hint">${t('supports')}</div>""")

# Update button texts
js = js.replace("""            <button class="btn-secondary" id="cancelUploadBtn">Cancel</button>
            <button class="btn-analyze" id="analyzeBtn">Analyze Chart</button>""", """            <button class="btn-secondary" id="cancelUploadBtn">${t('cancel')}</button>
            <button class="btn-analyze" id="analyzeBtn">${t('analyzeChart')}</button>""")

# Update history section title
js = js.replace("""          <h2>Analysis History</h2>""", """          <h2>${t('analysisHistory')}</h2>""")

# Update showToast messages
js = js.replace("""      showToast('Analysis complete!', 'success');""", """      showToast(t('analysisComplete'), 'success');""")

js = js.replace("""    showToast(err.message || 'Analysis failed. Please try again.', 'error');""", """    showToast(err.message || t('failed'), 'error');""")

js = js.replace("""      showToast('Session expired. Please log in again.', 'error');""", """      showToast(t('sessionExpired'), 'error');""")

# Update analzye button dynamic text
js = js.replace("""    btn.innerHTML = '<span class="spinner"></span> Analyzing...';""", """    btn.innerHTML = '<span class="spinner"></span> ' + t('analyzing');""")

js = js.replace("""    btn.textContent = 'Analyze Chart';""", """    btn.textContent = t('analyzeChart');""")

print("9. Updated dashboard texts with t() function")

# ============================================================
# 10. Write the updated file
# ============================================================

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print(f"Written app.js: {len(js)} bytes")
print("DONE!")
