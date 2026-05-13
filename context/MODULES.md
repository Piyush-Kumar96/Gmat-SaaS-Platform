# App Modules

> **Purpose:** map every user-facing surface and supporting backend module to its files. Use this to find code fast.

## Top-level routes (`frontend/src/App.tsx`)

| Path | Component | Audience | Purpose |
|------|-----------|----------|---------|
| `/` | `HomePage` | All | Landing, entry to Start Quiz / Question Bank / Import. Pricing brochure. |
| `/config` | `ConfigPage` | Auth | Configure custom quiz OR launch GMAT Focus mock. |
| `/quiz` | `QuizPage` | Auth | Active custom quiz (PS/DS/CR/RC). Timer, navigation, submit. |
| `/gmat-focus-quiz` | `GMATFocusQuizPage` | Paid+ | 3-section Focus mock with optional break. |
| `/di-quiz` | `DIQuizPage` | Paid+ | DI-only sectional quiz (DS/GT/MSR/TPA). |
| `/results` | `ResultsPage` | Auth | Score, time, breakdown after submit. |
| `/review` | `ReviewPage` | Admin | Question Bank: list, search, edit non-DI questions inline. |
| `/review-di` | `DIReviewPage` | Admin | DI-specific review/edit surface (partial). |
| `/admin` | `AdminPage` → `AdminPanel` | Admin | Users, payments, basic analytics. |
| `/import` | `ImportPage` | Auth | Upload PDFs/Excel for ingestion (under-development copy). |
| `/login` `/register` `/profile` | Auth pages | All | Standard. |

The Navbar is hidden on `/quiz`, `/gmat-focus-quiz`, and `/di-quiz` to maximise focus during attempts.

## Module-by-module

### 1. Quiz Configuration — `pages/ConfigPage.tsx`
- Two flows: **Custom Quiz** (pick types, count, time, difficulty) and **GMAT Focus Mock**.
- For Focus, opens `components/GMATFocusConfig.tsx` modal: section order + break choice.
- Submits to backend via `services/api.ts` and navigates to the appropriate quiz page with `state.config`.

### 2. Custom Quiz — `pages/QuizPage.tsx`
- Renders question via type-router (`components/QuestionCard.tsx` → PS/DS/CR/RC card).
- Manages: current index, answers map, timer, pause, submit.
- On submit: writes to `Quiz` + `QuizItem` collections, navigates to `/results`.

### 3. GMAT Focus Mock — `pages/GMATFocusQuizPage.tsx`
- Manages 3-section state (`GMATFocusState`): which section is current, completed flags, break state.
- Pulls per-section question counts and time limits from `QuizConfig.sections`.
- On section end: optional break screen, then progress to next section per `sectionOrder`.

### 4. DI Sectional Quiz — `pages/DIQuizPage.tsx`
- Loads random DI questions via `getRandomQuestionsV3` from `/api/question-bag-v3/random`.
- Routes per question to the right card: `DSQuestionCard`, `GTQuestionCard`, `MSRQuestionCard`, `TPAQuestionCard`.
- Selected-answer shape varies by interaction (string for MC, `string[]` for Yes/No, `[colA, colB]` for TPA).

### 5. Results — `pages/ResultsPage.tsx`
- Score, percentage, per-type breakdown, time spent. Links into Review for incorrect items.

### 6. Review (Question Bank) — `pages/ReviewPage.tsx` + `pages/DIReviewPage.tsx`
- **Admin-only** in the home tile copy.
- ReviewPage: list/search/filter questions across types; inline edit for non-DI.
- DIReviewPage: DI-aware inspection.
- Backed by `/api/question-bag-v2` and `/api/question-bag-v3`.

### 7. Admin Panel — `components/AdminPanel.tsx` (mounted at `/admin`)
- User list, search by email, view user details (quiz history, payment history, stats).
- Manual payment record entry (since webhook isn't wired yet).
- Basic analytics: totals, this-week, plan breakdown, conversion rate.
- Backed by `/api/admin/*`.

### 8. Payments — `components/PaymentModal.tsx` + `services/paymentService.ts` (BE)
- Razorpay Checkout v1 integration.
- Order creation → checkout → signature verification → user role/plan/limits update.
- Statuses tracked in `models/Payment.ts`: `created`, `attempted`, `paid`, `failed`, `cancelled`, `refunded`.
- TODO: webhook (`/api/payments/webhook`), refund processing, daily expiry job.

### 9. Auth — `routes/authRoutes.ts`, `middleware/authMiddleware.ts`, `middleware/roleAuth.ts`
- Register/login with email + password (bcrypt).
- JWT access + refresh tokens (`models/RefreshToken.ts`).
- Role-based middleware:
  - `authenticateToken` — must be logged in.
  - `requirePaidUser` — `monthly_pack` / `quarterly_pack` / `annual_pack` / `admin`.
  - `checkMockTestLimit` — enforces `mockTestLimit` minus `mockTestsUsed`.
  - Admin checks performed inline in routes (`req.user?.role === 'admin'`).

### 10. Question Models (storage)
- `models/QuestionBag.ts` — **legacy v1**, long-form types, `options: string[]`. Deprecated.
- `models/QuestionBagV2.ts` — **primary** for non-DI. `options: Record<string,string>`, validation fields, `passageText` for RC.
- `models/QuestionBagV3.ts` — **primary** for DI + new RC. Adds `passageId`, `msrSources`, `subQuestions`, `artifactImages`, `artifactTables`.

(Detailed schemas in `QUESTION_DATA_MODEL.md`.)

### 11. Question Card Components (rendering)
- `components/QuestionCard.tsx` — type router for legacy quiz flow.
- `PSQuestionCard.tsx`, `DSQuestionCard.tsx`, `CRQuestionCard.tsx`, `RCQuestionCard.tsx` — non-DI cards (working).
- `GTQuestionCard.tsx` — DI-GT (currently MC + artifact only; doesn't render Yes/No or dropdown sub-formats).
- `MSRQuestionCard.tsx` — DI-MSR (source tabs + sub-question with MC or Yes/No table).
- `TPAQuestionCard.tsx` — DI-TPA (2-column radio table).
- All DI cards live in the same `components/` folder; styles in `styles/question-cards.css`.

### 12. Misc backend
- `services/openaiService.ts` — wrapper for LLM calls.
- `services/pdfProcessor.ts` — PDF parsing (legacy ingestion route).
- `pdfImporter.ts` — top-level PDF import script.

### 14. Frontend supporting
- `services/api.ts` — axios client; one function per backend route.
- `services/authService.ts` — login/register/refresh; token persistence.
- `services/analytics.ts` + `services/mixpanelService.ts` — duplicate Mixpanel impls (consolidation pending).
- `context/AuthContext.tsx` — auth state, current user, role.
- `hooks/useAnalytics.ts` — page-view tracking hook (not yet wired in App).
