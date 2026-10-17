# SupportDesk

**A customer support workspace built by Riya Singh.**

SupportDesk helps a team keep customer questions, replies, assignments, and resolution status together. The project has a React website, a FastAPI API, and a PostgreSQL database.

## What the application includes

- Create a workspace and its first administrator account.
- Sign in with an email address and password.
- Add agent accounts from the administrator's Team page.
- Create, search, filter, assign, and update support tickets.
- Add replies to ticket conversations.
- See ticket totals and recent activity on the overview screen.
- Keep each organization's data separate.

This release does not include email verification, password recovery, multi-factor sign-in, invitations by email, notifications, attachments, or automated backups. Review the security and recovery needs before using it for sensitive customer information.

## Publish the website

The website is hosted on Vercel. Render hosts the Python API and PostgreSQL database. These services run directly on their hosts; Docker is not needed. Hosting providers may charge for the database or other services. Render's free web service can go to sleep when unused, while its free PostgreSQL database expires after 30 days. The included Render setup uses a paid database plan so stored ticket data is not placed in an expiring free database.

### 1. Put the project on GitHub

Create an empty repository on GitHub. From PowerShell in this project folder, run these commands once, replacing the example address with your repository's address:

```powershell
git init
git add .
git commit -m "Prepare SupportDesk deployment"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/YOUR-REPOSITORY.git
git push -u origin main
```

The `.gitignore` file excludes local environment files, so your `.env` secrets are not added by `git add .`. Before pushing, review the file list and make sure no secret values were added to tracked files.

### 2. Deploy the website on Vercel

1. Sign in to Vercel and import your GitHub repository.
2. Set the **Root Directory** to `frontend`.
3. Use the Vite preset, build command `npm run build`, and output folder `dist`.
4. Deploy once. This first deployment gives you the public website address.

The `frontend/vercel.json` file lets Vercel serve the React app if someone opens a site path directly. The website's API address is configured in a later step.

### 3. Deploy the API and database on Render

1. In Render, create a new **Blueprint** from the same GitHub repository. Render reads the root `render.yaml` file.
2. When asked for `CORS_ORIGINS`, enter your Vercel website's full origin, for example `https://your-project.vercel.app` (no path and no trailing slash).
3. Review the plan and cost shown by Render, then create the resources. The Blueprint creates a Python API and PostgreSQL database, runs Alembic migrations, and checks `/ready`.
4. Copy the API's public `onrender.com` address from its Render page. The API health URL is that address plus `/health`.

The API is on Render's free web-service plan and may take about a minute to wake after being idle. The PostgreSQL database uses Render's smallest paid plan to avoid free-database expiration. Render's dashboard shows the current price before you confirm deployment.

### 4. Connect the website to the API

In Vercel, open the project's **Settings → Environment Variables** and add:

```text
VITE_API_BASE_URL=https://your-api.onrender.com
```

Use your actual Render API address, with no `/api/v1` suffix. Apply the variable to Production, then redeploy the Vercel project. Its value is included in the public website bundle, so this variable must contain only the API's public address, never a password or secret.

### 5. Check the live app

- Open the Vercel website address. The sign-in and workspace registration screen should appear.
- Open `https://your-api.onrender.com/health`. It should return `{"status":"ok"}`.
- Open `https://your-api.onrender.com/ready`. It should return `{"status":"ready"}` after the database is available and migrations have run.
- Create a workspace on the website to check that the browser can reach the API and save data.

If browser requests fail, confirm that `VITE_API_BASE_URL` is the right API address and Render's `CORS_ORIGINS` exactly matches the Vercel website origin. Redeploy the service after changing environment settings.

## Run locally without Docker

Local development needs Python 3.11 or newer, Node.js compatible with Vite 8, npm, and a PostgreSQL server. Install PostgreSQL on the computer or use a hosted PostgreSQL database. Git is only needed to download or publish the project.

1. In PowerShell at the project root, copy the safe example settings to the backend's private local settings file:

   ```powershell
   Copy-Item .env.example backend/.env
   ```

2. Open `backend/.env` and set `DATABASE_URL` to your PostgreSQL address. Change the example password. Generate a local signing secret with:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Copy the generated value into `SECRET_KEY` in `backend/.env`. Do not commit `backend/.env`.

3. In a PowerShell terminal, install the backend and prepare the database:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -e ".[dev]"
   alembic upgrade head
   uvicorn app.main:app --reload
   ```

   Keep that terminal open. In a second terminal, start the website:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

4. Visit <http://localhost:5173>. The Vite development server forwards API and health requests to `http://localhost:8000`.

## Checks

Backend, from `backend` after installing the development dependencies:

```powershell
ruff check .
pytest
```

Frontend, from `frontend` after `npm ci`:

```powershell
npm run lint
npm run typecheck
npm run build
```

## Where files live

- `frontend/src/` contains the React screens, API client, shared types, and styles.
- `frontend/vercel.json` configures Vercel to serve the React single-page app.
- `backend/app/` contains the FastAPI application, settings, database models, and API routes.
- `backend/migrations/` contains versioned database schema changes.
- `backend/tests/` contains automated backend checks.
- `render.yaml` describes the Python API and managed PostgreSQL resources for Render.
- `.env.example` is a safe template for local settings. The real `backend/.env` stays private.
- `PROJECT_SPEC.md` describes the product scope and technology choices.
