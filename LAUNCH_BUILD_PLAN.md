# Launch Build Plan — Tenancy, CRM, Private Access

**Status:** In progress. Phase 0a (directory cleanup) executing now. All data-model changes gated on explicit confirmation.
**Date:** 2026-05-08
**Companion doc:** `LEGAL_STRATEGY.md` — read first for the *why*. This doc is the *how*.

---

## Goal

Keep the existing GMAT consumer product. Add an account-level tenancy layer so the same codebase serves:

- **Individual users (B2C):** private question bank + private quiz history, isolated per user.
- **Business accounts (B2B):** institute-scoped question bank shared among an institute's admins/students, isolated from every other business and from individuals.
- **Super-admin (you):** CRM-style view across both, and introduce with privacy guardrails with a feature flag.. so during pre launch phase I can just see everything, as we go live and start onboarding, will enable the privacy feature.

Then deploy live behind Cloudflare Access for invited users, so it's a real shippable artifact for the job-hunt portfolio without becoming a public IP target.

The legacy OG/GMAT Club question collection stays untouched in MongoDB during this work — it's used for ongoing testing. A feature flag controls whether end-user routes serve the legacy global pool or only tenant-scoped questions, so production behavior can flip without dropping data.

---

## Phasing overview

| Phase | What | Effort | Gate |
|---|---|---|---|
| **0a** | Move scraping scripts/docs/outputs to `_archive/` (gitignored) | ~30 min | Executing now |
| **0b** | Add `QUESTION_SOURCE_MODE` feature flag scaffold | ~10 min | After 0a |
| **1** | Account model + tenancy fields on User / QuestionBagV3 / V2 / AskedQuestion / UserQuizV2 | ~3 hrs | **Confirm before starting** |
| **2** | B2C UGC: "My Questions" upload UI + tenant-scoped CRUD routes | ~4 hrs | After Phase 1 |
| **3** | B2B accounts: business creation, member invites, account-admin role, scoped routes | ~6 hrs | After Phase 2 |
| **4** | Super-admin CRM: cross-account list, drill-down, privacy guardrails | ~3 hrs | After Phase 3 |
| **5** | Cloudflare Access + `noindex` + production deploy | ~1 hr | Can run in parallel with Phase 1 |

Total: ~15–18 hours focused work. Realistic over 2–3 weekends as a side project.

---

## Phase 0a — Directory cleanup (this turn)

What moves to `_archive/` (gitignored, kept locally):

**`_archive/scripts/`** — scraping & ingestion pipeline:
- `backend/src/scripts/v3_extraction/` (whole dir)
- `backend/src/scripts/di_extraction/` (whole dir)
- `extract*.ts` and `extract*.py` (all)
- `process_RC_*.py`, `processCROGQuestionsWithMistral*.py`, `processCRGMATprep*.py`, `processExamPacksWithMistral.py`, `processRCExamPacksWithMistral*.py`, `processWithGemma.py`, `processWithMistral_sequential.py`, `processWithOllama_specific.py`
- `processAllQuestions.ts`, `processFullBatch.ts`, `processPDFs.ts`
- `checkPdfFormat.ts`, `checkExcelStructure.ts`, `listExcelSheets.ts`, `check_worksheets.ts`, `combineResults.py`, `fixUnicode.py`
- `verify_extraction_strategy.py`
- `importCRQuestionsToDb.ts`, `importQuantQuestionsToDb.ts`, `ImportQuantQuestionsv2.ts`, `importRCQuestionsToDb.ts`
- `updateQuestions.ts`, `updateRCQuestionsFromJson.ts`
- `generateAIAnswers.ts`, `generateEnhancedAIAnswers.ts`
- `fixQuestionFormatting.ts`, `fixIncompleteOptions.ts`
- `validateQuestionsImproved.ts`, `validateQuestionsWithGPT4.ts`

**`_archive/output/`** — scraped question dumps:
- `backend/output/chapter1_questions.json`
- `backend/output/di_test_extraction.json`
- `backend/output/gpt5rctest.json`
- `backend/output/RC Latest Collection.json`

