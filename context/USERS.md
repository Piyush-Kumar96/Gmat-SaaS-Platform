# User Personas

> **Purpose:** the four kinds of humans who interact with this product. Use these to frame UX, copy, and feature scope decisions.

The product surfaces **four roles**:

1. End user (free / registered)
2. End user (paid subscriber)
3. Admin
4. Question-bank editor (today: same DB role as `admin`, distinct hat)

Roles in code: `'guest' | 'registered' | 'monthly_pack' | 'quarterly_pack' | 'annual_pack' | 'admin'` (see `backend/src/models/User.ts`).

---

## 1. End user — Free / Registered

**Who:** GMAT aspirant evaluating the platform before paying.

- **Background:** Intermediate-to-advanced GMAT student who has already studied core concepts elsewhere (Manhattan Prep, e-GMAT, OG, YouTube). They are *not* learning fundamentals here — they want **realistic practice** and **performance feedback**.
- **Demographics:** Mostly 22–32, Indian market primary (pricing in ₹), aspiring to top US/EU/India MBA programs (target score 645–745).
- **Goals:**
  - Try a free or limited mock to gauge platform quality.
  - Decide whether to upgrade.
- **What they can do (current limits):** 2 mock tests by default (`mockTestLimit: 2`), limited question types, basic tracking. (Brochure copy in `HomePage.tsx` mentions "100 practice questions, basic tracking, limited question types" for the free tier.)
- **Frustration triggers:** broken question rendering, truncated options, missing explanations, login friction.
- **What they need from us:** trust signals — clean UI, accurate questions, working timer, plausible scoring.

## 2. End user — Paid subscriber

**Who:** Same persona as above, post-conversion. Three plan tiers (`monthly_pack`, `quarterly_pack`, `annual_pack`).

- **Plan economics (Indian market, INR):**
  - Monthly Pack — ₹1,500 / 1 month / unlimited mocks
  - Quarterly Pack — ₹3,500 / 3 months / unlimited mocks
  - Annual Pack — ₹6,000 / 1 year / unlimited mocks
- **HomePage.tsx** also displays a USD-equivalent brochure ($15 / $45 / $140) — that copy is presentational; the live billing is INR via Razorpay.
- **Goals:**
  - Take many mocks under realistic timing.
  - Use Custom Quiz to drill weak areas.
  - Review past results, learn from explanations.
  - Track progress toward target score.
- **What they can do:** unlimited mocks, all question types, full review/explanations, all section orders for GMAT Focus.
- **Frustration triggers:** payment failures (no webhook → mismatched activations), expiry confusion (no email reminders yet), data quality regressions in newly-added DI questions.
- **What they need from us:** dependable payment + activation, clear plan expiry, trustworthy question bank, fast review flows.

## 3. Admin

**Who:** Operator/founder running the platform. Today this is effectively one person plus Claude.

- **Role in DB:** `role: 'admin'`. Bypasses paid checks, accesses `/admin` page (`AdminPanel.tsx`).
- **Goals:**
  - Onboard / suspend / refund / upgrade users.
  - Watch revenue and conversion.
  - Investigate edge cases (failed payments, plan disputes).
  - Manually extend plans when needed.
- **What they can do:** user search by email, basic user table, view subscription, manual payment recording, basic analytics (total revenue, signups, plan distribution).
- **Surface:** `frontend/src/components/AdminPanel.tsx` (~52 KB single file — to be refactored), `backend/src/routes/adminRoutes.ts`.
- **Pain points (current):** no advanced filters, no audit log, no bulk ops, no export, payment dashboard is partial.

## 4. Question-bank editor

**Who:** Same human as Admin today, but a distinct hat — the role responsible for **content quality**, not user/billing operations. May expand to a non-admin editor role in the future.

- **Goals:**
  - Add new questions (PS, DS, CR, RC, DI-*) into the question bank.
  - Review imported / scraped questions and approve, fix, or reject.
  - Fix truncated options, normalize answers, write/improve explanations.
  - Tag, categorize, set difficulty.
  - Group RC questions by passage; group MSR sub-questions by source set.
- **Today's tools:**
  - `frontend/src/pages/ReviewPage.tsx` — inline edit for non-DI questions (CR/RC/PS/DS) — works.
  - `frontend/src/pages/DIReviewPage.tsx` — DI-specific review surface — partial.
  - Backend scripts under `backend/src/scripts/` — extraction, validation, fixers (developer-only).
- **Why a manual creator/editor is being added (as of Feb 2026):** automated extraction (Puppeteer + GPT) only works ~50–70% for DI because of the complex interaction patterns (Yes/No tables, TPA columns, MSR tabs) and inconsistent HTML. The non-DI editor works fine. **The manual DI question editor (planned in `DI_EDITOR_PLAN.md`) closes the gap.**
- **Workflow they need:**
  1. Pick a question type (DI-DS, DI-GT yes/no, DI-GT MC, DI-GT dropdown, DI-MSR, DI-TPA).
  2. Form-fill the question, options/statements/columns/sources, correct answers, optional explanation.
  3. Optionally upload artifact images / paste artifact HTML tables.
  4. Preview rendered card.
  5. Save → directly into `QuestionBagV3`.
- **Frustration triggers:** schema rigidity that doesn't fit the actual question (e.g., forcing Yes/No into A–E), losing draft on navigation, no way to clone an existing question as a starting point.

---

## Persona-driven design rules

- **End users**: minimize chrome, prioritize timing/clarity, no admin terminology in UI.
- **Paid users**: surface plan/expiry, never gate previously-allowed features without warning.
- **Admin**: dashboards over tables, bulk actions, exports, audit trail. Speed over polish.
- **Question editor**: forgiving forms, type-aware fields, inline preview, autosave drafts. Quality > throughput, but throughput matters at 100s/week.
