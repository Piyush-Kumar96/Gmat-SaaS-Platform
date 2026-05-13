/**
 * Tenancy service — single source of truth for account-scoped query filters.
 *
 * Use `tenantScope(req)` and `visibilityFilterForRead(req)` whenever a route
 * touches questions or quizzes. Composing filters by hand at the call site
 * is how scoping bugs slip through; the helpers below funnel everything
 * through one code path.
 *
 * The behavior depends on `featureFlags.QUESTION_SOURCE_MODE`:
 *   - 'legacy_global' (dev/test default): tenantScope() returns {} so the
 *     existing routes serve the global pool unchanged.
 *   - 'tenant_scoped' (production): tenantScope() returns
 *     `{ accountId: { $in: [userAccountId, ...legacyIfEnabled] } }`.
 *
 * Legacy access: a user with `legacyAccessEnabled=true` also sees questions
 * owned by any `role='admin'` user's account (the legacy / OG pool). The
 * super-admin's account is identified by ownership, not a hard-coded id, so
 * promoting a new admin grants the legacy pool to that admin's account too.
 *
 * See LAUNCH_BUILD_PLAN.md Phase 1 + 2 for the design.
 */
import mongoose from 'mongoose';
import { Request } from 'express';
import { User } from '../models/User';
import { featureFlags } from '../config/featureFlags';

export class TenancyMissingAccountError extends Error {
  code = 'TENANCY_MISSING_ACCOUNT';
  status = 500;
  constructor(userId?: string) {
    super(
      `User ${userId ?? '(unknown)'} has no accountId. The tenancy migration ` +
      '(scripts/migrations/001_create_personal_accounts.ts) probably has not ' +
      'run yet, or this user was created before tenancy went live.'
    );
  }
}

let cachedLegacyAccountIds: mongoose.Types.ObjectId[] | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns the set of accountIds whose owner has `role='admin'`. Cached for
 * 5 minutes to avoid hitting User on every request. Call
 * `clearLegacyAccountCache()` after you promote/demote an admin or move
 * the legacy pool.
 */
export async function getLegacyAccountIds(): Promise<mongoose.Types.ObjectId[]> {
  const now = Date.now();
  if (cachedLegacyAccountIds && (now - cacheLoadedAt) < CACHE_TTL_MS) {
    return cachedLegacyAccountIds;
  }
  const admins = await User.find(
    { role: 'admin', accountId: { $exists: true, $ne: null } },
    { accountId: 1 }
  ).lean();
  cachedLegacyAccountIds = admins
    .map((u: any) => u.accountId)
    .filter(Boolean);
  cacheLoadedAt = now;
  return cachedLegacyAccountIds;
}

export function clearLegacyAccountCache(): void {
  cachedLegacyAccountIds = null;
  cacheLoadedAt = 0;
}

/**
 * Mongoose filter that scopes a query to the caller's account (and optionally
 * the legacy pool if `legacyAccessEnabled=true`). Returns `{}` in legacy mode.
 *
 * Usage:
 *   const scope = await tenantScope(req);
 *   const questions = await QuestionBagV3.find({ ...scope, questionType: 'PS' });
 */
export async function tenantScope(req: Request): Promise<Record<string, any>> {
  // Per-user hard override. Independent of QUESTION_SOURCE_MODE — the admin
  // can flip a single user into "only see your own uploads" mode for
  // friends-testing without flipping the whole platform into tenant_scoped.
  if (req.user?.restrictedToOwnQuestions) {
    if (!req.user.accountId) {
      throw new TenancyMissingAccountError(req.user.userId);
    }
    return {
      accountId: new mongoose.Types.ObjectId(req.user.accountId),
    };
  }

  if (featureFlags.QUESTION_SOURCE_MODE === 'legacy_global') {
    return {};
  }
  if (!req.user) {
    // Unauthenticated requests cannot be tenant-scoped. Routes that need
    // scoping must require auth; if we reach here it's a programmer error.
    return { accountId: { $in: [] } }; // matches nothing
  }
  if (!req.user.accountId) {
    throw new TenancyMissingAccountError(req.user.userId);
  }
  const ids: mongoose.Types.ObjectId[] = [
    new mongoose.Types.ObjectId(req.user.accountId),
  ];
  if (req.user.legacyAccessEnabled) {
    const legacyIds = await getLegacyAccountIds();
    for (const id of legacyIds) {
      // Avoid duplicating own account if user is themselves an admin.
      if (!id.equals(ids[0])) ids.push(id);
    }
  }
  return { accountId: { $in: ids } };
}

/**
 * Additional filter for *reading* questions when the user is a regular
 * member of a business account. Members see only questions marked
 * `shared_within_account` plus their own private creations. Owners and
 * admins see everything in the account.
 *
 * For B2C individuals (alone in their account) this is a no-op since they
 * authored every doc and would match anyway, but it stays consistent.
 *
 * Returns a partial filter to spread alongside tenantScope().
 */
export function visibilityFilterForRead(req: Request): Record<string, any> {
  if (!req.user) return {};
  if (req.user.accountRole === 'owner' || req.user.accountRole === 'admin') {
    return {};
  }
  return {
    $or: [
      { visibility: 'shared_within_account' },
      { visibility: { $exists: false } }, // legacy docs without the field
      { createdByUserId: new mongoose.Types.ObjectId(req.user.userId) },
    ],
  };
}

/**
 * True when the caller is allowed to create / edit / delete questions in
 * their account. Members are read-only; owners and admins manage content.
 * Platform-level super-admins (User.role='admin') can always write.
 */
export function canManageAccountQuestions(req: Request): boolean {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  return req.user.accountRole === 'owner' || req.user.accountRole === 'admin';
}