**`_archive/docs/`** — scraping strategy markdown:
- `DI Question Extraction strategy v2.md`
- `DS extractions.md`

**Stays in `backend/src/scripts/` (legitimate utilities):**
- `createTestUser.ts`, `createTestUsers.ts`, `createSampleQuestions.ts`, `createSampleQuiz.ts` — auth/demo seed data (review later if any contain real OG questions)
- `resetUserMockCounters.ts` — admin utility
- `backfillFormattedText.ts`, `stripRCQuestionNumberPrefix.ts`, `rcMigrationReport.ts`, `tagSimilarity.ts` — DB migration / housekeeping
- `testImport.ts`, `testOpenAI.ts` — dev tests
- `updateTestedQuestions.ts` — admin utility
- `addCriticalReasoningQuestion.ts` — **flagged for review**: may contain a real OG question; if so, move to archive

**Note:** This is a *local-only* split. The `_archive/` directory is gitignored so the files stop being tracked but stay on disk for your reference. To make this truly private:

1. (Optional, recommended later) `cd _archive && git init && git remote add origin <your-private-repo>` — create a separate private repo for these files.
2. (Optional, nuclear) Run `git filter-repo --path-glob 'backend/src/scripts/extract*' --invert-paths` etc. to scrub the moved files from public-repo history. Documented but not run yet — destructive, requires force-push, do later when ready.

---

## Phase 0b — `QUESTION_SOURCE_MODE` flag (next turn, before Phase 1)

Add to `backend/src/config/featureFlags.ts`:

```ts
QUESTION_SOURCE_MODE: (process.env.QUESTION_SOURCE_MODE as 'legacy_global' | 'tenant_scoped') || 'legacy_global',
```

Behavior:
- `legacy_global` (default): existing routes serve `QuestionBagV3` / `V2` collections as-is. Backward compatible. Dev/test posture.
- `tenant_scoped`: end-user routes only return questions where `accountId == currentUser.accountId`. Production posture post-Phase 1.

Until Phase 1 lands, only `legacy_global` is wired up. The flag exists so the toggle point is documented.

---

## Phase 1 — Account & tenancy data model (CONFIRM BEFORE STARTING)

### New: `Account` model

```ts
// backend/src/models/Account.ts
export type AccountType = 'individual' | 'business';
export type BusinessStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

export interface IAccount extends Document {
  type: AccountType;
  name: string;                          // "Piyush Singh" for individual, "Acme Prep Pvt Ltd" for business
  ownerUserId: ObjectId;                 // creator/billing contact
  // Business-only fields (null for individual)
  businessStatus?: BusinessStatus;
  maxMembers?: number;                   // seat cap
  billingContactEmail?: string;
  gstNumber?: string;
  // Common
  createdAt: Date;
  updatedAt: Date;
}
```

### Changes to `User` model

Add two fields:

```ts
accountId: ObjectId;                     // FK to Account; every user belongs to exactly one
accountRole: 'owner' | 'admin' | 'member';
```

- For individuals: their personal account, `accountRole = 'owner'`.
- For business: `'owner'` is the creator, `'admin'` can manage members + questions, `'member'` is a student.
- Existing `role` field (the platform-level `'guest' | 'registered' | ... | 'admin'`) stays as-is — that controls *platform* permissions (super-admin, paid tier). `accountRole` controls *within-account* permissions.

### Changes to `QuestionBagV3` (and V2 for parity)

Add:

```ts
accountId?: ObjectId;                    // null/undefined = legacy global pool (existing rows)
createdByUserId?: ObjectId;              // who in that account created it
visibility?: 'private_to_creator' | 'shared_within_account';  // default 'shared_within_account' for business
```

Index: `{ accountId: 1, questionType: 1 }` for tenant-scoped queries.

### Changes to `AskedQuestion`

Add:

```ts
accountId: ObjectId;                     // denormalized from the user at insert time, for fast scoping
```

