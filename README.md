# FX Splitwise

![Status](https://img.shields.io/badge/status-active-success)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933)
![MongoDB](https://img.shields.io/badge/database-mongodb-47A248)
![Frontend](https://img.shields.io/badge/frontend-vanilla%20js-F7DF1E)

FX Splitwise is a Splitwise-style expense sharing platform for groups and personal spending.
It includes a static frontend and a Node.js + Express + MongoDB backend with JWT authentication.

## Why This Project Is Useful

- Track group and personal expenses in one place
- See net balances and simplified "who owes whom" suggestions
- Record settlements with cash or UPI and mark completion by recipient
- Manage group members with guardrails (member removal only when group balance is zero)
- Use username-based identity throughout group and settlement flows

## Project Structure

- frontend: HTML, CSS, and browser JavaScript pages
   - login, signup, dashboard, group, settlements
- backend: Express API with routes, controllers, models, middleware, and scripts
- index.html: project landing page

## Key Features

- JWT auth with signup/login/logout
- Forgot password + reset password token flow
- Group creation and member management
   - add member by username
   - remove member when their group balance is zero
- Expense management
   - group expenses
   - personal expenses
   - equal split flows in the current UI
- Dashboard summaries
   - total balance, owed/owing
   - recent activity and settlements
   - group debt summary
- Settlement workflow
   - create settlement by recipient username
   - recipient-only completion action

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB (local or hosted)

### 1) Install Backend Dependencies

```bash
cd backend
npm install
```

### 2) Configure Environment

Create backend/.env with at least:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_secret
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5500

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=20
EXPRESS_JSON_LIMIT=1mb
JWT_EXPIRES_IN=7d
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=30
RESET_PASSWORD_PATH=/forgot-password.html
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@your-domain.com
RESEND_FROM_NAME=FX Splitwise
```

Resend notes:

- Free plan: 3,000 emails/month and 100 emails/day.
- You need a verified sending domain or sender address for production delivery.
- In local development, the API still returns a reset link so you can test without email delivery.

CORS notes:

- `CLIENT_URL` should be your Netlify production URL.
- Optional: add extra origins (preview URLs, custom domains) with `CORS_ALLOWED_ORIGINS` as comma-separated URLs.

### 3) Run Backend API

From backend directory:

```bash
npm run dev
```

Or production-like local run:

```bash
npm start
```

Health check:

```bash
curl http://localhost:5000/health
```

### 4) Run Frontend

Serve the frontend directory through HTTP (do not open with file protocol):

- Use VS Code Live Server, or
- Any static server pointing to frontend

Then open the served login page.

## Quick Usage Flow

1. Sign up and log in
2. Create a group
3. Add members by username
4. Add group expenses (equal split with selected members)
5. Record settlements from Settlements page
6. Recipient marks settlement as completed
7. Review dashboard balances and group debt summaries

## API Overview

Auth:
- POST /signup
- POST /login
- POST /logout
- POST /password/forgot
- POST /password/reset

User:
- GET /profile
- GET /profile/summary

Groups:
- POST /group/create
- GET /groups
- GET /group/:id
- POST /group/add-member
- POST /group/remove-member

Expenses:
- POST /expense/add
- GET /expenses/group/:id
- GET /expenses/personal
- GET /group/:groupId/summary

Settlements:
- POST /settle
- GET /settlements
- PATCH /settlements/:id/mark-settled

Other:
- GET /notifications
- GET /activity/logs

Password reset notes:

- `POST /password/forgot` always returns a generic message to avoid account enumeration.
- The backend sends the reset email through Resend when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set.
- Open `frontend/forgot-password.html` to request and complete reset.

## Scripts

From backend directory:

```bash
npm run dev                # Start with nodemon
npm start                  # Start with node
npm run migrate:usernames  # Backfill usernames for older users
npm run import:expenses -- --file ../expenses.xlsx --sheet Expenses
```

## Bulk Import From Excel

You can import past transactions from an Excel workbook (`.xlsx`) using the backend script.

Run from backend directory:

```bash
npm run import:expenses -- --file ../your-workbook.xlsx --sheet Expenses
```

Validate before writing anything:

```bash
npm run import:expenses -- --file ../your-workbook.xlsx --sheet Expenses --dry-run
```

Required worksheet columns:

- `title`
- `amount`
- `paidByUsername`

Optional columns:

- `groupName` (must match existing group name)
- `memberUsernames` (comma-separated usernames for split members)
- `notes`
- `date`

Notes:

- If `groupName` is empty, expense is imported as personal expense.
- If `memberUsernames` is empty for group rows, all group members are used.
- Import currently creates equal splits.

## Where To Get Help

- Open an issue in this repository with:
   - expected behavior
   - actual behavior
   - reproducible steps
   - screenshots and request/response details when relevant
- For local setup problems, include:
   - Node version
   - MongoDB connection mode (local/hosted)
   - backend console logs

## Maintainers And Contribution

Maintainer:
- Repository owner and contributors

How to contribute:

1. Fork and create a feature branch
2. Keep changes focused and small
3. Run local checks and verify core flows
4. Submit a pull request with clear summary and test notes

Recommended contribution areas:
- Tests for core API flows
- Production deployment docs
- UI polish and accessibility improvements

## Production Notes

- Set NODE_ENV=production
- Use a strong JWT secret and managed MongoDB credentials
- Lock CLIENT_URL to deployed frontend origin
- Run backend behind a process manager and HTTPS reverse proxy
- Keep secrets out of version control

## Deployment Checklist (Netlify + Render)

1. Prepare backend env values (Render)
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN=7d`
   - `CLIENT_URL=https://<your-netlify-site>.netlify.app`
   - `CORS_ALLOWED_ORIGINS=https://<your-netlify-site>.netlify.app,https://<your-custom-domain>` (optional)
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `RESEND_FROM_NAME=FX Splitwise`
   - `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=30`
   - `RESET_PASSWORD_PATH=/forgot-password.html`

2. Deploy backend to Render
   - Use `render.yaml` in repo root.
   - Service root directory is `backend`.
   - Health check endpoint: `/health`.

3. Set frontend API base URL
   - Edit `frontend/js/runtime-config.js`.
   - Set `window.API_BASE_URL` to your Render API URL, for example `https://fx-splitwise-api.onrender.com`.

4. Deploy frontend to Netlify
   - Use `netlify.toml` in repo root (publish directory is `frontend`).
   - Deploy from repository root.

5. Post-deploy checks
   - Open frontend login page on Netlify.
   - Verify signup/login requests hit Render backend.
   - Verify forgot password sends email via Resend.
   - Verify reset link points to Netlify forgot-password page.
