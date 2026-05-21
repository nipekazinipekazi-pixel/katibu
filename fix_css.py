import os

# Read current CSS
with open('public/styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

print(f"Read CSS: {len(css)} bytes")

# ================================================
# 1. Update color scheme to match screen.png
# screen.png dominant colors: #051424 (primary), #010F1F (secondary), #152132 (card/border)
# Keep accent as is for visibility
# ================================================

# Update :root colors to match the dark blue scheme of screen.png
old_root = """:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #111118;
  --bg-card: #16161f;
  --bg-input: #1a1a28;
  --bg-hover: #1f1f32;
  --border: #2a2a40;
  --border-focus: #6366f1;
  --text-primary: #e8e8f0;
  --text-secondary: #8888a0;
  --text-muted: #555570;
  --accent: #6366f1;
  --accent-hover: #5457e0;
  --accent-glow: rgba(99, 102, 241, 0.15);
  --green: #22c55e;
  --green-bg: rgba(34, 197, 94, 0.1);
  --red: #ef4444;
  --red-bg: rgba(239, 68, 68, 0.1);
  --yellow: #eab308;
  --yellow-bg: rgba(234, 179, 8, 0.1);
  --blue: #3b82f6;
  --blue-bg: rgba(59, 130, 246, 0.1);
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --transition: 0.2s ease;
}"""

new_root = """:root {
  --bg-primary: #051424;
  --bg-secondary: #010F1F;
  --bg-card: #0a1a2e;
  --bg-input: #0d1f36;
  --bg-hover: #112540;
  --border: #1a3050;
  --border-focus: #4f8cff;
  --text-primary: #e8f0f8;
  --text-secondary: #8899b0;
  --text-muted: #4a6080;
  --accent: #4f8cff;
  --accent-hover: #3a7aee;
  --accent-glow: rgba(79, 140, 255, 0.15);
  --green: #22c55e;
  --green-bg: rgba(34, 197, 94, 0.1);
  --red: #ef4444;
  --red-bg: rgba(239, 68, 68, 0.1);
  --yellow: #eab308;
  --yellow-bg: rgba(234, 179, 8, 0.1);
  --blue: #3b82f6;
  --blue-bg: rgba(59, 130, 246, 0.1);
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;
  --shadow: 0 4px 24px rgba(0,0,0,0.5);
  --transition: 0.2s ease;
}"""

css = css.replace(old_root, new_root)
print("1. Updated color scheme to match screen.png")

# ================================================
# 2. Add language toggle styles after .error-msg.show
# ================================================

old_after_error = """/* === DASHBOARD === */"""

new_after_error = """/* === LANGUAGE TOGGLE === */
.lang-toggle-top {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  gap: 4px;
  background: rgba(1, 15, 31, 0.8);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px;
}

.lang-btn {
  padding: 5px 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 4px;
  transition: all var(--transition);
  letter-spacing: 0.5px;
}

.lang-btn.active {
  background: var(--accent);
  color: #fff;
}

.lang-btn:hover:not(.active) {
  color: var(--text-secondary);
}

.dash-header .lang-btn {
  width: auto;
  height: auto;
  padding: 5px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 4px;
}

.dash-header .lang-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

/* === DASHBOARD === */"""

css = css.replace(old_after_error, new_after_error)
print("2. Added language toggle styles")

# ================================================
# 3. Add signal card styles before the responsive section
# ================================================

# Find position before responsive section
old_before_responsive = """/* === RESPONSIVE === */"""

new_signal_card_styles = """/* === SIGNAL CARD === */
.signal-card {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.signal-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: 50px;
  font-weight: 700;
  font-size: 1.1rem;
  align-self: flex-start;
}

.signal-badge.CALL {
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.signal-badge.PUT {
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.signal-badge.HOLD {
  background: var(--yellow-bg);
  color: var(--yellow);
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.signal-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
}

.signal-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sig-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 500;
}

.sig-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.entry-price {
  font-size: 1.4rem !important;
  font-weight: 800 !important;
  color: var(--accent);
  letter-spacing: 0.5px;
}

/* === GALES SECTION === */
.gales-section {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
  margin-bottom: 16px;
}

.gales-section .stat-label {
  margin-bottom: 10px;
}

.gales-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.gale-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.gale-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 500;
}

.gale-time {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
  font-family: monospace;
}

/* History direction colors */
.history-direction.bullish { color: var(--green); }
.history-direction.bearish { color: var(--red); }

/* === RESPONSIVE === */"""

css = css.replace(old_before_responsive, new_signal_card_styles)
print("3. Added signal card and gales styles")

# ================================================
# 4. Write the updated CSS
# ================================================

with open('public/styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print(f"Written CSS: {len(css)} bytes")
print("DONE!")
