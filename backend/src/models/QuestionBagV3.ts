/**
 * QuestionBagV3 Model
 *
 * Enhanced question model for GMAT preparation platform.
 * This model is a replica of QuestionBagV2 with additional support for
 * RC passage grouping via the passageId field.
 *
 * Key addition: passageId field for grouping RC questions by passage,
 * enabling efficient querying of all questions from the same reading passage.
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * Interface for MSR (Multi-Source Reasoning) source tabs
 */
export interface IMSRSource {
  tabName: string;
  content: string;
  images?: Array<{ src: string; alt?: string }>;
  tables?: Array<{ html: string; rows?: number; cols?: number }>;
}

/**
 * Interface for sub-questions within MSR or TPA questions
 */
export interface ISubQuestion {
  questionId: string;
  questionText: string;
  questionType: 'multiple_choice' | 'yes_no_table' | 'two_part_analysis';
  options?: Array<{ value: string; text: string }>;
  statements?: Array<{ text: string }>;
  columnHeaders?: string[];  // e.g., ["Yes", "No"] or ["Fair", "Discussion"]
  rowOptions?: string[];     // for TPA values
  correctAnswer?: string | string[];  // Can be single or multiple for yes/no tables
}

/**
 * Interface defining the structure of a QuestionBagV3 document
 *
 * @property questionText - The text of the GMAT question
 * @property questionType - The type of question (PS, DS, CR, RC, DI-MSR, DI-TPA, DI-GT, etc.)
 * @property options - Object mapping option letters to their text content
 * @property correctAnswer - The letter of the correct answer option
 * @property difficulty - Difficulty rating of the question
 * @property source - Source of the question (e.g., GMAT Prep, Official Guide)
 * @property tags - Tags for categorizing the question
 * @property passageText - For RC questions, the full reading passage; for CR questions, the argument
 * @property passageId - NEW: Unique identifier for RC passages (e.g., 'rc_gmatprep_134')
 * @property questionNumber - Question number/identifier
 * @property msrSources - For MSR questions, array of source tabs
 * @property subQuestions - For MSR/TPA questions, array of sub-questions
 * @property artifactImages - Array of image URLs for graphs/tables
 * @property artifactTables - Array of HTML table strings
 */
export interface IQuestionBagV3 extends Document {
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
  passageId?: string;  // NEW: For RC passage grouping (e.g., 'rc_gmatprep_134')
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
  extractionVersion?: string;  // Track which extraction pipeline version was used
  entryMethod?: 'manual' | 'scraped' | 'ai_generated' | 'pdf_import' | 'excel_import' | 'unknown';  // How the question entered the DB (vs `source` which is the content origin)
  // Editor-controlled flag — opt-in `onlyReadyForQuiz=true` filter on the
  // random-pull endpoint restricts to docs with this set to true. Default
  // false so existing questions aren't retroactively gated.
  readyForQuiz?: boolean;

  // ---- Similarity / "more questions like this" surface ----
  // Populated by `scripts/tagSimilarity.ts` (LLM pass, not yet run).
  // Same shape as V2 so the future similar-question endpoint can union
  // both collections without normalisation.
  skillTags?: string[];
  topicCluster?: string;
  difficultyBand?: '500-600' | '600-700' | '700-800';

  // Data Insights specific fields
  msrSources?: IMSRSource[];        // For MSR: array of source tabs
  subQuestions?: ISubQuestion[];    // For MSR/TPA: sub-questions
  artifactImages?: string[];        // URLs of images (graphs/charts)
  artifactTables?: string[];        // HTML strings of tables
  artifactDescription?: string;     // Description of the artifact

  // ---- Tenancy (Phase 1) ----
  // Owning account. Optional during the rollout — migration backfills the
  // legacy pool to the super-admin's account. Tenant-scoped routes filter
  // by this field when `QUESTION_SOURCE_MODE=tenant_scoped`.
  accountId?: mongoose.Types.ObjectId;
  createdByUserId?: mongoose.Types.ObjectId;
  visibility?: 'private_to_creator' | 'shared_within_account';
}

/**
 * Mongoose schema for the QuestionBagV3 model
 *
 * Defines fields, validation, and indexes for efficient queries
 */