Existing unique index `{ userId, questionId }` stays — ledger is still per-user.

### Changes to `UserQuizV2`

Add:

```ts
accountId: ObjectId;                     // denormalized from the user; for tenant-scoped quiz history queries
```

### Migration script

`backend/src/scripts/migrations/001_create_personal_accounts.ts`:

1. For each existing `User` without `accountId`:
   - Create an `Account` with `type='individual'`, `name=user.fullName`, `ownerUserId=user._id`.
   - Set `user.accountId = account._id`, `user.accountRole = 'owner'`.
2. For each existing `QuestionBagV3` / `V2` doc without `accountId`: leave `accountId` null. These are the legacy global pool, served only when `QUESTION_SOURCE_MODE='legacy_global'`.
3. For each existing `AskedQuestion` / `UserQuizV2`: backfill `accountId` from the user's new `accountId`.

Migration is idempotent — safe to re-run.

---

## Phase 2 — B2C UGC question bank (after Phase 1)

### Frontend
- New page: `frontend/src/pages/MyQuestionsPage.tsx` ("My Questions").
- CRUD UI for the user's own questions: list, add, edit, delete.
- Reuse `QuestionForge` admin patterns where possible — the UI building blocks already exist.
- Form validation: required fields per question type, attestation checkbox: *"I confirm I have the right to upload this content for my personal study."*

### Backend
- New routes under `/api/my-questions/*`:
  - `GET /api/my-questions` — list current user's questions (scoped by `accountId` and optionally `createdByUserId`)
  - `POST /api/my-questions` — create, automatically sets `accountId = req.user.accountId`, `createdByUserId = req.user.userId`, `visibility = 'private_to_creator'`
  - `PUT /api/my-questions/:id` — update (must own)
  - `DELETE /api/my-questions/:id` — delete (must own)
- Quiz route changes: when `QUESTION_SOURCE_MODE='tenant_scoped'`, filter quiz candidate pool by `accountId`. When `legacy_global`, behavior unchanged.

### Defense-in-depth
- Tenant scoping enforced at the **query layer**, not just route. Every Mongo query that touches questions/quizzes adds `accountId: req.user.accountId` as a mandatory filter. A helper like `tenantScope(req)` returning `{ accountId: req.user.accountId }` reduces the chance of an unscoped query slipping through.
- Lint rule (manual or via codemod) flags any direct `QuestionBagV3.find(...)` that doesn't include `accountId` in the filter.

---

## Phase 3 — B2B account features (after Phase 2)

### Account creation flow
- Super-admin creates a business account from CRM (Phase 4). Specifies name, owner email, seat cap.
- Owner receives invite email → sets password → lands in their business workspace.

### Within a business account
- **Owner / admin:**
  - Manage questions: same UI as B2C "My Questions" but questions default to `visibility='shared_within_account'`.
  - Invite members (students) via email; assign role.
  - Remove members. Removed members lose access immediately.
- **Member (student):**
  - Take quizzes from the business's question pool.
  - View their own quiz history (private to them — admins can see aggregates but not individual answers without explicit consent).

### Tenant scoping rules
- A business member can only see questions with `accountId == their accountId`.
- A business admin/owner can see all questions in their account.
- Cross-account queries are **impossible** at the route layer — no admin within a business can see another business's data.

### Routes
- `/api/account/*` — account-management endpoints (members, settings, billing).
- `/api/account/members` — invite/list/remove members.
- `/api/my-questions` (Phase 2) is reused but now respects `visibility` for B2B scoping.

### Frontend
- New page: `frontend/src/pages/AccountPage.tsx` — for owners/admins to manage members, see seat usage.
- `Navbar` shows account name + role badge if business.

---

## Phase 4 — Super-admin CRM (after Phase 3)

### What you (super-admin) can see

**Account list view (`/admin/crm`):**
- All accounts (individual + business) with: type, name, owner email, member count, question count, last activity, plan status.
- Filter/sort/search.

