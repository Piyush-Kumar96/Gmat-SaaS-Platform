/**
 * Migration 001 — Create personal accounts for tenancy.
 *
 * Idempotent. Safe to re-run.
 *
 * What it does:
 *   1. Picks the platform super-admin user (env SUPERADMIN_EMAIL preferred,
 *      else the first User with role='admin' by createdAt).
 *   2. For each User without `accountId`, creates an `Account`
 *      (type='individual', name=user.fullName, ownerUserId=user._id) and
 *      links it back to user.accountId. Existing users keep accountRole='owner'.
 *   3. Ensures the super-admin user has legacyAccessEnabled=true so they
 *      retain visibility into the legacy/imported question pool.
 *   4. Backfills QuestionBagV2 / QuestionBagV3 docs that lack accountId:
 *      assigns them to the super-admin's account (the legacy holder).
 *   5. Backfills AskedQuestion / UserQuizV2 rows that lack accountId,
 *      copying it from the row's user.
 *
 * Run:
 *   cd backend && npx ts-node src/scripts/migrations/001_create_personal_accounts.ts
 *
 * Optional env:
 *   SUPERADMIN_EMAIL  — designate a specific admin as the legacy-pool owner
 *   DRY_RUN=true      — log counts without writing
 *
 * See `LAUNCH_BUILD_PLAN.md` Phase 1 for the design.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Account } from '../../models/Account';
import { User } from '../../models/User';
import { QuestionBagV2 } from '../../models/QuestionBagV2';
import { QuestionBagV3 } from '../../models/QuestionBagV3';
import { AskedQuestion } from '../../models/AskedQuestion';
import { UserQuizV2 } from '../../models/UserQuizV2';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz';
const DRY_RUN = ['1', 'true', 'yes', 'on'].includes((process.env.DRY_RUN || '').toLowerCase());

const log = (msg: string) => console.log(`[migration:001]${DRY_RUN ? ' [DRY-RUN]' : ''} ${msg}`);

async function pickSuperAdmin() {
  const explicitEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  if (explicitEmail) {
    const u = await User.findOne({ email: explicitEmail });
    if (!u) throw new Error(`SUPERADMIN_EMAIL=${explicitEmail} not found in DB`);
    return u;
  }
  const u = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (!u) {
    throw new Error(
      "No user with role='admin' found. Either set SUPERADMIN_EMAIL or " +
      "promote a user to admin before running this migration."
    );
  }
  return u;
}

async function ensureAccountForUser(user: any) {
  if (user.accountId) return user.accountId;
  if (DRY_RUN) {
    log(`would create individual account for ${user.email}`);
    return null;
  }
  const acct = await Account.create({
    type: 'individual',
    name: user.fullName || user.email,
    ownerUserId: user._id,
  });
  user.accountId = acct._id;
  user.accountRole = 'owner';
  await user.save();
  return acct._id;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  log(`connected to ${MONGODB_URI}`);

  // Step 1: pick super-admin
  const superAdmin = await pickSuperAdmin();
  log(`super-admin: ${superAdmin.email} (id=${superAdmin._id})`);

  // Step 2: ensure super-admin has an account first (legacy questions need it)
  const superAdminAccountId = await ensureAccountForUser(superAdmin);
  if (superAdminAccountId) {
    log(`super-admin accountId: ${superAdminAccountId}`);
  }

  // Step 3: legacyAccessEnabled on super-admin
  if (!superAdmin.legacyAccessEnabled && !DRY_RUN) {
    superAdmin.legacyAccessEnabled = true;
    await superAdmin.save();
    log(`enabled legacyAccessEnabled on super-admin`);
  }

  // Step 4: personal accounts for all other users
  const usersNeedingAccounts = await User.find({ accountId: { $exists: false } });
  log(`${usersNeedingAccounts.length} users need personal accounts`);
  let created = 0;
  for (const u of usersNeedingAccounts) {
    if (u._id.equals(superAdmin._id)) continue;
    await ensureAccountForUser(u);
    created++;
  }
  log(`created ${created} personal accounts`);

  // Step 5: backfill question pools — legacy docs go to super-admin's account
  if (!superAdminAccountId && !DRY_RUN) {
    throw new Error('superAdminAccountId missing post-step-2 — aborting');
  }
  const v2Result = DRY_RUN
    ? { matchedCount: await QuestionBagV2.countDocuments({ accountId: { $exists: false } }), modifiedCount: 0 }
    : await QuestionBagV2.updateMany(
        { accountId: { $exists: false } },
        { $set: { accountId: superAdminAccountId, createdByUserId: superAdmin._id, visibility: 'shared_within_account' } }
      );
  log(`QuestionBagV2: ${v2Result.matchedCount} matched, ${v2Result.modifiedCount} backfilled`);

  const v3Result = DRY_RUN
    ? { matchedCount: await QuestionBagV3.countDocuments({ accountId: { $exists: false } }), modifiedCount: 0 }
    : await QuestionBagV3.updateMany(
        { accountId: { $exists: false } },
        { $set: { accountId: superAdminAccountId, createdByUserId: superAdmin._id, visibility: 'shared_within_account' } }
      );
  log(`QuestionBagV3: ${v3Result.matchedCount} matched, ${v3Result.modifiedCount} backfilled`);

  // Step 6: backfill AskedQuestion + UserQuizV2 from user.accountId
  const allUsers = await User.find({ accountId: { $exists: true } }, { _id: 1, accountId: 1 });
  log(`backfilling AskedQuestion / UserQuizV2 for ${allUsers.length} users`);
  let askedTotal = 0;
  let quizTotal = 0;
  for (const u of allUsers) {
    if (!u.accountId) continue;
    if (DRY_RUN) {
      askedTotal += await AskedQuestion.countDocuments({ userId: u._id, accountId: { $exists: false } });
      quizTotal += await UserQuizV2.countDocuments({ userId: u._id, accountId: { $exists: false } });
      continue;
    }
    const a = await AskedQuestion.updateMany(
      { userId: u._id, accountId: { $exists: false } },
      { $set: { accountId: u.accountId } }
    );
    askedTotal += a.modifiedCount;
    const q = await UserQuizV2.updateMany(
      { userId: u._id, accountId: { $exists: false } },
      { $set: { accountId: u.accountId } }
    );
    quizTotal += q.modifiedCount;
  }
  log(`AskedQuestion: ${askedTotal} backfilled`);
  log(`UserQuizV2: ${quizTotal} backfilled`);

  await mongoose.disconnect();
  log('done');
  process.exit(0);
}

run().catch(async (err) => {
  console.error('[migration:001] FAILED:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
