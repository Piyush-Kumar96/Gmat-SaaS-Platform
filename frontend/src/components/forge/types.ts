/**
 * Question Forge — type definitions for the editor's working state.
 * The persisted shape lines up with backend QuestionBagV3.
 */

export type ForgeQuestionType =
  | 'CLASSIC'         // covers PS / DS / CR / RC — written to QuestionBagV2
  | 'DI-DS'
  | 'DI-GT-MC'        // editor-only flavor; persists as 'DI-GT' with options A-E
  | 'DI-GT-YESNO'     // editor-only flavor; persists as 'DI-GT' with subQuestions[yes_no_table]
  | 'DI-GT-DROPDOWN'  // editor-only flavor; persists as 'DI-GT' with subQuestions[multiple_choice] per blank
  | 'DI-MSR'
  | 'DI-TPA';

export type ClassicSubType = 'PS' | 'DS' | 'CR' | 'RC';

export interface ForgeOption {
  value: string;   // 'A' | 'B' | 'C' | 'D' | 'E'
  text: string;
}

export interface ForgeStatement {
  text: string;
}

export interface ForgeMSRSource {
  tabName: string;
  content: string;
  imageUrls: string[];
  tablesHtml: string[];
}

export type ForgeSubQuestionType = 'multiple_choice' | 'yes_no_table' | 'two_part_analysis';

export interface ForgeSubQuestion {
  questionId: string;
  questionText: string;
  questionType: ForgeSubQuestionType;
  // multiple_choice
  options?: ForgeOption[];
  correctMC?: string;          // 'A'..'E'
  // yes_no_table
  columnHeaders?: [string, string];
  statements?: ForgeStatement[];
  correctYesNo?: string[];     // per-row column index ('0' | '1')
  // two_part_analysis
  rowOptions?: string[];
  correctTPA?: [string, string];  // rowIdx per column, stringified
}

export interface ForgeArtifact {
  imageUrls: string[];
  tablesHtml: string[];
  description: string;
}

export interface ForgeState {
  // Always present
  forgeType: ForgeQuestionType;
  questionText: string;
  difficulty: string;          // 'Easy' | 'Medium' | 'Hard' | 'Very Hard'
  category: string;            // always 'Data Insights' for DI types
  source: string;              // human-readable origin (e.g., 'Manual entry', 'GMAT Club')
  sourceUrl: string;
  tags: string[];
  topic: string;
  subtopic: string;
  explanation: string;
  readyForQuiz: boolean;

  // Per-type
  options?: { A: string; B: string; C: string; D: string; E: string };
  correctAnswer?: string;
  artifact?: ForgeArtifact;
  msrSources?: ForgeMSRSource[];
  subQuestions?: ForgeSubQuestion[];

  // Classic (PS / DS / CR / RC) — only used when forgeType === 'CLASSIC'.
  classicType?: ClassicSubType;
  passageText?: string;        // RC passage / CR argument
  statement1?: string;         // DS only
  statement2?: string;         // DS only
}

/**
 * Editor question types presented to the user (cards on the type picker).
 */
export const FORGE_TYPES: Array<{
  id: ForgeQuestionType;
  label: string;
  shortLabel: string;
  blurb: string;
  accent: string;     // tailwind classes for the picker tile accent
}> = [
  {
    id: 'CLASSIC',
    label: 'Quant & Verbal — PS / DS / CR / RC',
    shortLabel: 'PS · DS · CR · RC',
    blurb: 'Single tile for non-DI types. Pick the type inside; PS gets a math symbol toolbar.',
    accent: 'bg-indigo-50 border-indigo-300 text-indigo-800'
  },
  // Standalone DI-DS tile removed — DS is fully handled inside the CLASSIC
  // tile above. The 'DI-DS' ForgeQuestionType is intentionally retained so
  // existing DI-DS docs in the bank still load into the editor (via
  // docToForge in DIEditorPage); they just can't be created from scratch
  // via the picker any more.
  {
    id: 'DI-GT-MC',
    label: 'Graphs & Tables — Multiple Choice',
    shortLabel: 'GT · MC',
    blurb: 'Chart or table + a 5-option question.',
    accent: 'bg-teal-50 border-teal-300 text-teal-800'
  },
  {
    id: 'DI-GT-YESNO',
    label: 'Graphs & Tables — Supported / Not Supported',
    shortLabel: 'GT · Yes/No',
    blurb: 'A data artifact + N statements with two-column radio.',
    accent: 'bg-emerald-50 border-emerald-300 text-emerald-800'
  },
  {
    id: 'DI-GT-DROPDOWN',
    label: 'Graphs & Tables — Dropdown Fill-in',
    shortLabel: 'GT · Dropdown',
    blurb: 'Fill blanks ([[1]], [[2]]…) from per-blank options.',
    accent: 'bg-cyan-50 border-cyan-300 text-cyan-800'
  },
  {
    id: 'DI-MSR',
    label: 'Multi-Source Reasoning',
    shortLabel: 'MSR',
    blurb: '2–3 source tabs + 3 sub-questions (MC or Yes/No).',
    accent: 'bg-purple-50 border-purple-300 text-purple-800'
  },
  {
    id: 'DI-TPA',
    label: 'Two-Part Analysis',
    shortLabel: 'TPA',
    blurb: 'Two-column radio table; one selection per column.',
    accent: 'bg-orange-50 border-orange-300 text-orange-800'
  }
];

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Very Hard'];