**Account detail view (`/admin/crm/:accountId`):**
- Account metadata.
- Member list (for business): emails, last login, role.
- Question count by type.

### Privacy guardrails (this is the part you asked about)

Two viewing modes, controlled by a feature flag `CRM_FULL_VISIBILITY`:

- **`CRM_FULL_VISIBILITY=true` (ops mode, default while you're testing):** super-admin can drill into individual questions, individual quiz attempts, individual user actions. Every drill-down is logged to a `SuperAdminAuditLog` collection (who, when, what entity, what action). Used for debugging production issues during early stages.
- **`CRM_FULL_VISIBILITY=false` (production mode, future):** super-admin sees only **aggregates and metadata** — counts, last activity dates, plan status. Cannot view question content or quiz answers. Drill-down requires either (a) the account owner's explicit consent token, or (b) a documented support ticket reference.

Why this matters: B2B SaaS norms expect that a vendor can't snoop on a customer's data. For a coaching institute, their question bank is their IP — they will ask in due diligence whether you can see it. Having two modes lets you operate honestly in both stages: full visibility now (for debugging), aggregates-only later (for trust).

Documenting this decision is itself a portfolio artifact ("how I designed for B2B trust from day one").

### Audit log
- New collection: `SuperAdminAuditLog` — every action super-admin takes against a tenant's data.
- Append-only. Visible to super-admin themselves only (transparency to oneself, but the existence of the log is mentioned in B2B contracts).

---

## Phase 5 — Cloudflare Access deployment (can run parallel to Phase 1)

### Steps
1. Move DNS to Cloudflare (point your domain's nameservers to Cloudflare's).
2. In Cloudflare Zero Trust dashboard:
   - Create an **Access Application** for your domain (e.g., `app.yourdomain.com`).
   - Policy: "Allow if email in list" — paste invitee emails.
   - Authentication method: One-time PIN (email OTP) or Google login.
3. Deploy the app behind Cloudflare's proxy. Existing app-level auth keeps running underneath.
4. Add to `frontend/public/index.html`:
   ```html
   <meta name="robots" content="noindex,nofollow">
   ```
5. Add `frontend/public/robots.txt`:
   ```
   User-agent: *
   Disallow: /
   ```
6. Test: opening the URL in an incognito window from a non-whitelisted email shows Cloudflare's auth wall, not your app.

### Belt-and-suspenders
- Keep app-level signup **disabled by default** — only super-admin can create users via CRM (or send signup-token invite links).
- Optional layer: HTTP basic auth at the reverse proxy in front of the API only (not user-facing pages), as defense against direct API hits if someone exfiltrates a JWT.

### Cost
- Cloudflare Access: free up to 50 users.
- Domain: ~₹800–1500/yr.
- Hosting: existing setup unchanged.

---

## Open questions (please confirm before Phase 1)

1. **Schema choice.** Add `accountId` to existing `QuestionBagV3` / `V2` collections (proposed) vs. create a new `TenantQuestion` collection? Adding the field is simpler and lets one set of routes serve both legacy + tenant-scoped via the feature flag. Confirm OK. -- OKAY
2. **Visibility default for B2C individuals.** Each individual user is the only member of their account, so `private_to_creator` and `shared_within_account` collapse. Confirm we can keep the field for forward compat but ignore it for B2C. -- OKAY
3. **CRM privacy posture.** The two-mode (`CRM_FULL_VISIBILITY`) approach above — agree, or do you want full-visibility-only with no toggle (simpler, riskier)? -- OKAY WITH TWO MODE. JUST MAKE SURE IN THE PRODUCTION THE FLAG IS OFF BY DEFAULT
4. **Migration of legacy OG questions.** Per your instruction, *do nothing* to them in Phase 1 — they stay with `accountId=null` in the legacy global pool. Confirm. -- OKAY -- Only tie them to superadmin account (which can be allowed to be displayed to all students or at a student level in the super admin user page we have this currently where can see the user) we can make a checkbox in the superadmin user page to display all questions or not for a given user. this is important -- THIS IS CRITICAL. 
5. **Audit log.** Worth building in Phase 4, or defer to a later milestone? It's ~1 hour of work and a meaningful B2B trust signal. -- OKAY
6. **Cloudflare Access scope.** Apply to whole domain, or only to `/app/*` and leave a public marketing landing page open? Recommend whole-domain for Phase 1 simplicity. -- OKAY
7. Remove the Sign Up option - only login page and sign up page should just give an option to enter their name , number & email so I can reach them back or display a dummy whatsapp link / telegram link / discord link. that they can request to join (not autojoin - give dummy link now, I can update with the real link later. )
---

## What this gives you when complete

- A live, password-protected URL you can share in WhatsApp groups / DMs.
- Individual users get a private question bank + quiz engine + AI tutor.
- 1–2 demo business accounts you can show to coaching institutes ("here's what your branded version looks like").
- A super-admin CRM you can use as portfolio screenshots ("designed and built a multi-tenant SaaS admin").
- The legal-strategy-doc → tenancy-architecture-doc → implementation arc itself becomes the strongest part of the PM portfolio narrative.

---

## Production cutover checklist (run when ready to go live)

This is the explicit "flip the switches" task. Until these are done, the app keeps serving the legacy global question pool and behaves exactly as it did pre-tenancy. The new code paths are additive and dormant.

**When you tell me "do the cutover", I will:**

1. **Back up Mongo first.** Tell me the backup target — local dump (`mongodump --out=mongo_backup/`) or hosted (Atlas snapshot). I will not flip flags before a backup is in place.
2. **Run migration 001 — dry run.**
   ```
   cd backend && DRY_RUN=true npx ts-node src/scripts/migrations/001_create_personal_accounts.ts
   ```
   Confirm the user/account/question counts look right.
3. **Run migration 001 — for real.** Set `SUPERADMIN_EMAIL=<your real admin email>` so the legacy pool ties to the right account:
   ```
   cd backend && SUPERADMIN_EMAIL=you@example.com npx ts-node src/scripts/migrations/001_create_personal_accounts.ts
   ```
4. **Flip `QUESTION_SOURCE_MODE` to `tenant_scoped`** in `backend/.env`. Restart backend. From this moment, end-user routes serve only tenant-scoped questions; legacy questions are reachable only by users with `legacyAccessEnabled=true` (the super-admin by default; other users via the per-user checkbox in CRM Phase 4).
5. **Confirm `CRM_FULL_VISIBILITY=false`** (or leave unset — false is the default). This is the privacy-safe production posture per Open Question #3.
6. **Smoke test:** log in as super-admin → take a quiz → confirm legacy questions appear (because legacyAccessEnabled=true). Log in as a non-admin test user → take a quiz → confirm only their account questions appear (likely empty until they add some).
7. **Cloudflare Access (Phase 5 manual):**
   - Move domain DNS to Cloudflare.
   - Zero Trust dashboard → Access Application → email-allowlist policy → email-OTP or Google auth.
   - Verify in incognito that a non-whitelisted email hits the wall before the app loads.
   - Replace the three `REPLACE_WITH_REAL_INVITE` URLs in `frontend/src/pages/RegisterPage.tsx` with the real WhatsApp / Telegram / Discord invite links.
8. **(Optional, do later)** History scrub: `git filter-repo --path-glob '_archive/**' --invert-paths` to remove the moved scraping pipeline from public-repo history. Destructive, requires force-push, only run when you're confident no other branches need that history.

**Reference this section by name** ("run the production cutover checklist") and I'll work through it sequentially, pausing for confirmation at each destructive step.





-------- Just noting progress here : -----
⏺ Phase 1 is complete and the backend type-checks clean.                                                                                
                                                                                                                                        
  What changed this turn                                                                                                                
                                                                                                                                        
  Feature flags (backend/src/config/featureFlags.ts):                                                                                   
  - QUESTION_SOURCE_MODE: 'legacy_global' | 'tenant_scoped', default legacy_global (backward-compatible).                               
  - CRM_FULL_VISIBILITY: boolean, default false (privacy-safe production posture, as you asked).                                        
                                                                                                
  New model: backend/src/models/Account.ts — type (individual/business), name, ownerUserId, plus business-only fields (businessStatus,  
  maxMembers, billingContactEmail, gstNumber).                                                                                          
                                                                                                                                        
  Updated models with tenancy fields:                                                                                                   
  - User: accountId (optional during rollout), accountRole ('owner'|'admin'|'member', default 'owner'), legacyAccessEnabled (boolean, 
  default false).                                                                                                                       
  - QuestionBagV2 and QuestionBagV3: accountId, createdByUserId, visibility ('private_to_creator'|'shared_within_account'). Added     
  compound indexes { accountId, questionType } and { accountId, createdByUserId }.                                                      
  - AskedQuestion: accountId (denormalized) + new index.                                                                                
  - UserQuizV2: accountId (denormalized) + new index.   
                                                                                                                                        
  Migration script: backend/src/scripts/migrations/001_create_personal_accounts.ts                                                      
  - Idempotent. Picks super-admin via SUPERADMIN_EMAIL env or first role='admin' user.                                                  
  - Creates personal Account for every user, links via accountId.                                                                       
  - Sets legacyAccessEnabled=true on the super-admin so they retain access to the legacy pool.                                        
  - Backfills all legacy QuestionBagV2/V3 docs to the super-admin's account (legacy holder, per your decision on #4).                   
  - Backfills AskedQuestion and UserQuizV2 rows from each user's new accountId.                                                         
  - Supports DRY_RUN=true for a preview-without-writes pass.                                                                            
                                                                                                                                        
  Run order when you're ready                                                                                                           
                                                                                                                                        
  # 1. Preview what would change (no writes)                                                                                            
  cd backend && DRY_RUN=true npx ts-node src/scripts/migrations/001_create_personal_accounts.ts                                         
                                                                                                                                        
  # 2. Real run (optionally pin the super-admin)                                                                                        
  cd backend && SUPERADMIN_EMAIL=your.real@email.com npx ts-node src/scripts/migrations/001_create_personal_accounts.ts                 
                                                                                                                                        
  Important: nothing is broken yet                                                                                                      
                                                                                                                                        
  - QUESTION_SOURCE_MODE defaults to legacy_global, so all existing routes continue to work exactly as before — they don't yet read the 
  new tenancy fields. The flag exists, the schema accepts the fields, but the route layer change comes in Phase 2.
  - legacyAccessEnabled doesn't gate anything yet — it's only schema. The wiring lands when Phase 2 changes the quiz routes.            
  - I haven't run the migration. You should, after backing up Mongo (your gitignore has mongo_backup/ already so the convention exists).
                                                                                                                                        
  What's next                                                                                                                           
                                                                                                                                        
  Listed in LAUNCH_BUILD_PLAN.md. Suggested order:                                                                                      
                                                            
  1. Phase 1b: signup removal + lead capture (~2 hrs) — your #7. Disable the public signup route, replace the signup page with a        
  "Request Access" form (name/email/phone) + dummy WhatsApp/Telegram/Discord links. New LeadRequest model. Super-admin manually creates
  real users from leads.                                                                                                                
  2. Phase 2: B2C UGC question bank (~4 hrs) — MyQuestionsPage frontend, /api/my-questions/* routes, quiz routes start respecting
  QUESTION_SOURCE_MODE + legacyAccessEnabled.                                                                                           
  3. Phase 5: Cloudflare Access deploy (~1 hr) — can run in parallel.
  4. Phase 3: B2B accounts (~6 hrs).                                                                                                    
  5. Phase 4: Super-admin CRM with the per-user "show legacy" checkbox (~3 hrs).                                                        
                                                                                                                                        
  Want me to proceed with Phase 1b next, or jump to Phase 2 first? Phase 1b is small and lets you start collecting leads from WhatsApp  
  groups while the rest is being built.          1