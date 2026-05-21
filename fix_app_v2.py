import os

# Read the current app.js
with open('public/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

print(f"Read app.js: {len(js)} bytes")

# ============================================================
# Find and replace the OLD renderAnalysisResult function
# The old function uses market_direction, suggested_action, entry_zone
# The new function should use direction, confidence, entry_price, gales
# ============================================================

# Find the exact old function by searching for its unique content
old_start_marker = 'function renderAnalysisResult(a) {'
old_end_marker = '// === ADMIN DASHBOARD ==='

idx_start = js.find(old_start_marker)
idx_end = js.find(old_end_marker, idx_start)

if idx_start == -1 or idx_end == -1:
    print("ERROR: Could not find old renderAnalysisResult function")
else:
    old_func = js[idx_start:idx_end]
    print(f"Found old function at {idx_start}-{idx_end}, length: {len(old_func)}")
    
    # Check if it still has the OLD fields (market_direction)
    has_old = 'market_direction' in old_func
    print(f"Has old fields (market_direction): {has_old}")
    
    if has_old:
        # Create the new function with signal card format
        new_func = '''function renderAnalysisResult(a) {
  const el = $('#analysisResult');
  if (!el) return;

  const dir = (a.direction || 'HOLD').toUpperCase();
  const conf = a.confidence || 75;
  const pair = a.pair || 'USDINR-OTC';
  const sigTime = a.signal_time || '--:--';
  const tz = a.timezone || 'UTC -3';
  const expiry = a.expiry || '5 min';
  const entry = a.entry_price || '---';
  const timeframe = a.timeframe || 'M5';
  const gales = a.gales || {};
  const first = gales.first || '--:--';
  const second = gales.second || '--:--';
  const third = gales.third || '--:--';
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
}
'''
        
        js = js[:idx_start] + new_func + js[idx_end:]
        print("Replaced old renderAnalysisResult with new signal card version")

# ============================================================
# Also fix the old renderHistory function if it still has old fields
# ============================================================

old_history_marker = 'function renderHistory()'
idx_history = js.find(old_history_marker)
if idx_history > 0:
    # Check if it has old fields
    check_old = js.find('a.market_direction', idx_history, idx_history + 3000)
    if check_old != -1:
        print(f"Found OLD renderHistory at {idx_history} with market_direction - need to check fix_app.py did its job")
    else:
        print("renderHistory already updated")

# ============================================================
# Also check analyzeChart for lang param
# ============================================================

idx_analyze = js.find("formData.append('chart', file)")
if idx_analyze > 0:
    # Check if lang append is right after
    after = js[idx_analyze:idx_analyze+100]
    if "append('lang'" in after:
        print("Lang param already added to upload")
    else:
        print(f"WARNING: Lang param not found after chart append")

# ============================================================
# Write updated file
# ============================================================

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print(f"Written app.js: {len(js)} bytes")
print("DONE!")
