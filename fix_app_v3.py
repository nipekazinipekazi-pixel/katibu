import os

with open('public/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

print(f"Read app.js: {len(js)} bytes")

# ============================================================
# Find and replace old renderHistory function
# Look for function renderHistory() and replace everything until
# the next function/comment at root level
# ============================================================

old_history_marker = 'function renderHistory() {'
idx_start = js.find(old_history_marker)

# Find the end - look for 'async function analyzeChart' or similar
idx_end = js.find('async function analyzeChart', idx_start)

if idx_start > 0 and idx_end > idx_start:
    old_history = js[idx_start:idx_end]
    print(f"Found renderHistory at {idx_start}-{idx_end}, length: {len(old_history)}")
    
    # Check if it still has old fields
    has_old = 'market_direction' in old_history
    print(f"Has old fields: {has_old}")
    
    if has_old:
        new_history = '''function renderHistory() {
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
    const entry = a.entry_price || '---';
    const gales = a.gales || {};
    const sigTime = a.signal_time || '';

    const isCall = dir === 'CALL';
    const isPut = dir === 'PUT';
    const dirEmoji = isCall ? '\ud83d\udfe2' : isPut ? '\ud83d\udd34' : '\ud83d\udfe1';
    const dirLabel = isCall ? t('call') : isPut ? t('put') : t('hold');
    const dirColor = isCall ? 'bullish' : isPut ? 'bearish' : '';

    return `
      <div class="history-item" data-upload-id="${upload.id}">
        <div class="history-item-header">
          <div class="history-direction ${dirColor}">${dirEmoji} ${dirLabel} \u00b7 ${pair}</div>
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
              <div class="stat-value" style="font-size:0.95rem">${sigTime || '--:--'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('gale1')}</div>
              <div class="stat-value" style="font-size:0.95rem">${gales.first || '--:--'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('gale2')}</div>
              <div class="stat-value" style="font-size:0.95rem">${gales.second || '--:--'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${t('gale3')}</div>
              <div class="stat-value" style="font-size:0.95rem">${gales.third || '--:--'}</div>
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
}
'''
        js = js[:idx_start] + new_history + js[idx_end:]
        print("Replaced old renderHistory")
    else:
        print("renderHistory already updated")
else:
    print(f"Could not find renderHistory bounds: idx_start={idx_start}, idx_end={idx_end}")

# ============================================================
# Check and fix admin uploads table
# ============================================================

if 'a.market_direction' in js:
    print("WARNING: Still has market_direction references!")
else:
    print("No more market_direction references - good!")

# ============================================================
# Write
# ============================================================
with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print(f"Written app.js: {len(js)} bytes")
print("DONE!")
