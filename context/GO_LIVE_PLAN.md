# Go-Live Plan — v1 launch

> **Purpose:** the concrete checklist + infra plan to take this platform from localhost to a public URL with paying users, and the "v2" backlog of things deferred until traction is proven. Last updated 2026-05-04.

This is a **living doc** — when something ships, move it from "to do" to "done" and add the date. When a number changes (Mongo size, monthly bill), update the line in place.

## 1. Status snapshot (2026-05-04)

| Area | State |
|---|---|
| Question bank | ~1,400 RC, ~1,000+ CR, ~167 PS, ~101 DS live; full DI bank live in V3. ~1,800 Quant JSONs sit unimported on disk (one folder filter to flip). |
| Quiz experience | Section quizzes + full Focus mock work; MSR/RC sub-question pager works; QA validator gates the random pull behind a feature flag. |
| Authoring | Admin Question Bank can create/edit every type, multi-question RC, full CR argument editing. |
| Auth | Email/password + JWT. Roles: guest / registered / paid tiers / admin. |
| Payments | Razorpay one-time order capture works. **Webhook missing** (real money-loss bug — see `Payments.md`). No expiry enforcement cron. |
| Analytics | Mixpanel wired (two services, consolidation pending). |
| Hosting | localhost only. No production deploy. No domain. No CI/CD. |

## 2. Pre-launch checklist (v1, before first paying user)

These are the **must-fix before any user touches the platform**. Group A is functional, B is infra, C is ops.

### 2A. Functional gates

- [x] **Review-after-quiz** *(2026-05-04)*: every submitted quiz must show, per question: user's answer, correct answer, explanation (where present).
  - Implementation: `/api/quiz/quizzes/submit` now resolves question IDs across V2 → V3 → V1 → QuizItem (V3 was previously skipped, so DI/new-RC questions were silently dropped from results). Response now includes `questionText`, `questionType`, `userAnswerText`, `correctAnswerText` so the Results page can render full context, not just a letter.
  - Note: a "review later" toggle is still TODO — current Results page shows the read-only review only. Track in v2 backlog.
- [x] **Score visible at quiz end** *(2026-05-04)*: `pages/ResultsPage.tsx` renders %, score, total, time, and per-section breakdown for Focus mocks.
- [x] **Quiz history** (per user) *(2026-05-04)*: `/quizzes` lists past attempts (date, type, score, %) sorted desc; `/quizzes/:id` opens a read-only review.
  - Backend: `GET /api/quiz/history` (list) + `GET /api/quiz/history/:id` (detail) in `routes/quizRoutes.ts`. Both require auth.
  - Frontend: `pages/QuizHistoryPage.tsx`, `pages/QuizAttemptReviewPage.tsx`, Navbar link "My Quizzes" (auth-gated).
  - **Bug fix bundled in**: the existing submit handler used `req.user._id` (always undefined — middleware sets `userId`). UserQuiz docs were never being persisted; quiz history would have been empty for everyone without this. Fixed in both `/quizzes` GET and submit POST.
- [ ] **Razorpay webhook** (`POST /api/payments/webhook`): **deferred** — switching billing to Stripe; revisit when Stripe integration begins.
- [x] **Plan expiry enforcement** *(2026-05-04)*: `middleware/planExpiry.ts` `downgradeIfExpired()` runs on every authenticated request from both `authMiddleware` and `roleAuth`. Expired paid roles flip to `registered` + `free_mock` and `planInfo.isActive=false`. Admins are exempt.
- [x] **Remove dev fallbacks** *(2026-05-04)*: `config/secrets.ts` `assertProductionSecrets()` is called at boot from `index.ts`; in `NODE_ENV=production` it throws if `MONGODB_URI`, `JWT_SECRET`, or `JWT_REFRESH_SECRET` are missing or still equal to a known dev default. Dev fallbacks in module code are kept so onboarding stays easy.
  - Razorpay key guard deferred until Stripe migration.
- [ ] **CORS**: `backend/src/index.ts:24` allows any localhost. **Deferred** until production hostname is registered — flip the regex to whitelist `https://<your-domain>` only on launch day.
- [x] **CSP / HTTPS-only cookies / secure JWT delivery** *(2026-05-04, partial)*: `helmet` is now mounted on the API with sensible defaults (`crossOriginResourcePolicy: cross-origin` so the CRA dev server can still fetch). CSP is intentionally off here — the API only returns JSON; CSP belongs on the asset host (Caddy/Cloudflare in prod). `secure: true` cookie flag and full HTTPS enforcement deferred until the domain + TLS provisioning lands.
- [x] **Rate limiting** *(2026-05-04)*: `express-rate-limit` mounted on `/api/auth/*` (30 req / 15 min) and `/api/payments/*` (60 req / 15 min). In-memory bucket; revisit when scaling horizontally.
- [x] **Health check endpoint** *(2026-05-04)*: `GET /api/health` returns `{ ok, mongo: 'connected'|'connecting'|... }`. Returns 503 when Mongo isn't connected so uptime monitors can alert.

