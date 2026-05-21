# Theo Sign — AI-Powered Forex Chart Analysis Platform

Real-time AI-driven Forex analysis. Upload MetaTrader 4 charts and receive probability-based trading insights with entry prices, gale levels, and confidence ratings.

## Architecture

| Component    | Platform  | Description                              |
|-------------|-----------|------------------------------------------|
| **Frontend** | Netlify   | Static HTML/CSS/JS served via `public/`  |
| **Backend API** | Vercel | Node.js Express API with SQLite database |
| **AI Analysis** | DeepSeek  | Optional — works without API key (simulated mode) |

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the server (frontend + backend together)
node server.js

# 3. Open in browser
open http://localhost:8080
```

**Demo codes:** `DEMO-1234` or `TRADE-5678`
**Admin code:** `KX92-ROOT`

### No DeepSeek API key needed!

The app now includes a **simulated analysis fallback**. When no `DEEPSEEK_API_KEY` is set, it generates realistic, deterministic analysis results based on the current time. This means the app works fully on localhost without any external API key.

To use real AI analysis, set the environment variable:
```bash
# Windows CMD
set DEEPSEEK_API_KEY=sk-your-key-here

# PowerShell
$env:DEEPSEEK_API_KEY="sk-your-key-here"

# Then start the server
node server.js
```

## Deploy to Netlify (Frontend)

### Option 1: Direct Git Connection (Easiest)

1. Push this repo to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. Go to [https://app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**

3. Connect your GitHub repo

4. Netlify auto-detects settings from [`netlify.toml`](netlify.toml):
   - **Publish directory:** `public`
   - **Build command:** (none needed)

5. Click **Deploy** — your site is live at `https://your-site.netlify.app`

### Option 2: GitHub Actions (Automated)

1. Get your Netlify credentials:
   - **NETLIFY_AUTH_TOKEN:** [https://app.netlify.com/user/applications#personal-access-tokens](https://app.netlify.com/user/applications#personal-access-tokens)
   - **NETLIFY_SITE_ID:** Netlify site settings → Site information → API ID

2. Add these as secrets in GitHub repo → **Settings** → **Secrets and variables** → **Actions**

3. Push to `main` — the workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) auto-deploys.

## Deploy to Vercel (Backend API)

The backend API must run on a Node-capable host. Vercel is ideal (free tier):

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel --prod
   ```

3. Set environment variable in Vercel dashboard:
   - `DEEPSEEK_API_KEY` (optional — app works without it)

4. Your API is live at `https://theo-sign.vercel.app/api`

### Update the frontend config

Once deployed, update [`public/config.js`](public/config.js) line with your actual Vercel URL:

```js
apiBase = 'https://your-project.vercel.app/api';
```

## Files Changed

| File | Change |
|------|--------|
| [`server.js`](server.js) | Added `generateSimulatedAnalysis()` fallback when no API key |
| [`api/index.js`](api/index.js) | Added `generateSimulatedAnalysis()` fallback (Vercel serverless) |
| [`public/config.js`](public/config.js) | **New** — Auto-detects Netlify/Vercel and sets API URL |
| [`public/app.js`](public/app.js:18) | Uses configurable `window.__API_BASE__` instead of hardcoded `/api` |
| [`public/index.html`](public/index.html:17) | Added `config.js` script before `app.js` |
| [`public/404.html`](public/404.html) | **New** — SPA routing fallback for static hosts |
| [`netlify.toml`](netlify.toml) | Existing — Netlify config (publish: `public`) |
| [`public/_redirects`](public/_redirects) | Existing — SPA fallback for Netlify |
| [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) | Netlify deployment workflow |
