// Data Insights - MSR Source interface
export interface MSRSource {
  tabName: string;
  content: string;
  images?: Array<{ src: string; alt?: string }>;
  tables?: Array<{ html: string; rows?: number; cols?: number }>;
}

// Data Insights - Sub-question interface
export interface SubQuestion {
  questionId: string;
  questionText: string;
  questionType: 'multiple_choice' | 'yes_no_table' | 'two_part_analysis';
  options?: Array<{ value: string; text: string }>;
  statements?: Array<{ text: string }>;
  columnHeaders?: string[];
  rowOptions?: string[];
  correctAnswer?: string | string[];
}

export interface Question {
  _id: string;
  questionText: string;
  questionType: string;
  subType?: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  category: string;
  tags: string[];
  paragraph?: string;
  source?: string;
  sourceDetails?: {
    url?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;

  // Data Insights specific fields
  msrSources?: MSRSource[];
  subQuestions?: SubQuestion[];
  artifactImages?: string[];
  artifactTables?: string[];
  artifactDescription?: string;
  passageText?: string;
  passageId?: string;
  rcNumber?: string;

  // Set client-side by flattenMsrSubQuestions(): each MSR stem expands into N
  // virtual entries so the main pager steps through sub-questions one at a
  // time. _msrSubIdx tells the MSR shell which sub-question to render;
  // _flattenKey is a stable React key that's unique even when entries share _id.
  _msrSubIdx?: number;
  _flattenKey?: string;
}