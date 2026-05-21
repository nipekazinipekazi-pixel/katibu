# Bug Fix & Analysis Output Format Plan

## Critical Bugs Found

### BUG #1: Chart Image Never Sent to AI (MAJOR)
**File:** [`server.js:162`](server.js:162)
```js
const analysis = await generateAIAnalysis(lang); // No image passed!
```
The uploaded chart image is saved to disk but **never passed** to the DeepSeek AI. The AI generates completely random/hallucinated analysis without seeing the actual chart. The `generateAIAnalysis()` function only takes `lang` parameter.

**Fix:** 
1. Read the uploaded image file from disk
2. Convert to base64
3. Use DeepSeek's vision API format to send the image alongside the analysis prompt
4. Pass the file path from the upload route into `generateAIAnalysis`

---

### BUG #2: Frontend/Backend Field Name Mismatch (MAJOR)
**Backend returns** ([`server.js:363-382`](server.js:363)):
```js
{ direction, confidence, entry_price, pair, signal_time, gales, reasoning, timeframe, expiry, timezone, direction_emoji, next_signal }
```

**Frontend expects** ([`public/app.js:607-609`](public/app.js:607)):
```js
a.market_direction       // backend returns: direction
a.confidence_percentage  // backend returns: confidence
a.suggested_action       // backend returns: direction (CALL/PUT/HOLD)
a.entry_zone             // backend returns: entry_price
a.stop_loss              // NOT RETURNED by backend
a.take_profit            // NOT RETURNED by backend
```

**Effect:** The analysis result will show dashes (—) for most fields because the frontend looks for wrong property names.

**Fix:** Rename backend JSON fields to match what frontend expects, OR rewrite both to match user's desired format.

---

### BUG #3: Wrong Timezone (MEDIUM)
**File:** [`server.js:350-353`](server.js:350)
Timezone is hardcoded to **UTC-3** everywhere — the AI prompt, signal_time calculation, and gales calculation. User wants **UTC**.

**Fix:** Replace `UTC-3` with `UTC` in:
- AI system prompt
- Timezone calculation in `generateAIAnalysis()`
- Fallback fallback object

---

### BUG #4: Gales/Signal Info Not Displayed (MEDIUM)
**File:** [`public/app.js:603-665`](public/app.js:603)
Backend returns `gales` (1st/2nd/3rd), `signal_time`, `next_signal`, `pair`, `timeframe`, `expiry`, `direction_emoji` — but **none** of these are rendered in `renderAnalysisResult()`.

**Fix:** Complete rewrite of `renderAnalysisResult()` to display signal card format.

---

### BUG #5: API Key Exposed (MEDIUM)
**File:** [`server.js:12`](server.js:12)
```js
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-fbb7008fec474bdaaee31971973fc796';
```

**Fix:** Remove the hardcoded fallback key so it only reads from environment variable.

---

### BUG #6: No Upload Cleanup (LOW)
**File:** [`server.js:156-169`](server.js:156)
Uploaded images accumulate in `public/uploads/` with no cleanup mechanism. Over time this fills disk space.

**Fix:** Add cleanup after successful AI analysis, or add a scheduled cleanup.

---

### BUG #7 & #8: Frontend Rendering
Complete rewrite of `renderAnalysisResult()` and `renderHistory()` to display the new signal card format.

---

## Desired Output Format

Based on user's example:

```
⏰ Time zone: UTC 
💰5 min Exp
EUR/USD-OTC 20:15:UP🟢  
  EUR/USD🇪🇺🇺🇸

1st GALE --> TIME UNTIL 20:20  
2nd GALE --> TIME UNTIL 20:25
3rd GALE -->TIME UNTIL 20:30
```

**Parsing this format:**
- Line 1: ⏰ Time zone: UTC
- Line 2: 💰5 min Exp (expiry)
- Line 3: `EUR/USD-OTC 20:15:UP🟢` → pair, signal_time, direction+emoji (all on one line with space separators)
- Line 4: `EUR/USD🇪🇺🇺🇸` → pair with flag
- Line 5: Empty
- Line 6: `1st GALE --> TIME UNTIL 20:20`
- Line 7: `2nd GALE --> TIME UNTIL 20:25`
- Line 8: `3rd GALE -->TIME UNTIL 20:30`

---

## Updated AI Prompt

The DeepSeek prompt needs to be updated to instruct the AI to return its analysis in this exact format (as a text block, not JSON), so the backend can parse it and render it correctly on the frontend.

---

## Implementation Order

1. **Fix Backend AI Integration** — Pass image to DeepSeek API, update prompt
2. **Fix Timezone** — Change UTC-3 to UTC
3. **Remove Hardcoded API Key** — Security fix
4. **Rewrite Frontend Analysis Display** — Match user's signal card format
5. **Rewrite History Display** — Show signal card format in history
6. **Add Image Cleanup** — Prevent disk bloat
7. **Test End-to-End** — Verify AI works and output matches format
