/**
 * UserQuizV2 — per-attempt record for a user's quiz session.
 *
 * Replaces the legacy `UserQuiz`. Differences:
 *  - `userAnswer: Mixed` so we can store any shape — string (MC),
 *    string[] (Yes/No), [colA, colB] (TPA), or { [subQid]: answer } (MSR).
 *  - `source` per item ('V2'|'V3'|'V1'|'QuizItem') so the resolver in the
 *    detail endpoint knows which collection to look in. Mirrors the
 *    AskedQuestion ledger.
 *  - `timeSpentMs` is *real* per-question time, not faked from the total.
 *  - `flaggedForReview` lets a user mark a question for follow-up.
 *  - `mode` and `filtersUsed` retained for analytics + future "retry with
 *    same config".
 *  - `status` tracks in_progress / submitted / abandoned for future
 *    session-resume work. Only `submitted` rows show on the history list.
 *
 * What we deliberately do *not* include:
 *  - An immutable question snapshot. Today the detail endpoint re-resolves
 *    the live V2/V3/V1 doc per request — admin edits/deletes can mutate
 *    history. Tracked in backlog.md (low priority). When implemented, the
 *    snapshot field goes onto each item.
 */
import mongoose, { Document, Schema } from 'mongoose';

export type QuizMode = 'custom' | 'gmat-focus' | 'di-sectional';
export type ItemSource = 'V2' | 'V3' | 'V1' | 'QuizItem';
export type AttemptStatus = 'in_progress' | 'submitted' | 'abandoned';

export interface IUserQuizItem {
  order: number;
  questionId: mongoose.Types.ObjectId;
  // Which collection the questionId lives in. Drives the lookup in the
  // history detail endpoint and the AskedQuestion ledger.
  source: ItemSource;
  questionType: string;

  // Mixed bag for any answer shape:
  //  - PS / DS / CR / RC / DI-DS: single letter "A" .. "E"
  //  - DI-GT (Yes/No): string[] aligned to subQuestion order
  //  - DI-TPA: [columnAValue, columnBValue]
  //  - DI-MSR: { [subQuestionId]: answer }
  // `null` means the question was shown but not attempted.
  userAnswer: any;

  // Per-question correctness. `null` for skipped items. Computed at submit.
  isCorrect: boolean | null;

  // Real wall-clock time the user spent on this item (ms). Tracked by the
  // frontend timer per question.
  timeSpentMs: number;

  flaggedForReview: boolean;
  answeredAt: Date | null;
}

export interface IUserQuizV2 extends Document {
  userId: mongoose.Types.ObjectId;
  // Denormalized from the user at insert time so super-admin CRM and
  // business-account dashboards can scope quiz history without an extra
  // user-lookup join. Optional during Phase 1 rollout — migration backfills
  // existing rows.
  accountId?: mongoose.Types.ObjectId;
  // Per-attempt id. Generated on quiz serve so the same id flows through
  // serve → submit → history.
  quizId: mongoose.Types.ObjectId;
  mode: QuizMode;
  filtersUsed: Record<string, any>;

  startedAt: Date;
  submittedAt?: Date;
  timeSpent: number; // seconds, mirrors legacy field for the history list

  status: AttemptStatus;

  items: IUserQuizItem[];

  summary: {
    score: number;
    total: number;
    correctCount: number;
    skippedCount: number;
    perType: Array<{
      type: string;
      total: number;
      correct: number;
      skipped: number;
      avgTimeMs: number;
    }>;
  };
}

const UserQuizItemSchema = new Schema<IUserQuizItem>(
  {
    order: { type: Number, required: true },
    questionId: { type: Schema.Types.ObjectId, required: true },
    source: { type: String, enum: ['V2', 'V3', 'V1', 'QuizItem'], required: true },
    questionType: { type: String, required: true },
    userAnswer: { type: Schema.Types.Mixed, default: null },
    isCorrect: { type: Boolean, default: null },
    timeSpentMs: { type: Number, default: 0 },
    flaggedForReview: { type: Boolean, default: false },
    answeredAt: { type: Date, default: null },
  },
  { _id: false }
);

const UserQuizV2Schema = new Schema<IUserQuizV2>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', index: true },
  quizId: { type: Schema.Types.ObjectId, required: true, index: true },
  mode: { type: String, enum: ['custom', 'gmat-focus', 'di-sectional'], default: 'custom' },
  filtersUsed: { type: Schema.Types.Mixed, default: {} },

  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  timeSpent: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'abandoned'],
    default: 'submitted',
  },

  items: { type: [UserQuizItemSchema], default: [] },

  summary: {
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    perType: {
      type: [
        {
          type: { type: String },
          total: { type: Number },
          correct: { type: Number },
          skipped: { type: Number },
          avgTimeMs: { type: Number },
          _id: false,
        },
      ],
      default: [],
    },
    _id: false,
  },
}, { timestamps: true });

UserQuizV2Schema.index({ userId: 1, createdAt: -1 });
UserQuizV2Schema.index({ userId: 1, quizId: 1 }, { unique: true });
// Tenant-scoped history lookups (super-admin CRM, business-account dashboards).
UserQuizV2Schema.index({ accountId: 1, createdAt: -1 });

export const UserQuizV2 = mongoose.model<IUserQuizV2>('UserQuizV2', UserQuizV2Schema);
