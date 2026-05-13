# Claude / AI agent guide for this repo

> **Read this first.** Then load the files in `context/` in the order listed.

## What this repo is

A full-stack GMAT Focus Edition practice platform — React + Express + MongoDB with Razorpay billing, Mixpanel analytics, and a JWT-based auth/role layer.

## Cold-start reading list

1. `context/README.md` — index of the architecture docs.
2. `context/OVERVIEW.md` — tech stack, repo layout, dev commands.
3. `context/MODULES.md` — every page/route/module with file pointers.
4. `context/QUESTION_DATA_MODEL.md` — `QuestionBag` v1/v2/v3 Mongoose schemas with examples.

## Conventions

- **Edit `context/*.md` in place** when you find anything stale.
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

- `backend/.env` is gitignored — copy `.env.example` and fill it.
- Two Mixpanel services exist (`analytics.ts` and `mixpanelService.ts`); consolidation pending.
- No Sentence Correction questions; Focus Edition removed SC.

## When in doubt

The `.ts` source is authoritative for runtime behaviour. The `context/` docs orient you on architecture; the source is the ground truth for behaviour.
