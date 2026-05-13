# Backlog

> Deferred work items. Add new entries with a `## Priority` header and a one-line summary.
> Update or strike through when picked up. Newest items go to the top of their priority bucket.

---

## High priority

_(empty)_

## Medium priority

- **Tutor & similar-question endpoints — implementation.** PR #4 wires UI hooks and
  stub server endpoints (`POST /api/tutor/explain`, `GET /api/practice/similar`).
  Implementation deferred — needs streaming LLM, prompt design, and a clear
  monetization gate.

- **LLM-driven similarity backfill.** Script created in PR #5 but not executed;
  user will define tagging strategy (taxonomy, prompts, cost budget) before run.

- **`UserQuizV2` migration cutover.** PR #3 dual-writes (old + new). Once new
  reads are stable for 1–2 weeks, drop old `UserQuiz` writes and the legacy
  read fall-back in the history endpoint.

## Low priority

- **Immutable question snapshot per attempt.** Today the history detail
  re-resolves the live V2/V3 doc, so admin edits/deletes mutate the user's
  past review. Tolerable for now. When implemented: store `snapshot` inside
  each `UserQuizV2.items[]` at serve time so review surfaces and the future
  AI tutor see the exact question the user attempted.

- **Session resume / abandoned status.** `UserQuizV2` already has
  `status: 'in_progress' | 'submitted' | 'abandoned'` in the schema. Add a
  resume entry on the My Quizzes list and a reaper that flips stale
  `in_progress` → `abandoned` after N hours.

- **Soft-delete on questions.** When admin deletes a question that has
  history references, currently the review page silently shows nothing.
  Either soft-delete with a `deletedAt` flag or block deletion when
  `AskedQuestion` references exist. (Becomes a non-issue once snapshots land.)

- **Per-question cohort timing stats.** `UserQuizV2.items[].timeSpentMs`
  unlocks aggregate `avg / p50 / p90` per question. Surface on the review
  page next to the user's time.

- **"1 free reset / quarter" perk gating refinement.** PR #2 ships a
  90-day cooldown for paid (quarterly+) users. Revisit once we have usage
  data — may bump to per-plan-period or add a one-off "purchase reset" SKU.

- **Consolidate Mixpanel services.** Two impls exist (`analytics.ts`,
  `mixpanelService.ts`). Already noted in CLAUDE.md.

- **Anonymous quiz submit.** `/quizzes/submit` is being flipped to require
  auth in PR #3 (fixes empty-history bug). If we ever want anonymous demo
  quizzes again, build it as a separate endpoint that doesn't touch
  `UserQuiz*`.
