/**
 * AskedQuestion ledger
 *
 * One row per (user, question) the moment a question is *served* in a quiz.
 * Drives the no-repeat guarantee: the V2/V3 random endpoints subtract
 * `userId`'s ledger from the candidate pool before sampling.
 *
 * Notes:
 * - Written on serve (not on submit) so questions shown but skipped, or
 *   shown right before a crash, still count as "asked".
 * - `source` lets us namespace IDs across V2 / V3 / legacy collections —
 *   keeps the door open for cross-source reset scopes later.
 * - Bulk-inserted with `ordered:false` so a duplicate row from a retry
 *   doesn't fail the whole batch.
 */
import mongoose, { Document, Schema } from 'mongoose';

export type AskedQuestionSource = 'V2' | 'V3' | 'V1' | 'QuizItem';

export interface IAskedQuestion extends Document {
  userId: mongoose.Types.ObjectId;
  // Denormalized from the user at insert time. Optional during the Phase 1
  // rollout — migration backfills existing rows. After backfill, all writes
  // set it via the same code path that writes userId.
  accountId?: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  source: AskedQuestionSource;
  questionType: string;
  firstAskedAt: Date;
  lastAttemptId?: mongoose.Types.ObjectId;
  resetCount: number;
}

const AskedQuestionSchema = new Schema<IAskedQuestion>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', index: true },
  questionId: { type: Schema.Types.ObjectId, required: true },
  source: { type: String, enum: ['V2', 'V3', 'V1', 'QuizItem'], required: true },
  questionType: { type: String, required: true },
  firstAskedAt: { type: Date, default: Date.now },
  lastAttemptId: { type: Schema.Types.ObjectId },
  resetCount: { type: Number, default: 0 },
});

// Unique compound: a single (user, question) row regardless of how many
// times it shows up. Subsequent inserts dedup at the DB layer.
AskedQuestionSchema.index({ userId: 1, questionId: 1 }, { unique: true });
// For type-scoped reset and quick "what types has the user exhausted" lookups.
AskedQuestionSchema.index({ userId: 1, questionType: 1 });
// Tenant-scoped lookups (e.g. super-admin CRM "questions seen by this account").
AskedQuestionSchema.index({ accountId: 1, userId: 1 });

export const AskedQuestion = mongoose.model<IAskedQuestion>('AskedQuestion', AskedQuestionSchema);
