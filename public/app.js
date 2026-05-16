// === Theo Sign - Frontend Application ===

const STATE = {
  currentView: 'landing',
  accessCode: null,
  isAdmin: false,
  selectedFile: null,
  currentAnalysis: null,
  uploads: [],
  adminCodes: [],
  adminUsers: [],
  adminUploads: [],
  adminAnalytics: null,
};

const API_BASE = '/api';

// === UTILITY ===
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
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateFull(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// === ROUTER ===
function navigateTo(view, data = {}) {
  STATE.currentView = view;
  renderApp(view, data);
}

// === API HELPER ===
async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (STATE.accessCode) {
    headers['Authorization'] = `Bearer ${STATE.accessCode}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    // Session expired or revoked
    if (STATE.currentView !== 'landing') {
      showToast('Session expired. Please log in again.', 'error');
      STATE.accessCode = null;
      STATE.isAdmin = false;
      navigateTo('landing');
      return null;
    }
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// === RENDER ENGINE ===
function renderApp(view) {
  const app = $('#app');
  app.innerHTML = '';

  switch (view) {
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
      renderLanding(app);
  }
}

// === LANDING PAGE ===
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
}

// === USER DASHBOARD ===
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
          <button class="btn-icon" id="refreshBtn" title="Refresh">↻</button>
          <button class="btn-logout" id="logoutBtn">Sign Out</button>
        </div>
      </header>

      <div class="dash-body">
        <!-- Upload Section -->
        <div class="upload-section">
          <h2>Chart Analysis</h2>
          <p>Upload a MetaTrader 4 screenshot for AI-powered market analysis</p>
          <div class="upload-area" id="uploadArea">
            <div class="upload-area-icon">📊</div>
            <div class="upload-area-text">Drop your MT4 chart screenshot here or <strong>browse</strong></div>
            <div class="upload-area-hint">Supports PNG, JPG, JPEG, GIF, BMP, WEBP (max 10MB)</div>
            <input type="file" id="fileInput" accept="image/png,image/jpeg,image/jpg,image/gif,image/bmp,image/webp" />
            <img class="upload-preview" id="uploadPreview" />
          </div>
          <div class="upload-actions" style="display:none" id="uploadActions">
            <button class="btn-secondary" id="cancelUploadBtn">Cancel</button>
            <button class="btn-analyze" id="analyzeBtn">Analyze Chart</button>
          </div>
        </div>

        <!-- Analysis Result -->
        <div class="analysis-result" id="analysisResult"></div>

        <!-- History -->
        <div class="history-section">
          <h2>Analysis History</h2>
          <div id="historyContainer"></div>
        </div>
      </div>
    </div>
  `;

  // Load history
  loadUserHistory();

  // Upload area logic
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

  // Logout
  $('#logoutBtn').addEventListener('click', () => {
    STATE.accessCode = null;
    STATE.isAdmin = false;
    navigateTo('landing');
  });

  // Refresh
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
    const dir = a.market_direction || 'unknown';
    const action = a.suggested_action || '—';
    const conf = a.confidence_percentage || 0;

    let dirEmoji = '➡️';
    if (dir === 'bullish') dirEmoji = '🟢';
    else if (dir === 'bearish') dirEmoji = '🔴';
    else if (dir === 'sideways') dirEmoji = '🟡';

    return `
      <div class="history-item" data-upload-id="${upload.id}">
        <div class="history-item-header">
          <div class="history-direction ${dir}">${dirEmoji} ${capitalize(dir)} · ${capitalize(action)}</div>
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
              <div class="stat-value" style="font-size:1rem;font-weight:600">${a.entry_zone || '—'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Stop Loss</div>
              <div class="stat-value" style="font-size:1rem;font-weight:600;color:var(--red)">${a.stop_loss || '—'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Take Profit</div>
              <div class="stat-value" style="font-size:1rem;font-weight:600;color:var(--green)">${a.take_profit || '—'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">5-min Movement Prob.</div>
              <div class="stat-value">${a.next_5min_movement_probability || '—'}%</div>
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

  // Add click-to-expand
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

  try {
    const data = await api('/upload', {
      method: 'POST',
      body: formData,
    });

    STATE.currentAnalysis = data.analysis;
    renderAnalysisResult(data.analysis);
    showToast('Analysis complete!', 'success');

    // Reset upload
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

    // Refresh history
    loadUserHistory();
  } catch (err) {
    showToast(err.message || 'Analysis failed. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyze Chart';
  }
}

function renderAnalysisResult(a) {
  const el = $('#analysisResult');
  if (!el) return;

  const dir = a.market_direction || 'unknown';
  const action = a.suggested_action || 'wait';
  const conf = a.confidence_percentage || 0;
  const prob = a.next_5min_movement_probability || 0;

  let confClass = 'medium';
  if (conf >= 80) confClass = 'high';
  else if (conf <= 70) confClass = 'low';

  let probClass = 'medium';
  if (prob >= 75) probClass = 'high';
  else if (prob <= 60) probClass = 'low';

  let dirArrow = '→';
  if (dir === 'bullish') dirArrow = '↑';
  else if (dir === 'bearish') dirArrow = '↓';

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
        <div class="stat-value" style="font-size:1.1rem">${a.entry_zone || '—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Stop Loss</div>
        <div class="stat-value" style="color:var(--red)">${a.stop_loss || '—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Take Profit</div>
        <div class="stat-value" style="color:var(--green)">${a.take_profit || '—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Next 5-min Movement Probability</div>
        <div class="stat-value">
          <span class="probability-badge ${probClass}">${prob}%</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Analysis Time</div>
        <div class="stat-value" style="font-size:0.9rem;font-weight:400">${formatDateFull(a.analyzed_at)}</div>
      </div>
    </div>
    <div class="reasoning-box">
      <div class="stat-label">AI Reasoning</div>
      <p>${a.reasoning || 'No reasoning provided.'}</p>
    </div>
  `;

  el.classList.add('show');
}

// === ADMIN DASHBOARD (Secret) ===
function renderAdminDashboard(container) {
  container.innerHTML = `
    <div class="admin-dash">
      <header class="dash-header" style="border-color: rgba(99,102,241,0.3)">
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
        <!-- Stats -->
        <div class="admin-stats" id="adminStats"></div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab active" data-tab="codes">Access Codes</button>
          <button class="tab" data-tab="users">Active Users</button>
          <button class="tab" data-tab="uploads">Upload History</button>
        </div>

        <!-- Content -->
        <div id="adminContent"></div>
      </div>
    </div>
  `;

  loadAdminData();

  // Tab switching
  container.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderAdminTabContent(tab.dataset.tab);
    });
  });

  // Logout
  $('#adminLogoutBtn').addEventListener('click', () => {
    STATE.accessCode = null;
    STATE.isAdmin = false;
    navigateTo('landing');
  });

  // Refresh
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
    default:
      container.innerHTML = '';
  }
}

