/**
 * Deterministic question quality gate. Cheap, no LLM. Catches the failure
 * modes the extraction pipeline actually produces — truncated options,
 * placeholder answers, malformed correct-answer letters, RC docs missing
 * their passage, MSR sets with no sub-questions, etc.
 *
 * Usage from a route:
 *   import { validateQuestion } from '../services/questionQA';
 *   import { featureFlags } from '../config/featureFlags';
 *   if (featureFlags.QUIZ_QA_ENABLED) {
 *     const { ok, reasons } = validateQuestion(q);
 *     if (!ok) skipAndRefetch();
 *   }
 *
 * Each rule has a stable name so logs can be grouped and so callers can
 * disable specific rules without disabling the whole gate later.
 */

export interface QAResult {
  ok: boolean;
  reasons: string[];
}

const MIN_QUESTION_TEXT_LEN = 15;
const MIN_OPTION_TEXT_LEN = 1;

// Strings that show up in scrape leftovers / placeholder content.
const TRUNCATION_MARKERS = [
  'Show Answer',
  'Hide Answer',
  'Official Answer and Stats are available',
  'spoiler_',
  'Register</a>/<a',
  '[answer]',
  '[explanation]',
];

const stripHtml = (s: string): string => s.replace(/<[^>]+>/g, '').trim();

const isNonEmptyString = (s: any): s is string =>
  typeof s === 'string' && s.trim().length > 0;

/**
 * Run all checks. Returns ok=true only when every rule passes.
 * Reasons array is empty on success, non-empty (rule names) on failure.
 */
export function validateQuestion(q: any): QAResult {
  const reasons: string[] = [];

  // ---- Universal checks ----------------------------------------------------
  const qText = isNonEmptyString(q.questionText) ? stripHtml(q.questionText) : '';
  if (qText.length < MIN_QUESTION_TEXT_LEN) {
    reasons.push('questionText_missing_or_too_short');
  }

  for (const marker of TRUNCATION_MARKERS) {
    if (
      (q.questionText && q.questionText.includes(marker)) ||
      (q.passageText && q.passageText.includes(marker)) ||
      (q.explanation && q.explanation.includes(marker))
    ) {
      reasons.push(`contains_scrape_marker:${marker.slice(0, 20)}`);
      break;
    }
  }

  // ---- Per-type checks -----------------------------------------------------
  const type = q.questionType;

  // RC: must have a passage and a non-empty rcNumber/passageId for grouping.
  if (type === 'Reading Comprehension' || type === 'RC') {
    if (!isNonEmptyString(q.passageText) || stripHtml(q.passageText).length < 80) {
      reasons.push('rc_passage_missing_or_too_short');
    }
    if (!isNonEmptyString(q.rcNumber) && !isNonEmptyString(q.passageId)) {
      reasons.push('rc_grouping_key_missing');
    }
    checkOptionsAndCorrectAnswer(q, reasons);
  }

  // CR: standalone argument expected; passageText holds it.
  else if (type === 'Critical Reasoning') {
    if (!isNonEmptyString(q.passageText) || stripHtml(q.passageText).length < 30) {
      reasons.push('cr_argument_missing_or_too_short');
    }
    checkOptionsAndCorrectAnswer(q, reasons);
  }

  // PS / DS / DI-DS: expect 5-letter MC.
  else if (type === 'Problem Solving' || type === 'Data Sufficiency' || type === 'DI-DS') {
    checkOptionsAndCorrectAnswer(q, reasons);
  }

  // MSR: must have at least one source and at least one sub-question.
  else if (type === 'DI-MSR') {
    const sources = Array.isArray(q.msrSources) ? q.msrSources : [];
    const subs = Array.isArray(q.subQuestions) ? q.subQuestions : [];
    if (sources.length === 0) reasons.push('msr_no_sources');
    if (subs.length === 0) {
      reasons.push('msr_no_subquestions');
    } else {
      // Each sub-question needs a stem + an answer slot.
      for (let i = 0; i < subs.length; i++) {
        const sq = subs[i];
        if (!isNonEmptyString(sq.questionText)) {
          reasons.push(`msr_sub_${i}_missing_text`);
        }
        if (sq.correctAnswer === undefined || sq.correctAnswer === '') {
          reasons.push(`msr_sub_${i}_missing_correct_answer`);
        }
      }
    }
  }

  // TPA: needs subQuestions[0] with column headers + row options + paired correct answer.
  else if (type === 'DI-TPA') {
    const sub = (q.subQuestions || [])[0];
    if (!sub) {
      reasons.push('tpa_no_subquestion');
    } else {
      if (!Array.isArray(sub.columnHeaders) || sub.columnHeaders.length < 2) {
        reasons.push('tpa_missing_column_headers');
      }
      if (!Array.isArray(sub.rowOptions) || sub.rowOptions.length < 2) {
        reasons.push('tpa_missing_row_options');
      }
      const ca = sub.correctAnswer;
      if (!Array.isArray(ca) || ca.length !== 2 || ca.some((v) => v === '' || v == null)) {
        reasons.push('tpa_correct_answer_pair_missing');
      }
    }
  }

  // GT: lots of variants. Require either canonical 5-option MC OR a sub-question with shape.
  else if (type === 'DI-GT') {
    const hasCanonicalOptions =
      Array.isArray(q.options) && q.options.filter(isNonEmptyString).length >= 2;
    const sub = (q.subQuestions || [])[0];
    const hasSubShape = sub && (sub.questionType === 'multiple_choice' || sub.questionType === 'yes_no_table');
    if (!hasCanonicalOptions && !hasSubShape) {
      reasons.push('gt_no_renderable_shape');
    } else if (hasCanonicalOptions) {
      checkOptionsAndCorrectAnswer(q, reasons);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Normalize options into an [{letter, text}] list. Mongo schemas store
 * options as `{A: 'foo', B: 'bar', ...}` (raw doc) but the frontend
 * transform produces `string[]` keyed by index. Support both.
 */
function normalizeOptions(raw: any): Array<{ letter: string; text: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((t, i) => ({ letter: String.fromCharCode(65 + i), text: stripHtml(t || '') }));
  }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([k]) => /^[A-Z]$/.test(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, text]) => ({ letter, text: stripHtml((text as string) || '') }));
  }
  return [];
}

