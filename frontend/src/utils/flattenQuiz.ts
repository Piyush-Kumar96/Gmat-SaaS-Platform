import { Question } from '../types/quiz';

/**
 * Real GMAT shows MSR sub-questions ONE at a time, advanced by the main
 * pager — the user can't jump between siblings or see the count. Our DB
 * stores each MSR set as a single stem with N sub-questions, so we expand
 * each stem into N flattened entries here.
 *
 * Each virtual entry keeps the parent stem's `_id` so the answers JSON map
 * (which stores all sub-answers under the parent key) keeps working. A
 * `_msrSubIdx` field tells the MSR shell which sub-question to render, and
 * `_flattenKey` is a stable React key.
 */
export function flattenMsrSubQuestions(questions: Question[]): Question[] {
  const out: Question[] = [];
  for (const q of questions) {
    const subs = (q as any).subQuestions || [];
    if (q.questionType === 'DI-MSR' && subs.length > 1) {
      for (let i = 0; i < subs.length; i++) {
        out.push({
          ...q,
          _msrSubIdx: i,
          _flattenKey: `${q._id}__sub${i}`,
        } as any);
      }
    } else {
      out.push({ ...q, _flattenKey: q._id } as any);
    }
  }
  return out;
}

/**
 * For "X of N answered" footers: counts each MSR sub-question that has been
 * answered (rather than counting the parent stem once for the whole set).
 * Falls back to a plain answers-map count for non-MSR types.
 */
export function countAnsweredSubItems(
  questions: Question[],
  answers: Record<string, string | undefined>,
): number {
  // Track which (parentId, subIdx) pairs are answered to avoid double-counting
  // when the same flattened stem appears multiple times.
  const seen = new Set<string>();
  let n = 0;
  for (const q of questions) {
    const parentId = q._id;
    const ans = answers[parentId];
    if (!ans) continue;
    const subs = (q as any).subQuestions || [];
    if (q.questionType === 'DI-MSR' && subs.length > 1) {
      const subIdx = (q as any)._msrSubIdx ?? 0;
      const subId = subs[subIdx]?.questionId;
      if (!subId) continue;
      try {
        const map = JSON.parse(ans);
        if (map && map[subId] != null && map[subId] !== '') {
          const key = `${parentId}::${subId}`;
          if (!seen.has(key)) {
            seen.add(key);
            n++;
          }
        }
      } catch {
        // ignore malformed
      }
    } else {
      if (!seen.has(parentId)) {
        seen.add(parentId);
        n++;
      }
    }
  }
  return n;
}