const QuestionBagV3Schema = new Schema<IQuestionBagV3>(
  {
    questionText: { type: String, required: true },
    questionType: { type: String, required: true },
    options: { type: Schema.Types.Mixed, default: {} },
    // For DI-MSR / DI-TPA / DI-GT (Yes/No, Dropdown) the top-level correctAnswer is empty —
    // the real answer lives inside subQuestions[i].correctAnswer. Allow empty string here.
    correctAnswer: { type: String, default: '' },
    difficulty: { type: String, default: 'Medium' },
    source: { type: String, required: true },
    sourceDetails: {
      url: { type: String, default: '' },
      _id: false
    },
    category: { type: String, required: true },
    tags: [{ type: String }],
    passageText: { type: String },
    passageId: { type: String },  // NEW: For RC passage grouping
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
      enum: ['perfect', 'needs_revision', 'unfixable', 'fixed', null],
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
    extractionVersion: { type: String, default: 'v3' },
    entryMethod: {
      type: String,
      enum: ['manual', 'scraped', 'ai_generated', 'pdf_import', 'excel_import', 'unknown'],
      default: 'unknown'
    },
    readyForQuiz: { type: Boolean, default: false },

    // Similarity tagging — populated by the LLM script later.
    skillTags: [{ type: String }],
    topicCluster: { type: String },
    difficultyBand: { type: String, enum: ['500-600', '600-700', '700-800', null], default: null },

    // Data Insights specific fields
    msrSources: [{
      tabName: { type: String },
      content: { type: String },
      images: [{
        src: { type: String },
        alt: { type: String }
      }],
      tables: [{
        html: { type: String },
        rows: { type: Number },
        cols: { type: Number }
      }],
      _id: false
    }],
    subQuestions: [{
      questionId: { type: String },
      questionText: { type: String },
      questionType: { type: String, enum: ['multiple_choice', 'yes_no_table', 'two_part_analysis'] },
      options: [{
        value: { type: String },
        text: { type: String }
      }],
      statements: [{
        text: { type: String }
      }],
      columnHeaders: [{ type: String }],
      rowOptions: [{ type: String }],
      correctAnswer: { type: Schema.Types.Mixed },  // Can be string or array
      _id: false
    }],
    artifactImages: [{ type: String }],
    artifactTables: [{ type: String }],
    artifactDescription: { type: String },

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
QuestionBagV3Schema.index({ questionType: 1 });       // Index for filtering by question type
QuestionBagV3Schema.index({ difficulty: 1 });         // Index for filtering by difficulty
QuestionBagV3Schema.index({ category: 1 });           // Index for filtering by category
QuestionBagV3Schema.index({ tags: 1 });               // Index for filtering by tags
QuestionBagV3Schema.index({ source: 1 });             // Index for filtering by source
QuestionBagV3Schema.index({ rcNumber: 1 });           // Index for grouping RC questions (legacy)
QuestionBagV3Schema.index({ passageId: 1 });          // NEW: Index for RC passage grouping
QuestionBagV3Schema.index({ questionNumber: 1 });     // Index for filtering by question number
QuestionBagV3Schema.index({ 'metadata.topic': 1 });   // Index for filtering by topic
QuestionBagV3Schema.index({ validationStatus: 1 });   // Index for filtering by validation status
QuestionBagV3Schema.index({ entryMethod: 1 });        // Index for filtering by how the question was entered
QuestionBagV3Schema.index({ readyForQuiz: 1 });       // Index for the opt-in random-pull filter
// Similarity lookup indices — see V2 for shape rationale.
QuestionBagV3Schema.index({ topicCluster: 1, difficultyBand: 1 });
QuestionBagV3Schema.index({ skillTags: 1 });
// Tenancy: primary scoping query is `accountId + questionType` for the
// random-pull endpoints under tenant_scoped mode.
QuestionBagV3Schema.index({ accountId: 1, questionType: 1 });
QuestionBagV3Schema.index({ accountId: 1, createdByUserId: 1 });

/**
 * The QuestionBagV3 model for interacting with the questions collection in MongoDB
 *
 * Used for CRUD operations on enhanced GMAT questions with RC passage grouping
 */
export const QuestionBagV3 = mongoose.model<IQuestionBagV3>('QuestionBagV3', QuestionBagV3Schema);