function renderAdminCodes(container) {
  container.innerHTML = `
    <div class="admin-section">
      <h2>
        Access Codes
        <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400">${STATE.adminCodes.length} total</span>
      </h2>

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
    const isActive = !c.disabled;
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

  // Create code
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

  // Toggle / Delete actions
  tbody.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const code = btn.dataset.code;

      if (action === 'toggle') {
        const currentStatus = btn.classList.contains('danger');
        try {
          await api(`/admin/codes/${encodeURIComponent(code)}`, {
            method: 'PUT',
            body: JSON.stringify({ disabled: currentStatus ? 1 : 0 }),
          });
          showToast(`Code "${code}" ${currentStatus ? 'disabled' : 'enabled'}.`, 'info');
          loadAdminData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (action === 'delete') {
        if (!confirm(`Delete code "${code}"? This will also remove all associated uploads.`)) return;
        try {
          await api(`/admin/codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
          showToast(`Code "${code}" deleted.`, 'info');
          loadAdminData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

function renderAdminUsers(container) {
  container.innerHTML = `
    <div class="admin-section">
      <h2>Active Users</h2>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Usage Count</th>
              <th>Uploads</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="usersTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = $('#usersTableBody');
  tbody.innerHTML = STATE.adminUsers.map((u) => {
    const isActive = !u.disabled;
    return `
      <tr>
        <td style="font-family:monospace;font-weight:600;color:var(--text-primary)">${u.code}</td>
        <td><span class="${isActive ? 'active-status' : 'disabled-status'}">${isActive ? 'Active' : 'Disabled'}</span></td>
        <td>${u.usage_count}</td>
        <td>${u.upload_count}</td>
        <td>${u.last_active ? timeAgo(u.last_active) : 'Never'}</td>
        <td>
          <button class="btn-tiny ${isActive ? 'danger' : 'success'}" data-action="toggle-user" data-code="${u.code}">
            ${isActive ? 'Revoke' : 'Restore'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-action="toggle-user"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code;
      const shouldDisable = btn.classList.contains('danger');
      try {
        await api(`/admin/codes/${encodeURIComponent(code)}`, {
          method: 'PUT',
          body: JSON.stringify({ disabled: shouldDisable ? 1 : 0 }),
        });
        showToast(`Access ${shouldDisable ? 'revoked' : 'restored'} for "${code}".`, 'info');
        loadAdminData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderAdminUploads(container) {
  container.innerHTML = `
    <div class="admin-section">
      <h2>Upload History</h2>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Access Code</th>
              <th>File</th>
              <th>Direction</th>
              <th>Confidence</th>
              <th>Action</th>
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
    return `
      <tr>
        <td style="font-family:monospace;font-size:0.75rem">${u.id.slice(0, 8)}..</td>
        <td style="font-family:monospace;color:var(--text-primary)">${u.access_code}</td>
        <td>${u.original_name}</td>
        <td class="${a.market_direction || ''}">${capitalize(a.market_direction || '—')}</td>
        <td>${a.confidence_percentage || '—'}%</td>
        <td class="${a.suggested_action || ''}">${capitalize(a.suggested_action || '—')}</td>
        <td>${timeAgo(u.uploaded_at)}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">No uploads yet.</td></tr>';
}

// === INIT ===
navigateTo('landing');
