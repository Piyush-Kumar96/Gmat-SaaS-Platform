# Claude / AI agent guide for this repo

> **Read this first.** Then load the files in `context/` in the order listed.

## What this repo is

A full-stack GMAT Focus Edition practice platform — React + Express + MongoDB with Razorpay billing, Mixpanel analytics, and Puppeteer-based question scraping. See `context/OVERVIEW.md`.

## Cold-start reading list (do this in order)

1. `context/README.md` — index of the AI context bundle.
2. `context/OVERVIEW.md` — tech stack, repo layout, dev commands.
3. `context/GMAT_EXAM.md` — what GMAT Focus is, every question type, scoring.
4. `context/USERS.md` — four personas: free user, paid user, admin, question-bank editor.
5. `context/MODULES.md` — every page/route/module with file pointers.
6. `context/QUESTION_DATA_MODEL.md` — `QuestionBag` v1/v2/v3 schemas with examples.
7. `context/QUESTION_SOURCING.md` — extraction pipelines, status per type, living findings log.
8. `context/QA_validator.md` — deterministic question quality gate: rules, drop rates, feature flag, roadmap.
9. `DI_EDITOR_PLAN.md` (project root) — current implementation plan for the manual DI question creator/editor.

Other useful docs at the project root:
- `PROJECT_PLAN_2026.md` — long-form roadmap (lint, payments, security, analytics).
- `GMAT_FOCUS_FEATURES.md` — implementation notes on the Focus Edition.
- `DI Question Extraction strategy v2.md` — most recent DI extraction analysis.
- `DS extractions.md` — earlier DI scraping plan.

## Conventions

- **Edit `context/*.md` in place** when you find anything stale. These are the canonical onboarding docs.
- `context/QUESTION_SOURCING.md` has an **append-only findings log** — add new dated entries above existing ones.
- Question schema lives in `backend/src/models/QuestionBagV3.ts`. Prefer V3 for new code; V2 remains for non-DI legacy.
- Front-end question type code is in `frontend/src/components/<Type>QuestionCard.tsx`. Render router: `frontend/src/components/QuestionCard.tsx`.
- Routes: `/api/question-bag-v3` for DI + new RC; `/api/question-bag-v2` for older non-DI; `/api/admin` for admin ops; `/api/payments` for Razorpay.
- Auth roles: `'guest' | 'registered' | 'monthly_pack' | 'quarterly_pack' | 'annual_pack' | 'admin'`. Paid-tier middleware is `requirePaidUser` in `backend/src/middleware/roleAuth.ts`.

## Commands

```bash
# Backend
cd backend && npm run dev              # ts-node-dev on :5006
cd backend && npm run lint             # eslint
cd backend && npm run create-test-user # seed test@example.com / password123

# Frontend
cd frontend && npm start               # CRA dev :3000
cd frontend && npm run build
```

## Watch-outs

- `backend/.env` is real (not committed). Don't print secrets.
- Two Mixpanel services exist (`analytics.ts` and `mixpanelService.ts`); consolidation pending.
- JWT secrets fall back to dev defaults — don't rely on those in production code.
- DI extraction is unreliable for G&T (Yes/No), MSR, TPA — manual editor (planned in `DI_EDITOR_PLAN.md`) is the canonical path for new DI content.
- No Sentence Correction questions; Focus Edition removed SC.

## When in doubt

The `.ts` source is authoritative for runtime behaviour. The `context/` docs are authoritative for *intent* and *current status*. If the two disagree, fix the doc.
