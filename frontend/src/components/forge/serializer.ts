/**
 * Forge → backend payload conversion.
 * The editor uses a flatter, type-tagged shape (ForgeState). The backend persists
 * QuestionBagV3 docs with `subQuestions` / `msrSources` / `options` etc. Here we
 * translate cleanly between the two.
 */
import { ForgeState, ForgeSubQuestion } from './types';

const subToPayload = (sq: ForgeSubQuestion) => {
  const base: any = {
    questionId: sq.questionId,
    questionText: sq.questionText || '',
    questionType: sq.questionType
  };

  if (sq.questionType === 'multiple_choice') {
    base.options = (sq.options || []).map(o => ({ value: o.value, text: o.text }));
    base.correctAnswer = sq.correctMC || '';
  } else if (sq.questionType === 'yes_no_table') {
    base.columnHeaders = sq.columnHeaders || ['Yes', 'No'];
    base.statements = (sq.statements || []).map(s => ({ text: s.text }));
    base.correctAnswer = sq.correctYesNo || [];
  } else if (sq.questionType === 'two_part_analysis') {
    base.columnHeaders = sq.columnHeaders || ['', ''];
    base.rowOptions = sq.rowOptions || [];
    base.correctAnswer = sq.correctTPA || ['', ''];
  }
  return base;
};

export const forgeToPayload = (s: ForgeState) => {
  // Map editor flavor → persisted questionType
  const persistedType =
    s.forgeType === 'DI-GT-MC' || s.forgeType === 'DI-GT-YESNO' || s.forgeType === 'DI-GT-DROPDOWN'
      ? 'DI-GT'
      : s.forgeType;

  const payload: any = {
    questionType: persistedType,
    questionText: s.questionText,
    difficulty: s.difficulty,
    category: s.category || 'Data Insights',
    source: s.source || 'Manual entry',
    sourceDetails: { url: s.sourceUrl || '' },
    tags: s.tags || [],
    metadata: { topic: s.topic || '', subtopic: s.subtopic || '' },
    explanation: s.explanation || '',
    statistics: { answeredCount: 0, correctPercentage: '' },
    readyForQuiz: !!s.readyForQuiz
  };

  if (s.options) payload.options = { ...s.options };
  else payload.options = {};

  payload.correctAnswer = s.correctAnswer || '';

  if (s.artifact) {
    payload.artifactImages = [...s.artifact.imageUrls];
    payload.artifactTables = [...s.artifact.tablesHtml];
    payload.artifactDescription = s.artifact.description || '';
  }

  if (s.msrSources && s.msrSources.length > 0) {
    payload.msrSources = s.msrSources.map(src => ({
      tabName: src.tabName,
      content: src.content,
      images: src.imageUrls.map(u => ({ src: u, alt: '' })),
      tables: src.tablesHtml.map(html => ({ html }))
    }));
  }

  if (s.subQuestions && s.subQuestions.length > 0) {
    payload.subQuestions = s.subQuestions.map(subToPayload);
  }

  return payload;
};

/**
 * CLASSIC tile (PS/DS/CR/RC) → QuestionBagV2 payload. The V2 backend (admin
 * POST /question-bag-v2) wants `questionType` as the verbose name, options
 * as an object, and DS / RC / CR specific fields in their own slots.
 */
const CLASSIC_TYPE_TO_BACKEND: Record<string, string> = {
  PS: 'Problem Solving',
  DS: 'Data Sufficiency',
  CR: 'Critical Reasoning',
  RC: 'Reading Comprehension'
};

export const forgeClassicToV2Payload = (s: ForgeState) => {
  const sub = s.classicType || 'PS';
  const questionType = CLASSIC_TYPE_TO_BACKEND[sub];

  // For DS we also stuff the canonical statements into metadata so the
  // existing DS rendering (which reads metadata.statement1/2) keeps working.
  const metadata: Record<string, any> = {
    topic: s.topic || '',
    subtopic: s.subtopic || ''
  };
  if (sub === 'DS') {
    metadata.statement1 = s.statement1 || '';
    metadata.statement2 = s.statement2 || '';
  }
  if (sub === 'CR') {
    metadata.argument = s.passageText || '';
  }

  const payload: any = {
    questionText: s.questionText || '',
    questionType,
    category: sub === 'PS' || sub === 'DS' ? 'Quantitative' : 'Verbal',
    difficulty: s.difficulty,
    source: s.source || 'Manual entry',
    sourceDetails: { url: s.sourceUrl || '' },
    tags: s.tags || [],
    options: { ...(s.options || { A: '', B: '', C: '', D: '', E: '' }) },
    correctAnswer: s.correctAnswer || '',
    explanation: s.explanation || '',
    metadata,
    readyForQuiz: !!s.readyForQuiz
  };

  // RC and CR carry the passage / argument in the dedicated passageText
  // field that the existing render path keys off.
  if (sub === 'RC' || sub === 'CR') {
    payload.passageText = s.passageText || '';
  }
  if (sub === 'RC') {
    // Fan-out groups RC sub-questions by rcNumber. Manual single-question
    // creation gets a fresh group per save.
    payload.rcNumber = `RC_${Date.now()}`;
  }
  return payload;
};

/**
 * Build the V3 doc shape adapted to the *frontend* render contract for preview.
 * Frontend cards expect `options` as an array (sorted), and use subQuestions / msrSources directly.
 */
export const forgeToPreview = (s: ForgeState) => {
  const payload = forgeToPayload(s);
  // Convert options object to sorted array (mirroring transformQuestionForFrontend)
  const optionsArr = Object.entries(payload.options || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v as string);
  return { ...payload, _id: 'preview', options: optionsArr };
};
