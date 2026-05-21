// === Theo Sign - Frontend Configuration ===
// Edit this file to configure your API backend URL.
//
// Vercel deployment (full-stack):
//   - Both frontend (static files from public/) and backend (api/index.js)
//     are served on the same Vercel domain.
//   - API_BASE_URL is always "/api" — no CORS issues.
//
// Local development:
//   - Run: node server.js
//   - API_BASE_URL is "/api" (uses the local Express server)

(function() {
  // When frontend and backend are on the same origin (Vercel),
  // a relative path avoids CORS entirely.
  window.__API_BASE__ = '/api';
})();
