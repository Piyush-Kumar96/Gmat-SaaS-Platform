# Question Quality Assurance (QA) Validator

> **Purpose:** what the QA validator filters, why each rule exists, where it's applied today, and the planned expansion across the full content lifecycle (sourcing → quiz pull → explanation generation).

## 1. Where it lives

| Concern | File |
|---|---|
| Validation rules | `backend/src/services/questionQA.ts` |
| Feature flag | `backend/src/config/featureFlags.ts` (`QUIZ_QA_ENABLED`, default `true`) |
| Wired into | `/api/question-bag-v2/random` and `/api/question-bag-v3/random` |

The validator is **deterministic** — pure JavaScript, no LLM calls, no I/O. A single-doc validation runs in microseconds, so wrapping a quiz fetch costs effectively nothing.

To toggle: edit `backend/src/config/featureFlags.ts` or set `QUIZ_QA_ENABLED=false` in `backend/.env` and restart `ts-node-dev`. Both the user and the assistant can flip this without code review.

## 2. How a quiz fetch uses it

```
1. Random endpoint runs its normal selection logic.
2. Validator filters the candidate list. Failures are logged with rule names.
3. If anything was dropped AND QA is enabled, ONE bounded top-up pass:
     a. Oversample 3× the dropped count from the same source.
     b. Validate the top-up batch.
     c. Take up to `dropped` valid candidates from it.
4. Return what we have. We don't loop more than once — bounded latency
    matters more than guaranteeing the exact target count.
```

If QA is disabled, step 2-3 are skipped entirely; the candidates pass through.

## 3. Universal rules (every question type)

These run on every doc regardless of type.

| Rule name | Triggers when | Why |
|---|---|---|
| `questionText_missing_or_too_short` | `questionText` is missing, empty, or under 15 visible characters after stripping HTML. | A 5-character question is almost always extractor garbage (`"What?"`, `"-"`, etc.). |
| `contains_scrape_marker:<marker>` | `questionText`, `passageText`, or `explanation` contains any of: `Show Answer`, `Hide Answer`, `Official Answer and Stats are available`, `spoiler_`, `Register</a>/<a`, `[answer]`, `[explanation]`. | Direct evidence the scraper captured forum chrome instead of just question content. |

## 4. Type-specific rules

### RC (`Reading Comprehension`, `RC`)

| Rule name | Triggers when |
|---|---|
| `rc_passage_missing_or_too_short` | `passageText` missing/empty or under 80 visible chars. |
| `rc_grouping_key_missing` | Both `rcNumber` and `passageId` are missing — without one of these, the quiz pager can't group sub-questions into a single passage. |
| Standard MC checks (see § 5) | Always. |

### CR (`Critical Reasoning`)

| Rule name | Triggers when |
|---|---|
| `cr_argument_missing_or_too_short` | `passageText` missing/empty or under 30 chars. CR questions without an argument are unanswerable. |
| Standard MC checks (see § 5) | Always. |

### PS / DS / DI-DS

Plain 5-option multiple choice. Only the standard MC checks (see § 5) apply.

### MSR (`DI-MSR`)

| Rule name | Triggers when |
|---|---|
| `msr_no_sources` | `msrSources` array is missing or empty. The user wouldn't have any reference material to read. |
| `msr_no_subquestions` | `subQuestions` array is missing or empty. There's nothing to answer. |
| `msr_sub_<i>_missing_text` | A sub-question's `questionText` is empty. |
| `msr_sub_<i>_missing_correct_answer` | A sub-question's `correctAnswer` is missing or empty. The question can't be graded. |

### TPA (`DI-TPA`)

| Rule name | Triggers when |
|---|---|
| `tpa_no_subquestion` | `subQuestions[0]` doesn't exist. |
| `tpa_missing_column_headers` | Fewer than 2 column headers — TPA renders as a 2-column table. |
| `tpa_missing_row_options` | Fewer than 2 row options. |
| `tpa_correct_answer_pair_missing` | `correctAnswer` is not a 2-element array, or any element is empty. |

### GT (`DI-GT`)

| Rule name | Triggers when |
|---|---|
| `gt_no_renderable_shape` | Neither canonical 5-option MC (`options` array) nor a sub-question with `multiple_choice`/`yes_no_table` shape is present. The card has nothing to render. |
| Standard MC checks (when canonical) | Only if the doc has the MC shape. |

## 5. Standard MC checks

Applied to PS, DS, DI-DS, RC, CR, and GT-MC.

| Rule name | Triggers when |
|---|---|
| `insufficient_non_empty_options` | Fewer than 2 options have non-empty visible text. Mongo schemas store options as `{A: '...', B: '...'}` (raw doc) or as `string[]` (frontend-transformed); both shapes are accepted. |
| `option_<letter>_is_truncation_marker` | An option's text is just `...` / `…` / `..`. A scrape-truncation tell. |
| `correct_answer_missing` | `correctAnswer` is empty or missing. |
| `correct_answer_not_a_letter` | `correctAnswer` doesn't resolve to a single letter A-Z, even after running the tolerant extractor. |
| `correct_answer_points_to_empty_option` | The letter resolves but the corresponding option text is empty. |

