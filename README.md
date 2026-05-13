# GMAT Focus Edition Practice Platform

A full-stack practice platform for the GMAT Focus Edition. Supports timed quizzes across Quantitative, Verbal (RC, CR), and Data Insights (DI) question types, an admin question bank, role-based access (free / paid tiers / admin), Razorpay-based payments, and Mixpanel analytics.

> **Status:** portfolio / demonstration project. Not currently hosted publicly. Clone or fork to run locally.

## Tech stack

- **Frontend:** React 18 + TypeScript, React Router, Tailwind, Axios
- **Backend:** Node.js + Express + TypeScript, ts-node-dev
- **Database:** MongoDB via Mongoose
- **Auth:** JWT (access + refresh) with role-based middleware
- **Payments:** Razorpay (manual + webhook flows)
- **Analytics:** Mixpanel

## Repo layout

```
backend/    Express API, Mongoose models, auth, payments, admin routes
frontend/   React SPA — quizzes, admin panel, payment UI
context/    Onboarding documentation (read these first if exploring)
```

See `context/OVERVIEW.md` and `CLAUDE.md` for a deeper tour of the codebase.

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB 6+ running locally (or a MongoDB Atlas connection string)

## Setup

```bash
git clone https://github.com/Piyush-Kumar96/Gmat-SaaS-Platform.git
cd Gmat-SaaS-Platform
```

### Backend

```bash
cd backend
npm install
cp .env.example .env     # fill in MONGODB_URI and JWT secrets at minimum
npm run dev              # starts on http://localhost:5006
```

### Frontend

```bash
cd ../frontend
npm install
cp .env.example .env     # REACT_APP_API_URL defaults to http://localhost:5006/api
npm start                # CRA dev server on http://localhost:3000
```

### Seeding a test user

```bash
cd backend
npm run create-test-user
# email: test@example.com
# password: password123
```

## Environment variables

**Backend** — see `backend/.env.example`:
- `MONGODB_URI` (required)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRY`, `JWT_REFRESH_EXPIRY` (required)
- `OPENAI_API_KEY` (optional — only needed by AI question/answer generation utilities)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (optional — only if exercising the payments flow)

**Frontend** — see `frontend/.env.example`:
- `REACT_APP_API_URL`
- `REACT_APP_MIXPANEL_TOKEN` (optional)
- `REACT_APP_RAZORPAY_KEY_ID` (optional)

## Question data

This repository ships **no question content**. The data layer is empty after a fresh install. To get a working demo:
1. Seed a test user (above) and log in.
2. Use the admin panel (`/admin`) to create questions manually via the Question Bank UI, or
3. Run the sample-question seed scripts under `backend/src/scripts/` (e.g. `createSampleQuestions.ts`).

## Notable features

- Free / monthly / quarterly / annual paid tiers gated by `requirePaidUser` middleware
- Admin-only Question Bank with v3 schema supporting Data Insights (DI) sub-types: Two-Part Analysis, Multi-Source Reasoning, Graphics Interpretation, Table Analysis, Data Sufficiency
- Manual + Razorpay-mediated payment flows with admin approval queue
- Mixpanel event tracking across the quiz lifecycle (`quiz_started`, `question_answered`, `quiz_completed`, etc.)
- Question quality validator — deterministic gate for ingest pipelines

## License

[MIT](./LICENSE) © Piyush Kumar
