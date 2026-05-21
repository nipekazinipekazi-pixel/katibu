import os

with open('public/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

print(f"Read app.js: {len(js)} bytes")

# ============================================================
# Remove any leftover surrogate pairs from previous failed writes
# Fix the surrogates by replacing with actual emoji characters
# ============================================================

# The issue is that Python wrote the literal text \ud83d\udfe2 instead of the actual emoji
# Python's '\ud83d\udfe2' in a string literal creates a surrogate pair which is invalid in UTF-8
# We need to use the actual emoji character

# Replace surrogate-escaped emojis with actual emoji characters
# \ud83d\udfe2 = 🟢, \ud83d\udd34 = 🔴, \ud83d\udfe1 = 🟡, \u00b7 = ·

# First, check if surrogates exist
import re
surrogate_count = 0
for i, c in enumerate(js):
    if 0xD800 <= ord(c) <= 0xDFFF:
        surrogate_count += 1
        if surrogate_count == 1:
            print(f"First surrogate at position {i}: {repr(c)}")

print(f"Found {surrogate_count} surrogate characters")

if surrogate_count > 0:
    # Find and replace the problematic section
    # The new_history function uses \ud83d\udfe2 etc which Python interprets as surrogates
    # Instead, we need to use actual Unicode emoji characters in the string
    
    # Let's find the range where surrogates are and inspect
    idx_history = js.find('function renderHistory()')
    if idx_history > 0:
        # Replace the entire function again with proper characters
        old_history_marker = 'function renderHistory() {'
        idx_start = js.find(old_history_marker)
        idx_end = js.find('async function analyzeChart', idx_start)
        
        if idx_start > 0 and idx_end > idx_start:
            old_history = js[idx_start:idx_end]
            print(f"Found renderHistory at {idx_start}-{idx_end}")
            
            # Use actual emoji characters directly
            green_circle = '\U0001F7E2'  # 🟢
            red_circle = '\U0001F534'    # 🔴
            yellow_circle = '\U0001F7E1' # 🟡
            middle_dot = '\u00B7'        # ·
            
            new_history = f'''function renderHistory() {{
  const container = $('#historyContainer');
  if (!container) return;

  if (!STATE.uploads.length) {{
    container.innerHTML = '<div class="history-empty">' + t('noHistory') + '</div>';
    return;
  }}

  container.innerHTML = STATE.uploads.map((upload) => {{
    const a = upload.analysis_result || {{}};
    const dir = (a.direction || 'HOLD').toUpperCase();
    const conf = a.confidence || 75;
    const pair = a.pair || 'USDINR-OTC';
    const entry = a.entry_price || '---';
    const gales = a.gales || {{}};
    const sigTime = a.signal_time || '';

    const isCall = dir === 'CALL';
    const isPut = dir === 'PUT';
    const dirEmoji = isCall ? '{green_circle}' : isPut ? '{red_circle}' : '{yellow_circle}';
    const dirLabel = isCall ? t('call') : isPut ? t('put') : t('hold');
    const dirColor = isCall ? 'bullish' : isPut ? 'bearish' : '';

    return `
      <div class="history-item" data-upload-id="${{upload.id}}">
        <div class="history-item-header">
          <div class="history-direction ${{dirColor}}">${{dirEmoji}} ${{dirLabel}} {middle_dot} ${{pair}}</div>
          <div class="history-meta">
            <span>${{conf}}% ${{t('confidence').toLowerCase()}}</span>
            <span>${{timeAgo(upload.uploaded_at)}}</span>
          </div>
        </div>
        <div class="history-expanded" id="historyDetail_${{upload.id}}">
          <div class="analysis-grid" style="margin-bottom:0">
            <div class="stat-card">
              <div class="stat-label">${{t('direction')}}</div>
              <div class="stat-value" style="color:${{isCall ? 'var(--green)' : isPut ? 'var(--red)' : 'var(--yellow)'}}">${{dirEmoji}} ${{dirLabel}}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${{t('confidence')}}</div>
              <div class="stat-value">${{conf}}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${{t('pair')}}</div>
              <div class="stat-value" style="font-size:1rem">${{pair}}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${{t('entryPrice')}}</div>
              <div class="stat-value" style="font-size:1rem;font-weight:600">${{entry}}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${{t('signalTime')}}</div>
              <div class="stat-value" style="font-size:0.95rem">${{sigTime || '--:--'}}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${{t('gale1')}}</div>
              <div class="stat-value" style="font-size:0.95rem">${{gales.first || '--:--'}}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${{t('gale2')}}</div>
              <div class="stat-value" style="font-size:0.95rem">${{gales.second || '--:--'}}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${{t('gale3')}}</div>
              <div class="stat-value" style="font-size:0.95rem">${{gales.third || '--:--'}}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${{t('expiry')}}</div>
              <div class="stat-value" style="font-size:0.95rem">${{a.expiry || '5 min'}}</div>
            </div>
            <div class="stat-card full-width">
              <div class="stat-label">${{t('reasoning')}}</div>
              <p style="font-size:0.85rem;line-height:1.6;color:var(--text-secondary);margin-top:4px">${{a.reasoning || t('noReasoning')}}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }}).join('');

  container.querySelectorAll('.history-item').forEach((item) => {{
    item.addEventListener('click', () => {{
      const detail = item.querySelector('.history-expanded');
      detail.classList.toggle('show');
    }});
  }});
}}
'''
            js = js[:idx_start] + new_history + js[idx_end:]
            print("Replaced renderHistory with proper emoji characters")
    
    # Also fix renderAnalysisResult if it has surrogates
    idx_analysis = js.find('function renderAnalysisResult(a)')
    if idx_analysis > 0:
        # Check for surrogates in this section
        end_analysis = js.find('\n//', idx_analysis + 10)
        section = js[idx_analysis:idx_analysis+3000]
        # Just recount surrogates
        for c in section:
            if 0xD800 <= ord(c) <= 0xDFFF:
                print(f"Still has surrogates in renderAnalysisResult")
                break
        else:
            print("renderAnalysisResult is clean")

# Remove any remaining surrogates by replacing with empty string or actual chars
cleaned = []
i = 0
while i < len(js):
    c = js[i]
    if 0xD800 <= ord(c) <= 0xDFFF:
        # This is a surrogate - try to read the pair
        if 0xD800 <= ord(c) <= 0xDBFF and i+1 < len(js) and 0xDC00 <= ord(js[i+1]) <= 0xDFFF:
            # Valid surrogate pair, extract the codepoint
            codepoint = 0x10000 + (ord(c) - 0xD800) * 0x400 + (ord(js[i+1]) - 0xDC00)
            cleaned.append(chr(codepoint))
            i += 2
        else:
            # Lone surrogate, can't convert safely
            cleaned.append('?')
            i += 1
    else:
        cleaned.append(c)
        i += 1

js = ''.join(cleaned)
print(f"After cleaning surrogates: {len(js)} bytes")

# ============================================================
# Write
# ============================================================
with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Written successfully!")
print("DONE!")