### Tolerant `correctAnswer` extraction

Several legacy extractor outputs land in the DB with non-canonical answer formats. The validator recovers the letter when it can, so users don't lose otherwise-valid questions:

| Pattern (regex, case-insensitive) | Example | Resolved letter |
|---|---|---|
| `^[A-Z]$` | `"B"` | `B` |
| `^OA(?:&OE)?\s*[:.\-\s]\s*([A-E])\b` | `"OA:B"`, `"OA - C"`, `"OA&OE A The passage..."` | extracted |
| `^Answer\s*[:.\-\s]\s*([A-E])\b` | `"Answer: C"`, `"Answer - D"` | extracted |
| `^([A-E])\b\s*(?:[-–—:.)]\|is\s+the\s+best\|is\s+correct)` | `"C is the best answer"`, `"B - this is because"` | extracted |
| `^\d+\s*[\.\)]\s*([A-E])\b` | `"95. A The passage..."` | extracted |
| Anything else (notably `"Unknown"`) | `"Unknown"` | rejected as `correct_answer_not_a_letter` |

`"Unknown"` is the marker the legacy scrapers used when answer extraction failed. The validator deliberately does not try to recover these — they need genuine reanswering, not pattern matching.

## 6. Real-data baseline (sampled 2026-05-04)

Sampled 200 random docs per V2 type, all V3 docs:

| Source | Type | Drop rate | Dominant rule |
|---|---|--:|---|
| V2 | Critical Reasoning | 0.5% | `correct_answer_not_a_letter` |
| V2 | Problem Solving | 1.2% | `insufficient_non_empty_options`, `correct_answer_not_a_letter` |
| V2 | Data Sufficiency | 0.0% | — |
| V2 | Reading Comprehension | 27.5% | `correct_answer_not_a_letter` (~all `"Unknown"`) |
| V3 | DI-GT | 0.0% | — |
| V3 | DI-MSR | 95.2% | `msr_sub_<i>_missing_correct_answer` (all sub-questions in 20/21 docs) |
| V3 | DI-TPA | 0.0% | — |

The 95% MSR drop is a known data-pipeline gap (the MSR insertion script never populated sub-question correct answers); see `context/QUESTION_SOURCING.md` § 3 row "DI-MSR". Until the MSR data is fixed, the QA top-up loop will basically empty MSR quizzes — toggle `QUIZ_QA_ENABLED=false` if you need MSR for testing.

## 7. Roadmap

The validator today only runs at quiz-pull time. The plan is to extend it across the content lifecycle so quality is enforced at every stage.

### Phase 1 — quiz pull (current, 2026-05-04)

- ✅ Both random endpoints run validation + bounded top-up.
- ✅ Feature flag for safe disable.

### Phase 2 — sourcing (planned)

Run the same validator against fresh extractor output before the doc is inserted into the DB. This catches scrape regressions earlier and stops bad data accumulating.

- Hook into `backend/src/scripts/v3_extraction/db_inserter.py` (or its TS equivalent for new pipelines).
- Reject inserts that fail; write the failed candidate to `backend/exports/qa_rejects/<date>/<type>/` for human review.
- Surface aggregate drop rates in the daily extraction summary.

### Phase 3 — explanation generation (planned)

Extend the validator with explanation-quality rules so LLM-generated explanations don't ship if they:

- Fail to mention the correct answer letter.
- Are shorter than the question text (a tell of trivial output).
- Contain placeholder strings (`[explanation]`, `As an AI language model...`).
- Cite an option letter that doesn't exist in the question's options.

Same `validateQuestion` interface, new rule group `explanation_*`. Probably gated behind a separate flag (`QUIZ_EXPLANATION_QA_ENABLED`) so generation and quiz-pull QA can be tuned independently.

### Phase 4 — admin Question Bank create/edit (planned)

Run the validator client-side as a soft warning when an admin saves a manually-entered question. Show the rule names in a non-blocking banner so the admin can fix things before publishing without being forced to.

## 8. Adding a new rule

Open `backend/src/services/questionQA.ts`. The shape is:

```ts
if (q.someCondition) {
  reasons.push('your_rule_name');  // snake_case, stable, descriptive
}
```

Then update the table in this doc (§ 3, 4, or 5 depending on scope) with the rule name, trigger, and reasoning. Re-run the sample script (recreate from § 6 if needed) to record the new drop rate. If the rule causes a >5% jump in a previously-clean type, consider whether it's catching a real problem or whether the rule needs to be relaxed.

## 9. Sampling baselines

The numbers in § 6 came from a small ad-hoc script. To regenerate:

```ts
// One-off script — don't commit, but the recipe is:
import { validateQuestion } from '../services/questionQA';
const docs = await QuestionBagV2.aggregate([{ $match: { questionType: t } }, { $sample: { size: 200 } }]);
const drops = docs.filter(d => !validateQuestion(d).ok);
console.log(`${t}: ${drops.length}/${docs.length}`);
```

When making validator changes, re-run this against each type and update § 6 with the date. Drift between the documented baseline and reality is a smell.
