# GMAT Quiz Platform - Project Plan 2026

## Executive Summary

This document outlines the complete roadmap to take the GMAT Focus Edition quiz platform from its current state to production. The project was initially developed in early 2025 and requires refinement across UI, data quality, payments, and analytics before launch.

**Current State**: Functional quiz platform with GMAT Focus Edition support, user authentication, Razorpay integration, and Mixpanel analytics. However, there are lint errors, basic admin UI, 254+ questions with data quality issues, incomplete payment features, and fragmented analytics implementation.
**Target State**: Production-ready platform with polished UI, validated question bank, complete payment flow, comprehensive analytics, and security hardening.

---

## Table of Contents

1. [Phase 1: UI Fixes & Lint Errors](#phase-1-ui-fixes--lint-errors)
2. [Phase 2: Question Bank Refinement](#phase-2-question-bank-refinement)
3. [Phase 3: Payments (Razorpay)](#phase-3-payments-razorpay)
4. [Phase 4: Analytics (Mixpanel)](#phase-4-analytics-mixpanel)
5. [Phase 5: Security Fixes](#phase-5-security-fixes)
6. [Phase 6: Production Deployment](#phase-6-production-deployment)
7. [AI Model Recommendations](#ai-model-recommendations)
8. [File Reference](#file-reference)

---

## Phase 1: UI Fixes & Lint Errors

### 1.1 Current Issues

#### TypeScript & Lint Problems

| Issue | Backend | Frontend |
|-------|---------|----------|
| ESLint Config | None | Minimal (CRA defaults) |
| TypeScript Strict Mode | `false` | `true` |
| `any` Type Usages | 117+ instances | 6 instances |
| Console Statements | 37 | 28 |
| Lint Scripts | None | None |

#### Admin Page Problems

The admin panel (`frontend/src/components/AdminPanel.tsx`) has several non-functional UI elements:

| Button | Current State |
|--------|---------------|
| Add User | Renders but no onClick handler |
| Export Data | Renders but no implementation |
| Filters | Renders but non-functional |

**Missing Admin Features**:
- No advanced search (only email, not name/phone/ID)
- No payment history view per user
- No bulk operations
- No analytics dashboard (revenue is calculated, not tracked)
- No user activity tracking
- No admin audit log

### 1.2 Tasks

#### Backend Lint Setup

```bash
# Install ESLint and TypeScript plugins
cd backend
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Files to create/modify**:
- `backend/.eslintrc.js` - ESLint configuration
- `backend/tsconfig.json` - Enable `strict: true`, `noImplicitAny: true`
- `backend/package.json` - Add lint scripts

#### Fix Type Issues (Priority Order)

1. **Express Request Types** (`backend/src/routes/quizRoutes.ts:22,40,94`)
   - Replace `req: any` with proper `Request` type

2. **Filter Object Types** (`backend/src/routes/questionBagV2Routes.ts:12,32,73,87,165`)
   - Create `QuestionFilter` interface instead of `any`

3. **Error Handling** (`backend/src/routes/paymentRoutes.ts:35,72,95,131`)
   - Replace `catch (error: any)` with proper error types

4. **Type Assertions** (`backend/src/services/paymentService.ts:176-179`)
   - Remove `as any` casts, fix User model types

#### Remove Console Statements

| Location | Count | Action |
|----------|-------|--------|
| `backend/src/scripts/*.ts` | 20+ | Remove all (development scripts) |
| `backend/src/routes/*.ts` | 10+ | Replace with proper logger |
| `frontend/src/pages/*.tsx` | 15+ | Remove all |
| `frontend/src/components/*.tsx` | 10+ | Remove all |

**Recommendation**: Install `winston` or `pino` for backend logging.

#### Admin Panel Enhancement

**All features to implement together**:

1. **User Management**
   - Full-text search (name, email, phone, ID)
   - Advanced filters (role, signup date, activity)
   - User detail modal with quiz history
   - Bulk select and operations
   - User creation form
   - User edit capabilities

2. **Payment Management**
   - View payment history per user
   - Transaction list with filters
   - Refund capability (after Phase 3)
   - Subscription status with expiry countdown

3. **Analytics Dashboard**
   - Revenue chart (daily/weekly/monthly trend)
   - User acquisition funnel
   - Active vs total users
   - Subscription breakdown pie chart
   - Recent signups timeline

4. **Admin Operations**
   - CSV/Excel export for users
   - Audit log of admin actions
   - Manual plan extension

**New Backend Endpoints**:

```typescript
POST   /api/admin/users              // Create user
GET    /api/admin/users/:id          // Get user with quiz/payment history
PUT    /api/admin/users/:id          // Update user
DELETE /api/admin/users/:id          // Delete user
GET    /api/admin/analytics          // Dashboard data
GET    /api/admin/audit-log          // Admin actions
POST   /api/admin/users/bulk         // Bulk operations
GET    /api/admin/export/users       // CSV export
```

**Files to Modify**:
- `frontend/src/components/AdminPanel.tsx` - Complete rewrite
- `backend/src/routes/adminRoutes.ts` - Add new endpoints
- `backend/src/models/AdminLog.ts` - New model for audit

### 1.3 Deliverables

- [ ] ESLint configured for backend
- [ ] TypeScript strict mode enabled
- [ ] All `any` types replaced with proper types
- [ ] Console statements removed
- [ ] Admin panel fully functional with all features
- [ ] Pre-commit hook with husky + lint-staged

---

## Phase 2: Question Bank Refinement

### 2.1 Current Issues

#### Data Quality Problems

| Issue | Count | Impact |
|-------|-------|--------|
| Truncated Options | 254 questions | Users see incomplete choices |
| Incomplete Option Instances | 375 total | Multiple options per question affected |
| LLM Processing Failures | 8+ questions | Never properly extracted |
| Inconsistent Answer Format | ~20% | "A", "A.", "A. The answer...", "Unknown" |
| Missing Explanations | ~40% | No learning value |

**Root Causes**:
1. Puppeteer extraction cut off text at page boundaries
2. Mistral 7B (local) timed out during processing
3. GPT-4o was used but had accuracy issues
4. No validation before database import

#### Data Model Overview

```
QuestionBagV2 (Primary - Use This)
├── questionText (required)
├── questionType (PS, DS, CR, RC)
├── options: Record<string, string>
├── correctAnswer (single letter)
├── passageText (for RC)
├── explanation
├── validationStatus ('perfect', 'needs_revision', 'unfixable', 'fixed')
├── validationIssues: string[]
└── proposedRevision: { questionText, options, correctAnswer, passageText }
```

### 2.2 AI Model Recommendations for Question Fixing

Based on December 2025 benchmarks, here are the recommended models (NOT GPT-4o):

| Model | Best For | Cost | Recommendation |
|-------|----------|------|----------------|
| **Claude Sonnet 4.5** | Text correction, writing quality | ~$3/1M tokens | **Primary choice** - Best for educational content |
| **Claude Opus 4.5** | Complex reasoning, accuracy | ~$15/1M tokens | Use for difficult cases |
| **DeepSeek V4** | Budget option | ~$0.28/1M tokens | Good for bulk processing |
| **Gemini 2.5 Pro** | Long documents | ~$1.25/1M tokens | Alternative for RC passages |

**Why NOT GPT-4o**:
- Claude 4.5 models score higher on text quality benchmarks
- Better at following complex formatting instructions
- More consistent output structure
- Better educational content generation

**Recommended Approach**:
1. Use **Claude Sonnet 4.5** for bulk option completion
2. Use **Claude Opus 4.5** for questions that fail first pass
3. Use **DeepSeek V4** for initial validation/audit (cost-effective)

### 2.3 Tasks

#### 2.3.1 Audit All Questions

**Create script**: `backend/src/scripts/auditAllQuestions.ts`

```typescript
// Output comprehensive report:
{
  totalQuestions: number,
  byType: { PS: number, DS: number, CR: number, RC: number },
  issues: {
    truncatedOptions: QuestionId[],
    missingAnswers: QuestionId[],
    missingExplanations: QuestionId[],
    invalidAnswerFormat: QuestionId[]
  }
}
```

#### 2.3.2 Fix Truncated Options (254 questions)

**Update script**: `backend/src/scripts/fixIncompleteOptions.ts`

**Algorithm**:
1. Load questions from `incomplete_options_report.json`
2. For each question with truncated options:
   - Send to Claude Sonnet 4.5 with prompt:
   ```
   Complete this GMAT question option that was truncated:
   Question: [questionText]
   Truncated option: "[optionLetter]. [truncatedText]..."

   Provide ONLY the complete option text, nothing else.
   ```
3. Update question in database
4. Set `validationStatus: 'fixed'`
5. Log change for review

#### 2.3.3 Standardize Answer Format

**Create script**: `backend/src/scripts/normalizeAnswers.ts`

```typescript
function normalizeAnswer(answer: string): string {
  // Handle: "A", "A.", "A)", "A. The prairie...", "Unknown"
  const match = answer.match(/^([A-E])/i);
  return match ? match[1].toUpperCase() : null;
}
```

#### 2.3.4 Generate Missing Explanations

**Update script**: `backend/src/scripts/generateEnhancedAIAnswers.ts`

- Use Claude Sonnet 4.5 for explanation generation
- Include question type-specific prompts (different for DS vs CR)
- Store with `metadata.explanationSource: 'claude-sonnet-4.5'`

#### 2.3.5 Admin Question Review UI

**New component**: `frontend/src/pages/QuestionReviewPage.tsx`

Features:
- List questions by `validationStatus`
- Edit question text, options, answer, explanation
- Approve/reject AI-fixed content
- Mark as 'perfect' or 'needs_revision'
- Bulk approve capability

#### 2.3.6 Quality Validation Pipeline

Before any question is served to users:
1. Check `validationStatus === 'perfect'` or `'fixed'`
2. Verify all 5 options exist and are non-empty
3. Verify `correctAnswer` is A-E and exists in options
4. Log questions that fail validation

### 2.4 Quality Targets

| Metric | Current | Target |
|--------|---------|--------|
| Complete options | 95.7% | 100% |
| Valid answer format | ~80% | 100% |
| Has explanation | ~60% | 100% |
| Validated | 0% | 100% |

### 2.5 Deliverables

- [ ] Full audit report of all questions
- [ ] 254 truncated questions fixed with Claude 4.5
- [ ] All answers normalized to single letter
- [ ] Explanations generated for all questions
- [ ] Admin question review UI
- [ ] Validation pipeline in quiz routes

---

## Phase 3: Payments (Razorpay)

### 3.1 Current State

**Working (85%)**:
- Order creation with unique receipts
- HMAC-SHA256 signature verification
- User subscription updates (role, plan, dates, limits)
- Payment history tracking
- Razorpay SDK integration (v1 Checkout)
- 6 payment statuses tracked

**Missing (15%)**:
- Webhook endpoint (CRITICAL)
- Refund processing
- Subscription expiry handling
- Email notifications
- Admin payment dashboard

### 3.2 Subscription Plans

| Plan | Price (INR) | Duration | Mock Test Limit |
|------|-------------|----------|-----------------|
| Monthly Pack | ₹1,500 | 1 month | Unlimited |
| Quarterly Pack | ₹3,500 | 3 months | Unlimited |
| Annual Pack | ₹6,000 | 1 year | Unlimited |

### 3.3 Tasks

#### 3.3.1 Implement Webhook Endpoint

**File**: `backend/src/routes/paymentRoutes.ts`

```typescript
POST /api/payments/webhook

// Handle events:
// - payment.captured → Update payment status, activate subscription
// - payment.failed → Mark failed, notify user
// - refund.created → Update payment with refund details
```

**Webhook signature validation**:
```typescript
const crypto = require('crypto');
const expectedSignature = crypto
  .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
```

#### 3.3.2 Add Refund Processing

**File**: `backend/src/services/paymentService.ts`

```typescript
async function processRefund(
  paymentId: string,
  amount?: number, // partial refund
  reason?: string
): Promise<RefundResult>
```

- Call Razorpay refund API
- Update Payment model with refund details
- Adjust user subscription if full refund

#### 3.3.3 Subscription Expiry Handling

**New file**: `backend/src/jobs/subscriptionChecker.ts`

- Run daily via cron (or node-schedule)
- Check `planInfo.endDate` for all paid users
- Auto-downgrade expired to 'registered' role
- Reset mock test limit to 2

```typescript
// Pseudo-code
const expiredUsers = await User.find({
  role: { $in: ['monthly_pack', 'quarterly_pack', 'annual_pack'] },
  'planInfo.endDate': { $lt: new Date() }
});

for (const user of expiredUsers) {
  user.role = 'registered';
  user.mockTestLimit = 2;
  await user.save();
  await sendExpiryEmail(user);
}
```

#### 3.3.4 Email Notifications

**New file**: `backend/src/services/emailService.ts`

Provider options: SendGrid, AWS SES, Resend

Emails to implement:
1. Payment confirmation receipt
2. Subscription activation
3. Expiry warning (7 days before)
4. Expiry warning (1 day before)
5. Plan expired notification
6. Refund confirmation

#### 3.3.5 Admin Payment Dashboard

Integrate into Admin Panel (from Phase 1):
- List all payments with filters (status, plan, date)
- View payment details
- Process refunds with confirmation dialog
- Export payment reports
- Revenue analytics chart

#### 3.3.6 Production Keys

1. Get production key_id and key_secret from Razorpay dashboard
2. Configure webhook URL: `https://yourdomain.com/api/payments/webhook`
3. Set webhook secret in Razorpay
4. Update environment variables

### 3.4 Deliverables

- [ ] Webhook endpoint implemented and tested
- [ ] Refund processing working
- [ ] Subscription expiry job running
- [ ] Email notifications configured
- [ ] Admin payment view in dashboard
- [ ] Production Razorpay keys configured

---

## Phase 4: Analytics (Mixpanel)

### 4.1 Current Issues

**Two conflicting implementations**:
1. `frontend/src/services/analytics.ts` - Hardcoded token (SECURITY RISK)
2. `frontend/src/services/mixpanelService.ts` - Uses env var (correct approach)

**Only 3 events tracked** out of 20+ defined:
- `user_signed_up` (RegisterPage)
- `user_logged_in` (LoginPage)
- `user_logged_out` (Navbar)

**Critical missing events**:
- Quiz started/completed (CORE PRODUCT)
- Question answered
- Payment initiated/completed
- Feature usage

### 4.2 Tasks

#### 4.2.1 Consolidate Analytics Services

1. **Keep**: `frontend/src/services/mixpanelService.ts` (uses env var)
2. **Delete**: `frontend/src/services/analytics.ts` (hardcoded token)
3. **Update imports** in:
   - `frontend/src/components/Navbar.tsx`
   - `frontend/src/pages/LoginPage.tsx`
   - `frontend/src/pages/RegisterPage.tsx`

#### 4.2.2 Remove Hardcoded Token

**File**: `frontend/src/services/analytics.ts` (before deletion)

```typescript
// REMOVE THIS LINE:
const MIXPANEL_TOKEN = '50f7707453bcac586b0a0ed8898fe2fa';

// Use environment variable:
const MIXPANEL_TOKEN = process.env.REACT_APP_MIXPANEL_TOKEN;
```

#### 4.2.3 Integrate useAnalytics Hook

**File**: `frontend/src/hooks/useAnalytics.ts` (already exists)

Add to `App.tsx` for automatic page view tracking:
```typescript
import { useAnalytics } from './hooks/useAnalytics';

function App() {
  useAnalytics(); // Auto page view tracking
  // ...
}
```

#### 4.2.4 Track Quiz Events

**Files**: `QuizPage.tsx`, `GMATFocusQuizPage.tsx`

```typescript
// Quiz started
analytics.trackQuizStarted({
  quizType: 'gmat_focus',
  questionCount: 64,
  timeLimit: 135,
  sectionOrder: ['Quantitative', 'Verbal', 'Data Insights']
});

// Question answered
analytics.trackQuestionAnswered({
  questionId: question._id,
  questionType: 'CR',
  selectedAnswer: 'B',
  isCorrect: true,
  timeSpent: 45
});

// Quiz completed
analytics.trackQuizCompleted({
  score: 580,
  correctAnswers: 42,
  totalQuestions: 64,
  totalTimeSpent: 7200
});
```

#### 4.2.5 Track Payment Events

**File**: `frontend/src/components/PaymentModal.tsx`

```typescript
// Payment initiated
analytics.track('payment_initiated', {
  plan: 'quarterly_pack',
  amount: 3500,
  currency: 'INR'
});

// Payment succeeded
analytics.track('payment_succeeded', {
  plan: 'quarterly_pack',
  amount: 3500,
  method: 'upi',
  orderId: 'order_xxx'
});

// Payment failed
analytics.track('payment_failed', {
  plan: 'quarterly_pack',
  error: 'User cancelled'
});
```

#### 4.2.6 Track Feature Usage

```typescript
// Feature accessed
analytics.track('feature_accessed', {
  feature: 'gmat_focus_quiz',
  userRole: 'quarterly_pack'
});

// Section completed (GMAT Focus)
analytics.track('gmat_focus_section_completed', {
  section: 'Quantitative',
  score: 21,
  timeSpent: 2400
});

// Question reviewed
analytics.track('question_reviewed', {
  questionId: 'xxx',
  questionType: 'RC'
});
```

#### 4.2.7 Production Setup

1. Create production Mixpanel project
2. Get production token
3. Set `REACT_APP_MIXPANEL_TOKEN` in production environment
4. Verify events flowing in Mixpanel dashboard

### 4.3 Events to Track (Complete List)

| Event | Page/Component | Priority |
|-------|----------------|----------|
| `page_view` | All pages (auto) | High |
| `user_signed_up` | RegisterPage | High |
| `user_logged_in` | LoginPage | High |
| `user_logged_out` | Navbar | Medium |
| `quiz_started` | QuizPage, GMATFocusQuizPage | **Critical** |
| `quiz_completed` | ResultsPage | **Critical** |
| `quiz_abandoned` | QuizPage (on leave) | High |
| `question_answered` | QuizPage | High |
| `question_flagged` | QuizPage | Medium |
| `question_reviewed` | ReviewPage | Medium |
| `payment_initiated` | PaymentModal | **Critical** |
| `payment_succeeded` | PaymentModal | **Critical** |
| `payment_failed` | PaymentModal | **Critical** |
| `plan_upgraded` | PaymentModal | High |
| `feature_accessed` | Various | Medium |
| `gmat_focus_section_started` | GMATFocusQuizPage | High |
| `gmat_focus_section_completed` | GMATFocusQuizPage | High |
| `gmat_focus_break_taken` | GMATFocusQuizPage | Low |
| `error_occurred` | ErrorBoundary | High |

### 4.4 Deliverables

- [ ] Single analytics service (delete duplicate)
- [ ] Hardcoded token removed
- [ ] useAnalytics hook integrated
- [ ] All critical events tracked
- [ ] Production Mixpanel configured
- [ ] Events verified in Mixpanel dashboard

---

## Phase 5: Security Fixes

### 5.1 Critical Issues

#### 5.1.1 Hardcoded JWT Secrets

**Files with default secrets**:
- `backend/src/middleware/authMiddleware.ts:5` → `'gmat-quiz-jwt-secret-key-dev'`
- `backend/src/middleware/auth.ts:4` → `'your-secret-key'`
- `backend/src/routes/authRoutes.ts:13-16` → Development defaults

**Fix**: Require env vars, fail startup if missing:
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

#### 5.1.2 Path Traversal Vulnerability

**File**: `backend/src/routes/fileRoutes.ts:30,50`

```typescript
// VULNERABLE:
const filePath = path.join(uploadDir, fileName);

// FIX:
const safeName = path.basename(fileName);
const filePath = path.join(uploadDir, safeName);
const normalizedPath = path.normalize(filePath);
if (!normalizedPath.startsWith(path.normalize(uploadDir))) {
  return res.status(400).json({ error: 'Invalid file path' });
}
```

#### 5.1.3 NoSQL Injection

**File**: `backend/src/routes/adminRoutes.ts:53`

```typescript
// VULNERABLE:
{ email: { $regex: email as string, $options: 'i' } }

// FIX:
const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
{ email: { $regex: escapeRegex(email), $options: 'i' } }
```

#### 5.1.4 Unauthenticated File Downloads

**File**: `backend/src/routes/fileRoutes.ts:47`

```typescript
// VULNERABLE:
router.get('/:fileName', (req, res) => { ... });

// FIX:
router.get('/:fileName', authenticateToken, (req, res) => { ... });
```

### 5.2 High Priority Issues

#### 5.2.1 File Upload Validation

**File**: `backend/src/routes/fileRoutes.ts:22-43`

Add validation:
```typescript
const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.json', '.csv'];
const ALLOWED_MIMETYPES = ['application/pdf', 'application/json', ...];

// Validate extension
const ext = path.extname(file.name).toLowerCase();
if (!ALLOWED_EXTENSIONS.includes(ext)) {
  return res.status(400).json({ error: 'Invalid file type' });
}

// Validate MIME type
if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
  return res.status(400).json({ error: 'Invalid file type' });
}
```

#### 5.2.2 parseInt Validation

**Multiple files**: Add proper validation:
```typescript
const page = parseInt(req.query.page as string);
if (isNaN(page) || page < 1) {
  page = 1;
}

const limit = parseInt(req.query.limit as string);
if (isNaN(limit) || limit < 1 || limit > 100) {
  limit = 10;
}
```

#### 5.2.3 Move Tokens to httpOnly Cookies

**File**: `frontend/src/services/authService.ts`

Currently uses localStorage (XSS vulnerable). Backend already sets httpOnly cookies.

```typescript
// Remove localStorage usage:
// localStorage.setItem('token', token);

// Rely on httpOnly cookies set by backend
// Credentials are sent automatically with { credentials: 'include' }
```

#### 5.2.4 Security Headers (Helmet)

**File**: `backend/src/index.ts`

```typescript
import helmet from 'helmet';
app.use(helmet());
```

#### 5.2.5 Environment Variable Validation

**File**: `backend/src/index.ts`

```typescript
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

### 5.3 Deliverables

- [ ] JWT secrets required from env vars
- [ ] Path traversal vulnerability fixed
- [ ] NoSQL injection fixed
- [ ] File downloads require authentication
- [ ] File upload validation added
- [ ] parseInt validation throughout
- [ ] Tokens moved to httpOnly cookies
- [ ] Helmet middleware added
- [ ] Env var validation at startup

---

## Phase 6: Production Deployment

### 6.1 Pre-deployment Checklist

#### Environment & Config
- [ ] Production MongoDB URI (Atlas or managed)
- [ ] Strong, unique JWT secrets (32+ characters)
- [ ] Production Razorpay keys
- [ ] Production Mixpanel token
- [ ] CORS configured for production domain
- [ ] All hardcoded dev values removed
- [ ] SSL/TLS certificate ready

#### Build & Test
- [ ] `npm run build` succeeds for both frontend and backend
- [ ] All lint errors fixed
- [ ] TypeScript strict mode passes
- [ ] Core user flows tested:
  - [ ] Registration → Login → Quiz → Results
  - [ ] Payment flow end-to-end
  - [ ] Admin panel operations

#### Security
- [ ] All Phase 5 security fixes implemented
- [ ] No secrets in source code
- [ ] File upload/download secured
- [ ] Rate limiting configured

#### Data
- [ ] All 254+ question issues resolved
- [ ] Question bank validated (100% pass rate)
- [ ] Database indexes optimized

#### Monitoring
- [ ] Error tracking (Sentry or similar)
- [ ] Analytics verified
- [ ] Structured logging (not console.log)
- [ ] Health check endpoint (`GET /api/health`)

### 6.2 Infrastructure Recommendations

| Component | Recommended Provider | Alternative |
|-----------|---------------------|-------------|
| Backend Hosting | Railway, Render | AWS EC2, DigitalOcean |
| Frontend Hosting | Vercel, Netlify | Cloudflare Pages |
| Database | MongoDB Atlas | Self-hosted MongoDB |
| CDN | Cloudflare | AWS CloudFront |
| Email | SendGrid, Resend | AWS SES |
| Error Tracking | Sentry | LogRocket |

### 6.3 Deployment Steps

1. **Setup Infrastructure**
   - Create production environment
   - Configure environment variables
   - Setup MongoDB Atlas cluster

2. **Deploy Backend**
   - Build: `npm run build`
   - Deploy to Railway/Render
   - Verify health check endpoint

3. **Deploy Frontend**
   - Build: `npm run build`
   - Deploy to Vercel/Netlify
   - Configure production API URL

4. **Configure External Services**
   - Razorpay: Set webhook URL
   - Mixpanel: Verify events flowing
   - Email: Configure sender domain

5. **DNS & SSL**
   - Point domain to hosting
   - Configure SSL certificate
   - Test HTTPS access

6. **Verify Production**
   - Test complete user flow
   - Test payment with ₹1 test
   - Verify analytics events
   - Check error tracking

### 6.4 Post-Launch Monitoring

- Monitor error rates in Sentry
- Check Mixpanel for user activity
- Review Razorpay dashboard for payments
- Monitor MongoDB Atlas metrics
- Set up alerts for:
  - Error rate spikes
  - Payment failures
  - Server response times

---

## AI Model Recommendations

### For Question Bank Fixing

Based on December 2025 benchmarks, these are the recommended models (replacing GPT-4o):

| Model | Use Case | Cost | Notes |
|-------|----------|------|-------|
| **Claude Sonnet 4.5** | Primary - Text completion, option fixing | ~$3/1M tokens | Best for educational content, highest text quality |
| **Claude Opus 4.5** | Fallback - Difficult cases, complex reasoning | ~$15/1M tokens | Use when Sonnet fails |
| **DeepSeek V4** | Bulk validation/audit | ~$0.28/1M tokens | 10x cheaper, good for initial passes |
| **Gemini 2.5 Pro** | Long RC passages | ~$1.25/1M tokens | 1M context window |

**Why NOT GPT-4o**:
- Claude 4.5 models outperform on text quality benchmarks
- More consistent structured output
- Better at following complex formatting instructions
- Claude Sonnet 4.5 is the #1 coding model (77.2% SWE-bench)

### API Integration

```typescript
// Using Anthropic SDK (Claude)
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20241022',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: `Complete this truncated GMAT option:
    Question: ${questionText}
    Truncated option: "${optionLetter}. ${truncatedText}..."

    Provide ONLY the complete option text.`
  }]
});
```

### Cost Estimation (254 questions)

| Model | Est. Tokens/Question | Total Cost |
|-------|---------------------|------------|
| Claude Sonnet 4.5 | ~500 | ~$0.38 |
| Claude Opus 4.5 (fallback 10%) | ~500 | ~$0.19 |
| **Total** | | **~$0.57** |

Sources:
- [LLM Comparison 2025](https://vertu.com/lifestyle/top-8-ai-models-ranked-gemini-3-chatgpt-5-1-grok-4-claude-4-5-more/)
- [Best AI of December 2025](https://felloai.com/the-best-ai-of-december-2025/)
- [AI Models Guide 2025](https://www.coronium.io/blog/ai-models-complete-guide-2025)

---

## File Reference

### Backend Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `backend/tsconfig.json` | 1 | Enable strict mode |
| `backend/.eslintrc.js` | 1 | New file |
| `backend/src/routes/quizRoutes.ts` | 1 | Fix `any` types |
| `backend/src/routes/questionBagV2Routes.ts` | 1 | Fix filter types |
| `backend/src/routes/paymentRoutes.ts` | 1, 3 | Fix types, add webhook |
| `backend/src/routes/adminRoutes.ts` | 1, 5 | Enhance + fix injection |
| `backend/src/routes/fileRoutes.ts` | 5 | Security fixes |
| `backend/src/services/paymentService.ts` | 1, 3 | Fix types, add refund |
| `backend/src/middleware/authMiddleware.ts` | 5 | Remove default secret |
| `backend/src/middleware/auth.ts` | 5 | Remove default secret |
| `backend/src/middleware/roleAuth.ts` | 5 | Remove default secret |
| `backend/src/index.ts` | 5 | Add helmet, env validation |
| `backend/src/scripts/fixIncompleteOptions.ts` | 2 | Update with Claude API |
| `backend/src/scripts/auditAllQuestions.ts` | 2 | New file |
| `backend/src/scripts/normalizeAnswers.ts` | 2 | New file |
| `backend/src/services/emailService.ts` | 3 | New file |
| `backend/src/jobs/subscriptionChecker.ts` | 3 | New file |
| `backend/src/models/AdminLog.ts` | 1 | New file |

### Frontend Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `frontend/src/components/AdminPanel.tsx` | 1 | Complete enhancement |
| `frontend/src/pages/QuizPage.tsx` | 1, 4 | Remove console, add analytics |
| `frontend/src/pages/GMATFocusQuizPage.tsx` | 1, 4 | Remove console, add analytics |
| `frontend/src/pages/LoginPage.tsx` | 4 | Update analytics import |
| `frontend/src/pages/RegisterPage.tsx` | 1, 4 | Remove console, update analytics |
| `frontend/src/components/Navbar.tsx` | 4 | Update analytics import |
| `frontend/src/components/PaymentModal.tsx` | 4 | Add analytics |
| `frontend/src/services/analytics.ts` | 4 | Delete file |
| `frontend/src/services/authService.ts` | 5 | Remove localStorage |
| `frontend/src/App.tsx` | 4 | Add useAnalytics hook |
| `frontend/src/pages/QuestionReviewPage.tsx` | 2 | New file |

---

## Summary

| Phase | Priority | Scope | Dependencies |
|-------|----------|-------|--------------|
| 1. UI/Lint Fixes | High | ~25 files | None |
| 2. Question Bank | Critical | Scripts + 254 questions | Phase 1 (lint) |
| 3. Payments | Medium | ~5 files | Phase 5.1 (secrets) |
| 4. Analytics | Medium | ~8 files | Phase 1 (cleanup) |
| 5. Security | Critical | ~12 files | None |
| 6. Production | Final | Config + deploy | All above |

**Execution Order**: 1 → 2 → 5 → 3 → 4 → 6

This ensures the codebase is clean before making structural changes, critical product value (questions) is fixed early, security is addressed before adding payment features, and analytics is added last when the product is stable.

---

*Document created: January 2026*
*Last updated: January 2026*
