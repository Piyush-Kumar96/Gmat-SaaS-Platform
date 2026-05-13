import { ForgeQuestionType, ForgeState } from './types';

/**
 * Canonical Data Sufficiency option text. These five options appear on every DS
 * question verbatim.
 */
export const DS_OPTIONS = {
  A: 'Statement (1) alone is sufficient, but statement (2) alone is not sufficient.',
  B: 'Statement (2) alone is sufficient, but statement (1) alone is not sufficient.',
  C: 'Both statements together are sufficient, but neither statement alone is sufficient.',
  D: 'Each statement alone is sufficient.',
  E: 'Statements (1) and (2) together are not sufficient.'
};

const baseCommon = (forgeType: ForgeQuestionType): Pick<ForgeState,
  'forgeType' | 'questionText' | 'difficulty' | 'category' | 'source' | 'sourceUrl' | 'tags' | 'topic' | 'subtopic' | 'explanation' | 'readyForQuiz'
> => ({
  forgeType,
  questionText: '',
  difficulty: 'Medium',
  category: 'Data Insights',
  source: 'Manual entry',
  sourceUrl: '',
  tags: [],
  topic: '',
  subtopic: '',
  explanation: '',
  readyForQuiz: false
});

const blankArtifact = () => ({ imageUrls: [], tablesHtml: [], description: '' });
const emptyOptions = () => ({ A: '', B: '', C: '', D: '', E: '' });

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const buildTemplate = (forgeType: ForgeQuestionType): ForgeState => {
  switch (forgeType) {
    case 'CLASSIC':
      return {
        ...baseCommon('CLASSIC'),
        category: 'Quantitative',     // overridden when classicType changes
        classicType: 'PS',
        questionText: '',
        passageText: '',
        statement1: '',
        statement2: '',
        options: emptyOptions(),
        correctAnswer: '',
        tags: ['Manual entry']
      };

    case 'DI-DS':
      return {
        ...baseCommon('DI-DS'),
        questionText: '',
        options: { ...DS_OPTIONS },
        correctAnswer: '',
        tags: ['DI-DS', 'Data Sufficiency']
      };

    case 'DI-GT-MC':
      return {
        ...baseCommon('DI-GT-MC'),
        artifact: blankArtifact(),
        options: emptyOptions(),
        correctAnswer: '',
        tags: ['DI-GT', 'Graphs and Tables']
      };

    case 'DI-GT-YESNO':
      return {
        ...baseCommon('DI-GT-YESNO'),
        artifact: blankArtifact(),
        tags: ['DI-GT', 'Graphs and Tables', 'Yes/No'],
        subQuestions: [{
          questionId: uid('gt_yn'),
          questionText: '',
          questionType: 'yes_no_table',
          columnHeaders: ['Supported', 'Not supported'],
          statements: [{ text: '' }, { text: '' }, { text: '' }],
          correctYesNo: ['', '', '']
        }]
      };

    case 'DI-GT-DROPDOWN':
      return {
        ...baseCommon('DI-GT-DROPDOWN'),
        questionText: 'The data show that the value is [[1]] and the trend is [[2]].',
        artifact: blankArtifact(),
        tags: ['DI-GT', 'Graphs and Tables', 'Dropdown'],
        subQuestions: [
          {
            questionId: uid('gt_blank_1'),
            questionText: 'blank #1',
            questionType: 'multiple_choice',
            options: [
              { value: 'A', text: '' },
              { value: 'B', text: '' }
            ],
            correctMC: ''
          },
          {
            questionId: uid('gt_blank_2'),
            questionText: 'blank #2',
            questionType: 'multiple_choice',
            options: [
              { value: 'A', text: '' },
              { value: 'B', text: '' }
            ],
            correctMC: ''
          }
        ]
      };

    case 'DI-MSR':
      return {
        ...baseCommon('DI-MSR'),
        tags: ['DI-MSR', 'Multi-Source Reasoning'],
        msrSources: [
          { tabName: 'Email 1', content: '', imageUrls: [], tablesHtml: [] },
          { tabName: 'Email 2', content: '', imageUrls: [], tablesHtml: [] },
          { tabName: 'Memo', content: '', imageUrls: [], tablesHtml: [] }
        ],
        subQuestions: [
          {
            questionId: uid('msr_q'),
            questionText: '',
            questionType: 'multiple_choice',
            options: [
              { value: 'A', text: '' },
              { value: 'B', text: '' },
              { value: 'C', text: '' },
              { value: 'D', text: '' },
              { value: 'E', text: '' }
            ],
            correctMC: ''
          }
        ]
      };

    case 'DI-TPA':
      return {
        ...baseCommon('DI-TPA'),
        tags: ['DI-TPA', 'Two-Part Analysis'],
        subQuestions: [{
          questionId: uid('tpa'),
          questionText: '',
          questionType: 'two_part_analysis',
          columnHeaders: ['', ''],
          rowOptions: ['', '', '', '', ''],
          correctTPA: ['', '']
        }]
      };
  }
};

export { uid };
