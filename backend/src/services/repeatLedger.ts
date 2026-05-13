/**
 * Repeat-question ledger service.
 *
 * Wraps the AskedQuestion collection. Two reset surfaces hit this:
 *   - admin reset (`/api/admin/users/:userId/repeats/reset`) — no cooldown.
 *   - user self-reset (`/api/me/repeats/reset`) — gated to quarterly_pack /
 *     annual_pack / admin and capped at one reset per 90 days.
 */
import { AskedQuestion } from '../models/AskedQuestion';
import { User } from '../models/User';
import mongoose from 'mongoose';

export interface ResetScope {
  // When provided, only ledger rows for this question type are wiped.
  // Useful when a user wants to redo only "Critical Reasoning" but keep
  // their "Reading Comprehension" exclusions intact.
  questionType?: string;
}

export interface ResetResult {
  deletedCount: number;
  scope: ResetScope;
  resetAt: Date;
}

const SELF_RESET_COOLDOWN_DAYS = 90;
const SELF_RESET_ELIGIBLE_ROLES = new Set(['quarterly_pack', 'annual_pack', 'admin']);

export const resetUserRepeats = async (
  userId: mongoose.Types.ObjectId | string,
  scope: ResetScope = {}
): Promise<ResetResult> => {
  const filter: any = { userId };
  if (scope.questionType) filter.questionType = scope.questionType;

  const result = await AskedQuestion.deleteMany(filter);
  const resetAt = new Date();

  // Bump the audit field on the user. We reuse the existing `resetInfo`
  // sub-doc that was declared but not previously read — repurposing it
  // for the repeat-question reset, which is the only "reset" semantic
  // we expose to users today.
  await User.findByIdAndUpdate(userId, {
    $set: { 'resetInfo.hasUsedReset': true, 'resetInfo.resetDate': resetAt },
    $inc: { 'resetInfo.resetCount': 1 },
  });

  return {
    deletedCount: result.deletedCount || 0,
    scope,
    resetAt,
  };
};

export interface SelfResetEligibility {
  allowed: boolean;
  reason?: 'plan' | 'cooldown';
  cooldownEndsAt?: Date;
  daysRemaining?: number;
}

/**
 * Check whether `user` can self-reset *now*.
 * - Plan gate: only quarterly_pack / annual_pack / admin.
 * - Cooldown: 90 days since the last reset (admin bypasses).
 */
export const checkSelfResetEligibility = (user: {
  role: string;
  resetInfo?: { resetDate?: Date | string };
}): SelfResetEligibility => {
  if (!SELF_RESET_ELIGIBLE_ROLES.has(user.role)) {
    return { allowed: false, reason: 'plan' };
  }
  if (user.role === 'admin') {
    return { allowed: true };
  }
  const last = user.resetInfo?.resetDate ? new Date(user.resetInfo.resetDate) : null;
  if (!last) return { allowed: true };

  const cooldownEndsAt = new Date(last.getTime() + SELF_RESET_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  if (cooldownEndsAt.getTime() <= Date.now()) {
    return { allowed: true };
  }
  const daysRemaining = Math.ceil((cooldownEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return { allowed: false, reason: 'cooldown', cooldownEndsAt, daysRemaining };
};

export const SELF_RESET_COOLDOWN_DAYS_CONST = SELF_RESET_COOLDOWN_DAYS;
