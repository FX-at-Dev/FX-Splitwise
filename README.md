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
```

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

## Scripts

From backend directory:

```bash
npm run dev                # Start with nodemon
npm start                  # Start with node
npm run migrate:usernames  # Backfill usernames for older users
```

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
