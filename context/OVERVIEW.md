# Project Overview

> **Purpose:** orient an AI assistant on what this product is, the tech stack, and how to run it.

## What this product is

A full-stack web platform for GMAT (Focus Edition) practice. Users take timed mock tests or custom quizzes, get scored results with explanations, and track performance over time. Admins manage the question bank, users, and payments. Subscriptions are sold in INR via Razorpay.

The product is **practice-focused, not concept-teaching**: it's designed to complement existing prep, with intermediate-to-advanced learners as the core audience.

## Tech stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 18 + TypeScript, React Router 6, Ant Design 4, Tailwind 3, React Query, KaTeX | CRA-based (`react-scripts 5`). |
| Backend | Node.js + Express + TypeScript, Mongoose | `ts-node-dev` in dev. |
| DB | MongoDB (Mongoose models) | Local or Atlas; backup zip in repo root. |
| Auth | JWT (access + refresh) | `bcryptjs` for password hashing. Tokens currently in localStorage (security TODO). |
| Payments | Razorpay (Checkout v1) | INR; manual + automated flows; webhook not yet wired. |
| Analytics | Mixpanel (frontend) | Two services exist; consolidation pending. |
| Scraping | Puppeteer + `puppeteer-extra-plugin-stealth` | Used for question extraction from GMAT Club. |
| LLM | OpenAI SDK (currently); Claude planned | Used for question cleanup/explanation generation. Python helpers under `backend/src/scripts/v3_extraction/`. |
| Build/Run | `npm run dev` (backend), `npm start` (frontend) | Backend default port `5006`, frontend `3000`. |

## Repo layout

```
gmat-saas-platform/
├── README.md                       # Setup & overview
├── CLAUDE.md                       # Dev agent guide
├── LICENSE                         # MIT
├── context/                        # ← this directory (architecture reference)
├── backend/
│   ├── src/
│   │   ├── index.ts                # Express bootstrap
│   │   ├── models/                 # Mongoose schemas (User, QuestionBag*, Quiz, Payment, Subscription)
│   │   ├── routes/                 # /api/auth, /api/quiz, /api/question-bag-v2|v3, /api/payments, /api/admin
│   │   ├── middleware/             # authMiddleware, roleAuth (paid/admin checks)
│   │   ├── services/               # openaiService, paymentService, pdfProcessor
│   │   └── scripts/                # extraction, validation, seeding, audits
│   │       ├── di_extraction/      # DI-specific scrapers (Puppeteer + Python parsers)
│   │       └── v3_extraction/      # Generic v3 pipeline (RC, Quant)
│   ├── output/                     # Extracted JSON dumps (di_test_extraction.json, etc.)
│   ├── exports/                    # Generated CSV/JSON outputs
│   ├── materials/                  # Source spreadsheets (OG question bank xlsx)
│   ├── pdfs/                       # Source PDFs
│   └── mongo_backup/               # DB snapshot
└── frontend/
    └── src/
        ├── App.tsx                 # Routes
        ├── pages/                  # Home, Config, Quiz, GMATFocusQuiz, DIQuiz, Results, Review, DIReview, Admin, etc.
        ├── components/             # QuestionCard variants (PS, DS, CR, RC, GT, MSR, TPA), AdminPanel, Navbar, GMATFocusConfig, PaymentModal
        ├── services/               # api.ts (axios), authService, analytics/mixpanelService
        ├── context/                # AuthContext
        ├── hooks/                  # useAnalytics, etc.
        └── types/                  # quiz.ts (Question, SubQuestion, MSRSource), auth.ts
```

## API surface (high-level)

| Mount | Purpose |
|-------|---------|
| `/api/auth` | register, login, refresh, profile |
| `/api/quiz` | quiz config, save quiz attempt |
| `/api/quiz-items` | per-question quiz item records |
| `/api/files` | upload/download (PDF, Excel) — currently lax security |
| `/api/question-bag-v2` | primary question CRUD (PS/DS/CR/RC) |
| `/api/question-bag-v3` | enhanced model with DI sub-types and `passageId` for RC grouping |
| `/api/payments` | Razorpay order creation + verification |
| `/api/admin` | user management, analytics, audit |

## Dev commands

```bash
# Backend
cd backend
npm install
npm run dev               # ts-node-dev on PORT (default 5006)
npm run build             # tsc → dist/
npm run lint              # eslint (excludes scripts/)
npm run create-test-user  # seed test@example.com / password123

# Frontend
cd frontend
npm install
npm start                 # CRA dev server :3000
npm run build
```

Required env vars (backend `.env`):
```
MONGODB_URI=
PORT=5006
JWT_SECRET=
JWT_REFRESH_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
OPENAI_API_KEY=          # for AI cleanup scripts
```

Frontend `.env`: `REACT_APP_API_URL=http://localhost:5006/api`, `REACT_APP_MIXPANEL_TOKEN=...`.

## Current state notes (Jan 2026)

- Quiz core, GMAT Focus mock, Razorpay one-time payments, JWT auth, admin panel: **functional**.
- Webhooks, refunds, subscription expiry job, email notifications: **not yet implemented**.
- Question bank quality issues: ~254 truncated options, mixed answer formats, missing explanations.
- DI extraction (G&T / MSR / TPA): partially working; manual editor is the canonical path for new DI content.
- Lint / strict TS / console removal: tracked internally.