/**
 * Standard 5-option MC sanity: enough non-empty options, correctAnswer is a
 * letter that maps to a non-empty option, and no option is just an ellipsis
 * (a common scrape-truncation tell).
 */
function checkOptionsAndCorrectAnswer(q: any, reasons: string[]): void {
  const opts = normalizeOptions(q.options);
  const nonEmpty = opts.filter((o) => o.text.length >= MIN_OPTION_TEXT_LEN);
  if (nonEmpty.length < 2) {
    reasons.push('insufficient_non_empty_options');
    return;
  }
  for (const { letter, text } of nonEmpty) {
    if (text === '...' || text === '…' || /^\.{2,}$/.test(text)) {
      reasons.push(`option_${letter}_is_truncation_marker`);
    }
  }
  const ca: string = isNonEmptyString(q.correctAnswer) ? q.correctAnswer.trim() : '';
  if (!ca) {
    reasons.push('correct_answer_missing');
    return;
  }
  const letter = extractAnswerLetter(ca);
  if (!letter) {
    reasons.push('correct_answer_not_a_letter');
    return;
  }
  const match = opts.find((o) => o.letter === letter);
  if (!match || match.text.length < MIN_OPTION_TEXT_LEN) {
    reasons.push('correct_answer_points_to_empty_option');
  }
}

/**
 * Tolerant extractor for the correct-answer letter. Accepts the canonical
 * single-letter form and a few recoverable scrape leftovers we've seen in
 * the V2 bank: `OA:B`, `OA&OE A The passage...`, `Answer: C`, `C is the best
 * answer`. Returns `null` for anything we can't confidently disambiguate
 * (notably `"Unknown"` — the marker scrapers used when extraction failed).
 */
function extractAnswerLetter(raw: string): string | null {
  const s = raw.trim();
  if (/^[A-Z]$/.test(s)) return s;
  // OA:B / OA: B / OA B / OA&OE B
  let m = s.match(/^OA(?:&OE)?\s*[:.\-\s]\s*([A-E])\b/i);
  if (m) return m[1].toUpperCase();
  // Answer: C / Answer - C / Answer C
  m = s.match(/^Answer\s*[:.\-\s]\s*([A-E])\b/i);
  if (m) return m[1].toUpperCase();
  // "C is the best answer" / "C - explanation"
  m = s.match(/^([A-E])\b\s*(?:[-–—:.)]|is\s+the\s+best|is\s+correct)/i);
  if (m) return m[1].toUpperCase();
  // Numbered: "95. A The passage..."
  m = s.match(/^\d+\s*[\.\)]\s*([A-E])\b/);
  if (m) return m[1].toUpperCase();
  return null;
}

/**
 * Apply the validator to a candidate list and return only those that pass.
 * Logs a one-line summary so we can see what's being filtered.
 */
export function filterValidQuestions<T = any>(
  candidates: T[],
  context: string,
): { kept: T[]; dropped: number; reasonCounts: Record<string, number> } {
  const kept: T[] = [];
  const reasonCounts: Record<string, number> = {};
  for (const q of candidates) {
    const { ok, reasons } = validateQuestion(q);
    if (ok) {
      kept.push(q);
    } else {
      for (const r of reasons) {
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }
  }
  const dropped = candidates.length - kept.length;
  if (dropped > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[QA:${context}] kept ${kept.length}/${candidates.length} (dropped ${dropped})`,
      reasonCounts,
    );
  }
  return { kept, dropped, reasonCounts };
}
