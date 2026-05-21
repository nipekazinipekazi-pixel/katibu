// === Theo Sign - Frontend Configuration ===
// Edit this file to configure your API backend URL.
//
// The script auto-detects the hosting environment and sets the correct API URL.
//
// Netlify deployment:
//   - Frontend is served from Netlify
//   - Backend API runs on Vercel (https://theo-sign.vercel.app/api)
//   - Connect your GitHub repo to Netlify for auto-deployment
//
// Local development:
//   - Run: node server.js
//   - API_BASE_URL is "/api" (uses the local Express server)
//
// Vercel deployment (full-stack):
//   - Both frontend and backend on Vercel
//   - API_BASE_URL stays as "/api"

(function() {
  let apiBase = '/api';

  const hostname = window.location.hostname;

  // Detect Netlify deployment
  const isNetlify = hostname.includes('netlify.app') || 
                    hostname === 'theo-sign.netlify.app' ||
                    document.querySelector('meta[name="netlify"]') !== null;

  // Detect GitHub Pages deployment
  const isGitHubPages = hostname.includes('github.io') || hostname.endsWith('.github.io');

  if (isNetlify || isGitHubPages) {
    // When hosted on Netlify (or GitHub Pages), the `_redirects` file proxies
    // /api/* requests to the Vercel backend server-side, so we use a relative
    // path. This avoids CORS errors entirely — the browser talks to its own origin.
    apiBase = '/api';
    console.log('[Theo Sign] Detected static hosting. Using proxied API:', apiBase);
  }

  // Make it globally available
  window.__API_BASE__ = apiBase;
})();
