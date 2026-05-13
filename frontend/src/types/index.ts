export interface QuizItem {
  _id: string;
  chapter?: string;
  questionNumber?: number;
  type: string;
  questionText?: string;
  options?: string[];
  answerText?: string;
  explanationText?: string;
}

export interface QuizConfig {
  count: number;
  timeLimit: number;
  category?: string;
  questionType?: string;
  difficulty?: string | number;
  
  // Additional configuration options
  questionTypeMode?: 'balanced' | 'specific';
  difficultyMode?: 'mixed' | 'specific';
  categoryMode?: 'mixed' | 'specific';
  
  // New options for enhanced configuration
  questionMode?: 'all' | 'incorrect' | 'specific' | 'custom';
  timeMode?: 'unlimited' | 'timed';
  studyMode?: 'study' | 'exam';
  hours?: number;
  minutes?: number;
  
  // Multi-select options
  selectedQuestionTypes?: string[];
  selectedCategories?: string[];
  selectedDifficulties?: string[];
  
  // GMAT Focus Edition Configuration
  isGmatFocus?: boolean;
  sectionOrder?: GMATSection[];
  breakAfterSection?: number; // 1 = after first section, 2 = after second section
  sections?: GMATSectionConfig[];
  currentSection?: number;
  totalSections?: number;
  
  // Existing options for compatibility
  isMockTest?: boolean;
  isSectionalTest?: boolean;
  sectionName?: string;

  // Opt-in: when true, the random pull restricts to questions the editor
  // marked `readyForQuiz`. Off by default (non-enforcing).
  onlyReadyForQuiz?: boolean;
}

export interface QuizResult {
  questionId: string;
  // userAnswer is `string` for MC types; `string[]` for Yes/No tables;
  // `[col1,col2]` for TPA; or a per-sub map for MSR. Mixed for compat.
  userAnswer: any;
  // null when the question was shown but skipped (UserQuizV2 path).
  isCorrect: boolean | null;
  correctAnswer?: string;
  explanation?: string;

  // Additional fields for enhanced results display
  questionType?: string;
  questionText?: string;
  userAnswerText?: string;
  correctAnswerText?: string;
  passageText?: string | null;
  difficulty?: string;

  // V3 / DI fields surfaced for the rich review page. Optional and ignored
  // by non-DI cards.
  passageId?: string;
  msrSources?: any[];
  subQuestions?: any[];
  artifactImages?: string[];
  artifactTables?: string[];
  artifactDescription?: string;
  options?: Record<string, string> | string[];

  // V2-only enrichments (present when `schema === 'v2'` on the parent submission).
  order?: number;
  source?: 'V2' | 'V3' | 'V1' | 'QuizItem';
  timeSpentMs?: number;
  flaggedForReview?: boolean;
  answeredAt?: string | null;
}

export interface QuizSubmission {
  quizId: string;
  // Marks whether this came from UserQuizV2 (rich) or legacy UserQuiz.
  schema?: 'v2' | 'legacy';
  mode?: 'custom' | 'gmat-focus' | 'di-sectional';
  filtersUsed?: Record<string, any>;
  score: number;
  total: number;
  percentage: number;
  skippedCount?: number;
  perType?: Array<{ type: string; total: number; correct: number; skipped: number; avgTimeMs: number }>;
  results: QuizResult[];
  userQuizId?: string;

  // Additional fields for enhanced results display
  timeSpent?: number;
  startTime?: Date;
  endTime?: Date;
}

export interface GMATSectionConfig {
  name: GMATSection;
  questionCount: number;
  timeLimit: number; // in minutes
  questionTypes: string[];
  categories?: string[];
  completed?: boolean;
}

export type GMATSection = 'Quantitative Reasoning' | 'Verbal Reasoning' | 'Data Insights';

export interface GMATFocusState {
  currentSection: number;
  sectionsCompleted: boolean[];
  breakTaken: boolean;
  breakTimeLeft: number; // in seconds (600 = 10 minutes)
  isOnBreak: boolean;
  totalTimeSpent: number;
  sectionTimeSpent: number[];
}

// Add payment-related types
export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
  duration: string;
  features: string[];
  popular?: boolean;
}

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface PaymentRecord {
  _id: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'failed';
  method?: string;
  description: string;
  subscriptionPlan: string;
  createdAt: string;
  updatedAt: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// Extend User interface to include subscription info
export interface User {
  _id: string;
  email: string;
  fullName: string;
  role: 'free_mock' | 'monthly_pack' | 'quarterly_pack' | 'annual_pack';
  razorpayCustomerId?: string;
  createdAt: string;
  updatedAt: string;
} 