Additonal funcitonal checks :
1. [x] **"Ready for Quiz" flag + optional filter** *(2026-05-05)*: V2/V3 schemas gained `readyForQuiz` (default false). Toggle exposed in V2 admin editor (ReviewPage), V2 add-question modal, V3 inline editor (DIReviewPage), and V3 Forge (CommonFields). Random-pull endpoints `/question-bag-v2/random` and `/question-bag-v3/random` honour `filters.onlyReadyForQuiz` — propagated into every sub-filter (RC group, type, fallback, top-up). ConfigPage has an opt-in checkbox plumbed through QuizPage + DIQuizPage. Off by default so the pool stays large.
2. [x] **Topic / sub-topic tagging in Bank + Forge** *(2026-05-05)*: schema field already existed (`metadata.topic`, `metadata.subtopic`). Surfaced as inputs in V2 admin editor + add-question modal and V3 inline editor; V3 Forge already had them. V2 editor `saveQuestion` now spreads `originalMetadata` before overwriting topic/subtopic so DS `statement1/2` and CR `argument` aren't blown away by partial updates. Header tags show `topic › subtopic` at a glance.
3. think about improving the Quiz experience.
4. [x] **My Quizzes silent refresh-token integration** *(2026-05-05)*: root cause was a one-two: backend never installed `cookie-parser` (so the `httpOnly refreshToken` cookie was unreadable), and the frontend axios client wiped the access token on the first 401 before any refresh attempt. Fixes:
    - Backend: installed `cookie-parser`, mounted before routes; switched cookie `sameSite` from `'strict'` → `'lax'` (cross-origin localhost dev + future cross-subdomain prod).
    - Frontend: consolidated `services/authService.ts` onto the shared `services/api.ts` axios instance (one interceptor stack); added `withCredentials: true` so the refresh cookie travels; replaced the "401 → wipe token + bounce to login" interceptor with a single-flight `refreshAccessToken()` that calls `/api/auth/refresh-token`, retries the failed request transparently, and only force-logs-out if the refresh itself fails. AuthContext + standalone `getUserProfile` were also using bare `fetch`/sync logout — both now share the interceptor.
5. Need to add ready for Quiz in the filter as well so the admin can filter on that and get the not ready for quiz questions to manually correct it. I have already started looking at each question manually.

### 2B. Infra gates

- [ ] Domain registered + DNS pointed (see § 4).
- [ ] Production VPS provisioned (see § 3).
- [ ] MongoDB connection set up — Atlas M0 free or self-hosted on VPS (see § 3).
- [ ] HTTPS via Caddy auto-cert OR Cloudflare proxy.
- [ ] `.env.production` populated on server (see § 6).
- [ ] One-shot deploy script tested end-to-end on a throwaway VM before the real launch.
- [ ] Daily mongodump cron + a one-line restore tested (don't skip — losing 4,000 questions is a week's work).
- [ ] Uptime monitor — UptimeRobot free, 5-min ping on `/api/health`.

### 2C. Comms / commercial gates

- [ ] **Privacy policy + terms of service**: even a one-page version. Razorpay onboarding requires these URLs. Use a generator (Termly, Iubenda free tier).
- [ ] **Refund policy** page — Razorpay strongly prefers it.
- [ ] **GST / business KYC**: Razorpay needs a registered business or proprietorship PAN. If you're transacting as a sole proprietor, GST is only mandatory above ₹20L turnover but Razorpay onboarding will ask.
- [ ] **Pricing page** — current plans (₹1,500 / ₹3,500 / ₹6,000) must be visible before checkout.
- [ ] Support inbox (an alias on the new domain → your gmail).

## 3. Hosting strategy

### 3.1 Sizing (measured, not guessed)

From a fresh measurement on 2026-05-04:

| Resource | Size now | Where it goes |
|---|---|---|
| Mongo `dataSize` | 263 MB | grows ~10MB / 1k new questions |
| Mongo `storageSize` (compressed) | 45 MB | what disk actually uses |
| Mongo index size | 23 MB | |
| Backend `src/` | 1.3 MB | |
| Frontend `src/` | 792 KB | |
| `node_modules` (backend) | 239 MB | only on the server, not in your bill |
| Backend RSS at idle | ~150-300 MB | grows under traffic |

