/**
 * QuestionBagV2 Model
 * 
 * Enhanced question model for GMAT preparation platform.
 * This model represents an improved version of the QuestionBag model with better
 * support for various question types (RC, CR, PS, DS) and additional metadata.
 * 
 * It includes structured fields for source tracking, passage text for RC questions,
 * statistics, and enhanced organization capabilities.
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * Interface defining the structure of a QuestionBagV2 document
 * 
 * @property questionText - The text of the GMAT question
 * @property questionType - The type of question (PS, DS, CR, RC, etc.)
 * @property options - Object mapping option letters to their text content
 * @property correctAnswer - The letter of the correct answer option
 * @property difficulty - Difficulty rating of the question
 * @property source - Source of the question (e.g., GMAT Prep, Official Guide)
 * @property tags - Tags for categorizing the question
 * @property passageText - For RC questions, the full reading passage; for CR questions, the argument
 * @property questionNumber - Question number/identifier
 */
export interface IQuestionBagV2 extends Document {
  questionText: string;
  questionType: string;
  options: Record<string, string>;
  correctAnswer: string;
  difficulty: string;
  source: string;
  sourceDetails: {
    url: string;
    [key: string]: any;
  };
  category: string;
  tags: string[];
  passageText?: string;
  explanation?: string;
  rcNumber?: string;
  questionNumber?: number;
  metadata: {
    topic?: string;
    subtopic?: string;
    [key: string]: any;
  };
  statistics: {
    answeredCount: number;
    correctPercentage: string;
    answerStats?: {
      a?: string;
      b?: string;
      c?: string;
      d?: string;
      e?: string;
      [key: string]: any;
    };
    sessionStats?: {
      difficultyLevel?: string;
      difficultyCategory?: string;
      correctTime?: string;
      wrongPercentage?: string;
      wrongTime?: string;
      sessionsCount?: string;
      [key: string]: any;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  validationStatus: string | null;
  validationIssues: string[];
  proposedRevision: {
    questionText: string;
    options: string[];
    correctAnswer: string;
    passageText: string;
  } | null;
  // Editor-controlled flag. When the random-pull endpoints receive
  // `onlyReadyForQuiz=true` they restrict to docs with this set to true.
  // Default false so legacy questions don't get retroactively gated; the
  // filter is opt-in per request rather than enforced.
  readyForQuiz?: boolean;

  // ---- Similarity / "more questions like this" surface ----
  // Populated later by an LLM tagging pass (script in
  // `scripts/tagSimilarity.ts`, intentionally not executed yet — tagging
  // strategy is being defined). Indexed so the future "more like this"
  // endpoint can do `topicCluster + difficultyBand` lookups cheaply.
  skillTags?: string[];
  topicCluster?: string;
  difficultyBand?: '500-600' | '600-700' | '700-800';

  // ---- Tenancy (Phase 1) ----
  // Owning account. Optional during the rollout — migration backfills the
  // legacy pool to the super-admin's account. Tenant-scoped routes filter
  // by this field when `QUESTION_SOURCE_MODE=tenant_scoped`.
  accountId?: mongoose.Types.ObjectId;
  createdByUserId?: mongoose.Types.ObjectId;
  visibility?: 'private_to_creator' | 'shared_within_account';
}

/**
 * Mongoose schema for the QuestionBagV2 model
 * 
 * Defines fields, validation, and indexes for efficient queries
 */
const QuestionBagV2Schema = new Schema<IQuestionBagV2>(
  {
    questionText: { type: String, required: true },
    questionType: { type: String, required: true },
    options: { type: Schema.Types.Mixed, required: true },
    correctAnswer: { type: String, required: true },
    difficulty: { type: String, default: 'Medium' },
    source: { type: String, required: true },
    sourceDetails: {
      url: { type: String, default: '' },
      _id: false
    },
    category: { type: String, required: true },
    tags: [{ type: String }],
    passageText: { type: String },
    explanation: { type: String },
    rcNumber: { type: String },
    questionNumber: { type: Number },
    metadata: {
      topic: { type: String },
      subtopic: { type: String },
      _id: false
    },
    statistics: {
      answeredCount: { type: Number, default: 0 },
      correctPercentage: { type: String, default: '' },
      answerStats: {
        a: { type: String },
        b: { type: String },
        c: { type: String },
        d: { type: String },
        e: { type: String },
        _id: false
      },
      sessionStats: {
        difficultyLevel: { type: String },
        difficultyCategory: { type: String },
        correctTime: { type: String },
        wrongPercentage: { type: String },
        wrongTime: { type: String },
        sessionsCount: { type: String },
        _id: false
      },
      _id: false
    },
    validationStatus: {
      type: String,
      enum: ['perfect', 'needs_revision', 'unfixable', 'fixed'],
      default: null
    },
    validationIssues: [{
      type: String
    }],
    proposedRevision: {
      questionText: String,
      options: [String],
      correctAnswer: String,
      passageText: String
    },
    readyForQuiz: { type: Boolean, default: false },

    // Similarity tagging — populated by the LLM script later.
    skillTags: [{ type: String }],
    topicCluster: { type: String },
    difficultyBand: { type: String, enum: ['500-600', '600-700', '700-800', null], default: null },

    // Tenancy (Phase 1). Optional until migration backfills the legacy pool.
    accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    visibility: {
      type: String,
      enum: ['private_to_creator', 'shared_within_account'],
      default: 'shared_within_account',
    },
  },
  {
    timestamps: true  // Automatically add createdAt and updatedAt timestamps
  }
);

// Create indexes for better query performance
QuestionBagV2Schema.index({ questionType: 1 });       // Index for filtering by question type
QuestionBagV2Schema.index({ difficulty: 1 });         // Index for filtering by difficulty
QuestionBagV2Schema.index({ category: 1 });           // Index for filtering by category
QuestionBagV2Schema.index({ tags: 1 });               // Index for filtering by tags
QuestionBagV2Schema.index({ source: 1 });             // Index for filtering by source
QuestionBagV2Schema.index({ rcNumber: 1 });           // Index for grouping RC questions
QuestionBagV2Schema.index({ questionNumber: 1 });     // Index for filtering by question number
QuestionBagV2Schema.index({ 'metadata.topic': 1 });   // Index for filtering by topic
QuestionBagV2Schema.index({ readyForQuiz: 1 });       // Index for the opt-in random-pull filter
// Similarity-lookup indices. Compound matches the future "more like this"
// query shape (topicCluster + difficultyBand). skillTags is multikey for
// tag-set membership queries.
QuestionBagV2Schema.index({ topicCluster: 1, difficultyBand: 1 });
QuestionBagV2Schema.index({ skillTags: 1 });
// Tenancy: primary scoping query is `accountId + questionType` for the
// random-pull endpoints under tenant_scoped mode.
QuestionBagV2Schema.index({ accountId: 1, questionType: 1 });
QuestionBagV2Schema.index({ accountId: 1, createdByUserId: 1 });

/**
 * The QuestionBagV2 model for interacting with the questions collection in MongoDB
 * 
 * Used for CRUD operations on enhanced GMAT questions
 */
export const QuestionBagV2 = mongoose.model<IQuestionBagV2>('QuestionBagV2', QuestionBagV2Schema); 