# Deployment notes

- **Netlify publish directory:** Set to `public` (configured in netlify.toml).
- **Single-page app routing:** `public/_redirects` ensures client-side routes fall back to `index.html`.
- **Backend/API:** This repository includes a Node server (`server.js`) which Netlify does not run on static hosting. API endpoints, SQLite DB, and AI calls will not function on Netlify unless converted to serverless functions or deployed to a platform that supports Node servers (e.g., Render, Railway, Heroku).

Deploying the backend (recommended)
- The easiest way to run the full app (frontend + backend + persistent DB) is to deploy to a Node-capable host such as Render, Railway, or Heroku.
- Add these files if you push to a Git repo and connect the repo to the host:
	- `Procfile` — tells Heroku/Render how to start the app (`web: node server.js`).
	- `.gitignore` — excludes `node_modules`, local DB, and uploads.

Quick deploy instructions (Git + Render)
1. Commit the repo and push to GitHub:

```bash
git init
git add .
git commit -m "Prepare for deploy"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

2. Create a new Web Service on Render, choose 'Web Service', connect your repo, and set the build and start commands:
	 - Build command: (leave empty)
	 - Start command: `node server.js`
	 - Environment: set `PORT` (Render supplies it automatically) and any secrets like `DEEPSEEK_API_KEY`.

Render-specific manifest and steps
- A `render.yaml` manifest is included at the repo root. Replace the `repo` value with `https://github.com/<OWNER>/<REPO>` before using it, or let Render create services from the UI.
- Steps to deploy on Render (recommended):
	1. Push your repo to GitHub (see step 1 above).
	2. On Render dashboard, create a new Web Service and connect your GitHub repo.
	3. If you prefer, select "Create from render.yaml" and upload this repo's `render.yaml` (after replacing the repo placeholder).
	4. In the Render service settings, set environment variables:
		 - `DEEPSEEK_API_KEY` (your AI key)
		 - Any other secrets your app needs (e.g., `MASTER_ADMIN_CODE` override)
	5. (Optional) If you need persistent storage for SQLite, add a Persistent Disk under your service (or better: attach a managed Postgres database and migrate off SQLite).

Notes on persistence
- Render provides managed PostgreSQL as an add-on — I recommend migrating `access_codes` and `uploads` to Postgres and moving uploaded files to S3 or Render's object storage alternatives. I can help create a migration plan.

Quick deploy instructions (Heroku)
1. Install Heroku CLI and create an app:

```bash
heroku login
heroku create your-app-name
git push heroku main
heroku config:set DEEPSEEK_API_KEY=sk_xxx
```

Notes and caveats
- The app uses a local SQLite file (`theosign.db`) and `public/uploads/` for uploaded files. For production you should move to a managed database (Postgres) and object storage (S3) to avoid data loss or ephemeral disk issues on some hosts.
- If you'd rather host only the frontend on Netlify and convert the backend into serverless functions, I can refactor the API into functions and move persistent storage to an external DB/storage — tell me which path you prefer.

Continuous deploy with GitHub (recommended for safe updates)
- This repo includes a sample GitHub Actions workflow that runs on pushes to `main` and deploys to Heroku: `.github/workflows/deploy.yml`.
- Before using the workflow, add these repository secrets in GitHub Settings → Secrets:
	- `HEROKU_API_KEY` — your Heroku API key.
	- `HEROKU_APP_NAME` — the target Heroku app name.
	- `HEROKU_EMAIL` — the email for your Heroku account.

Safe update tips
- Use feature branches and pull requests. Protect `main` with branch protection rules and require the CI workflow to pass before merging.
- Keep environment-specific secrets in GitHub Secrets or the host's config (never commit them).
- Run quick smoke tests after deploy (open the app and hit a few API endpoints) to verify nothing broke.
- Consider migrating persistence to managed services (Postgres, S3) before scaling.

If you want, I can:
- Configure the repo for Render (I can add a `render.yaml` or step-by-step instructions).
- Convert the backend into serverless functions so the frontend stays on Netlify but APIs run in Functions.
- Add a lightweight test suite to protect against regressions.