**Headroom for v1 traffic** (estimate 100 concurrent users, 1k DAU):
- 1 vCPU + 1 GB RAM is enough for the Express app.
- 512 MB Mongo storage holds ~5× the current bank.
- ~10 GB disk for the OS + app + Mongo + a week of backups.

### 3.2 Recommended stack — three options, cheapest first

**Option A — Oracle Cloud Always Free (₹0/mo, indefinite)**
- 4 vCPU + 24 GB RAM ARM Ampere instance, free forever.
- Pros: literally zero compute cost, massive headroom, can host Mongo + Node + Caddy on one box.
- Cons: ARM means you may hit `node_modules` rebuild quirks (Puppeteer, sharp); Oracle has reclaimed idle free-tier instances in the past — keep it active. Onboarding is more painful than competitors (CC required, India regions sometimes "out of capacity").
- Use if: you want zero monthly bill and don't mind one week of setup pain.

**Option B — Hetzner CX22 (€4.51/mo ≈ ₹420/mo) [RECOMMENDED for v1]**
- 2 vCPU x86 + 4 GB RAM + 40 GB SSD + 20 TB egress.
- Pros: cheapest reputable x86 VPS, easy onboarding, Frankfurt/Helsinki latency to India is ~150ms which is fine for a quiz app.
- Cons: monthly bill (small), no Indian region (use a Singapore proxy via Cloudflare if latency bites).
- Use if: you want one box, predictable cost, no Oracle drama.

**Option C — Render / Railway / Fly.io free + paid mix**
- Frontend: Vercel free.
- Backend: Render free tier (sleeps after 15min idle — bad UX) or Railway (~$5/mo trial credit, then $5+/mo).
- Mongo: Atlas M0 free.
- Pros: zero ops, push-to-deploy out of the box.
- Cons: free tiers throttle / sleep / move you to paid quickly under any real traffic. Cost grows fast past 1k DAU.
- Use if: you want zero ops time and will swallow $10-20/mo when traffic shows up.

**Recommendation for first 90 days: Option B.** ~₹420/mo is invisible if even one paid user converts. It scales to a few thousand DAU before you need to think about it. If you hit growth, upgrading to CX32 (4 vCPU / 8 GB / €8/mo) is one click.

### 3.3 What lives where on the VPS (Option B)

```
/opt/gmat/
  backend/          # git checkout, dist/ built here
  frontend/build/   # CRA build output, served by Caddy as static files
  .env.production
  caddy/Caddyfile
  /var/lib/mongodb/  # Mongo data dir (or use Atlas, see 3.4)
```

- **Process manager**: PM2 (`pm2 start dist/index.js --name gmat-api`).
- **Reverse proxy + HTTPS**: Caddy (auto-renews Let's Encrypt). One-line config:
  ```
  yourdomain.com {
    handle /api/* { reverse_proxy localhost:5006 }
    handle { root * /opt/gmat/frontend/build, file_server, try_files {path} /index.html }
  }
  ```
- **Mongo**: install via `apt` (`mongodb-org`), bind to `127.0.0.1`, no auth needed since not exposed.
- **Backups**: `mongodump --gzip --archive=/backups/$(date +%F).gz` in a daily cron, prune older than 14 days.

### 3.4 Mongo: self-host vs Atlas

| | Self-host on VPS | Atlas M0 (free) | Atlas M2 ($9/mo) |
|---|---|---|---|
| Cost | included in VPS | free | $9/mo |
| Storage | unlimited (your disk) | 512 MB | 2 GB |
| Backups | your cron | manual download | automated daily |
| Network | localhost (fast) | over internet (~50ms) | over internet |
| Ops | you patch / monitor | nothing | nothing |

For v1 with 263 MB data: **self-host on the same VPS is fine and free**. Move to Atlas M2 the day you hit 1k paid users (when downtime hurts more than $9/mo).

## 4. Domain + DNS + SSL

- **Registrar**: Porkbun ($9.13/yr for `.com`) or Namecheap (~$10-12). Avoid GoDaddy.
- **DNS**: point at Cloudflare (free), set the orange cloud ON for caching + DDoS shield.
- **A record**: `yourdomain.com` → VPS IP. CNAME `www` → root.
- **SSL**: Caddy fetches Let's Encrypt automatically once DNS resolves. Or Cloudflare "Full (strict)" mode if proxied.
- **Email** (just for user-facing `support@yourdomain.com` and Razorpay receipts): Cloudflare Email Routing → forwards to your gmail (free), or use Zoho Mail Lite (₹59/mo for proper sending).

Total domain stack: ~₹800/yr ($10) for the domain, everything else free.

## 5. Deploy pipeline (no more localhost-only)

The minimum viable workflow that lets you push to production without ceremony:

```
local: git push origin main
GitHub Actions: build, run lint, build frontend
GitHub Actions: ssh to VPS, run /opt/gmat/deploy.sh
deploy.sh:
  cd /opt/gmat/backend && git pull && npm ci && npm run build
  cd /opt/gmat/frontend && git pull && npm ci && npm run build
  pm2 reload gmat-api
```

Files to add to the repo:

- `.github/workflows/deploy.yml` — runs on push to `main`, SSHes to VPS using a deploy key stored in GitHub Secrets.
- `deploy/deploy.sh` — the script above, idempotent.
- `deploy/Caddyfile` — committed reverse-proxy config.
- `deploy/ecosystem.config.js` — PM2 process definition.

For the first deploy, do it by hand (ssh + git clone + run) once so you know the box works. Then wire CI on top.

**Branch protection**: require the GitHub Actions check to pass before merging to `main`. Stops a broken push from blowing up production.

## 6. Environment & secrets

- `.env.production` lives on the server, **not in git**. Same shape as `backend/.env.example` (create one if missing).
- Secrets to populate: `MONGODB_URI`, `JWT_SECRET` (generate fresh — `openssl rand -base64 64`), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `MIXPANEL_TOKEN`, `OPENAI_API_KEY` (only if explanation generation runs in prod, otherwise omit).
- Boot-time guard: in `backend/src/index.ts`, fail fast if `NODE_ENV=production` and any required secret is missing. Don't fall back to dev defaults silently — that's how dev keys end up in prod.
- **Rotate the Razorpay key** before going live if the current one was ever pasted into chat / committed.

## 7. Cost ledger (estimated v1, monthly)

| Line item | Cost (₹/mo) | Cost (USD/mo) |
|---|--:|--:|
| Hetzner CX22 VPS | ₹420 | $5 |
| Domain (.com, amortised from $10/yr) | ₹70 | $0.85 |
| Cloudflare DNS / CDN | ₹0 | $0 |
| MongoDB (self-host on VPS) | ₹0 | $0 |
| Mixpanel (free tier ≤20M events) | ₹0 | $0 |
| UptimeRobot (free 50 monitors) | ₹0 | $0 |
| Email forwarding (Cloudflare) | ₹0 | $0 |
| **Total fixed** | **~₹490/mo** | **~$6/mo** |
| Razorpay fee per transaction | 2% of revenue | — |
| Optional: Atlas M2 (when self-host hurts) | ₹750 | $9 |
| Optional: Zoho Mail Lite (if you want to send mail, not just receive) | ₹59 | — |

Break-even: **one monthly subscription per month** (₹1,500) covers infra ~3×.

## 8. v2 backlog (deferred until v1 has traction)

These are the things you mentioned as "later" — capturing them so they don't drift:

- **CAT engine**: replace `getQuestions()` with an adaptive selector. Track per-user theta per topic, raise difficulty as accuracy holds. Probably means a new `QuizSession` model with running difficulty estimate. Big change — 2-3 weeks of focused work.
- **Weakness analytics**: aggregate `UserQuiz` × question `metadata.topic` / `subTopic` to surface "you're 32% on Number Properties → DS" with a "drill 10 questions on this" CTA. Cheap once quiz history page exists.
- **Recommended practice from history**: feeds CAT and weakness analytics — a separate `/practice/recommended` route that picks N questions weighted by the user's worst topics.
- **Real Razorpay Subscriptions** (recurring auto-debit, not one-time orders). See `Payments.md` § B for migration path.
- **Explanation QA** (Phase 3 in `QA_validator.md`).
- **MSR sub-question correctAnswer backfill** (95% drop rate per `QA_validator.md` baseline).
- **Quant ingestion unblock** (~1,800 JSONs sit unimported on disk; one folder-filter fix in `importQuantQuestionsToDb.ts`).
- **Image migration to your own CDN** (gmatclub.com hotlinks will break under load).

Don't start any of these until v1 has real users. They're prioritised in `PROJECT_PLAN_2026.md` already.

## 9. Go-to-market — low-confidence-friendly playbook

You said you're not comfortable posting on LinkedIn cold. That's fine — there's a sequence that builds proof first, public posts last.

### Stage 0 — pre-launch (week -1)

- Pick the brand: name, logo (use a free tool like Canva, don't overthink it), 1-page landing copy.
- Set up a single email (`support@yourdomain.com`) and a single Telegram support handle.
- Write 3 testimonials yourself in the voice you'd want users to write — these are placeholders to seed the social-proof section. Replace with real quotes as soon as you have them. (Do not publish fake testimonials with fake names — leave the section empty until real ones land, OR mark them clearly as "founder notes".)

### Stage 1 — friends & family beta (week 1, target: 5 users)

- DM 10-20 people you know who took GMAT recently or are studying. Not a public post. Ask them to use the platform free for a week and tell you what's broken.
- Goal: 5 people log in, take 3+ quizzes each. You're hunting bugs and getting real testimonial quotes.
- Outcome: 5 testimonials with first names + "studying for GMAT 2026" attribution. That's your proof.

### Stage 2 — community lurking & helping (weeks 2-4, target: 50 users)

These channels do not require you to be the centre of attention. You're being useful, the platform link is in your sig.

- **GMAT Club forum** (gmatclub.com): the largest GMAT community on the internet. Answer 5 questions/week. Don't drop your link in answers — put it in your forum signature ("Practice GMAT Focus questions free at <yourdomain.com>"). This is the highest-leverage channel by miles.
- **Reddit**: r/GMAT (~80k members), r/MBA. Same playbook — answer questions, link in flair/profile, never drop in comments.
- **Indian Telegram groups**: search "GMAT preparation" — there are several with thousands of members. Join, lurk, answer when you can, share once per week max.
- **Discord**: Beat The GMAT, GMAT Ninja, etc. Same pattern.
- **Quora**: answer 1-2 GMAT questions per week. Quora answers index in Google for years and bring slow but free traffic.

The discipline: **never spam, always be useful**. One value-add answer with a non-spammy link in your bio outperforms ten "check out my platform" comments.

### Stage 3 — content moat (weeks 4-12)

When you have ~30 active users + testimonials, you've got the proof to start producing content.

- **Blog on your own domain**: 1 post/week. Topics: "How to crack GMAT Focus DI in 2 weeks", "Why your DS approach is wrong", "Complete OG question taxonomy". SEO-optimised. Each post links to the relevant practice category on your platform. Slow burn, compounds for years.
- **YouTube** (optional, only if you're OK on camera): walkthrough of a hard OG question, 5-min videos. The market is huge and underserved with English+Indian creators.
- **Newsletter**: weekly "1 hard question, fully explained" email. Substack is free.

### Stage 4 — public posting (week 12+, only when you want to)

- LinkedIn now has the proof: "We launched 3 months ago, 200 users, here's what we learned" — this is **a story about users, not about you**. Easy to post.
- Optionally use a brand account (`gmatcompass` or whatever the name is) instead of your personal — you can post as the company, not as Piyush.
- Pin testimonials, founder story below.

### What NOT to do

- Don't pay for ads on day 1. CAC is unknowable without organic baseline.
- Don't spam r/GMAT with launch posts — moderators ban this fast and you can't recover the subreddit.
- Don't fake testimonials. The GMAT community is small and you'll get caught.

### Concrete week-1 ask

Make a list right now of 15 names to DM. Don't worry about the script — "Hey, I built a GMAT practice platform, want a free month to try it?" is enough.

## 10. Suggested 4-week timeline

| Week | Focus |
|---|---|
| Week 0 (now) | Knock out § 2A items: review page, score, history, webhook, expiry cron, secret hardening. |
| Week 1 | Provision VPS + domain + Caddy + first manual deploy. Set up GitHub Actions deploy. Backups + uptime monitor. |
| Week 2 | Soft-launch to 5 friends. Fix everything they break. Write 3 blog posts. |
| Week 3 | Open up to community channels (GMAT Club signature, Reddit). Target 50 signups. Track conversion in Mixpanel. |
| Week 4 | Iterate on the most-asked-for thing. Plan v2 (CAT or weakness analytics, whichever users beg for). |

## 11. Open questions / decisions you still need to make

- [ ] Brand name — needed to buy the domain.
- [ ] Razorpay business entity — sole proprietorship vs registered company. Affects KYC time.
- [ ] Free tier vs paid-only — currently paid plans are real but the free tier is generous. Decide what's gated where, document on pricing page.
- [ ] Single VPS in EU (cheap, ~150ms latency to India) vs paying more for AWS Mumbai (₹2k+/mo) — recommend EU for v1, revisit if users complain about latency.
- [ ] India-only or global from day 1 — Razorpay being INR-only nudges India-first. Add Stripe later if international demand shows up.
