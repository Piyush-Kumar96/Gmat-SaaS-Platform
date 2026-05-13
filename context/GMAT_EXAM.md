# GMAT Focus Edition — Domain Knowledge

> **Purpose:** the exam this product simulates. Read this before touching anything related to questions, quiz logic, or scoring.

## What the GMAT is

The Graduate Management Admission Test (GMAT) is a standardized, computer-adaptive test used by graduate business schools (MBA, MiM, MS Finance, etc.) to assess candidates. It is administered by **GMAC (Graduate Management Admission Council)**.

The current format is the **GMAT Focus Edition** (launched late 2023, fully replacing the legacy GMAT in early 2024). This product targets the Focus Edition exclusively.

## Test structure (Focus Edition)

| Section | Questions | Time | Question Types |
|---------|----------:|-----:|----------------|
| Quantitative Reasoning (Quant) | 21 | 45 min | Problem Solving (PS) only |
| Verbal Reasoning (Verbal) | 23 | 45 min | Reading Comprehension (RC) + Critical Reasoning (CR) |
| Data Insights (DI) | 20 | 45 min | Data Sufficiency (DS) + Graphs & Tables (GT) + Multi-Source Reasoning (MSR) + Two-Part Analysis (TPA) |

> **DI question accounting:** the 20 in the DI section is *scored items*, not *stems*. Each MSR set contributes **one item per sub-question** (sets are typically 3 sub-questions). DS, TPA, and every GT shape (MC, Yes/No table, Dropdown fill-in) each count as **one item**. A typical real-form section is e.g. 1 MSR set (3 items) + 17 standalones = 20. Quiz generation must pack stems until the sub-question total hits `count`, not until the stem count does.
| **Total** | **64** | **2 h 15 min** | |

- **Section order**: test-taker-customizable. 6 permutations of the 3 sections; selected before the test starts.
- **Optional 10-minute break**: can be taken after Section 1 or Section 2, or skipped entirely.
- **Review & Edit**: up to 3 answers can be reviewed/changed *within a section* (only at the end of the section, before locking it).
- **Computer-adaptive**: difficulty adjusts based on prior answers within a section.
- **No penalty for guessing** but skipping is not allowed within Focus Edition (must answer to proceed).

## Scoring

| Score | Range | Notes |
|-------|------:|-------|
| Section scores | 60–90 (each) | Quant, Verbal, DI each scored individually. |
| Total score | 205–805 | New scale (NOT the old 200–800 — the trailing digit is always 5). |
| Reporting | Percentile per section + total | |

Test-takers typically aim for 645+ for top programs; 705+ is highly competitive.

## Question types — full taxonomy

### Quant — Problem Solving (PS)
- Standard 5-option multiple choice (A–E).
- Topics: arithmetic, algebra, word problems, number properties, percentages, ratios, geometry-light.
- **No Data Sufficiency in Quant under Focus** — DS moved to DI.
- No calculator allowed.

### Verbal — Critical Reasoning (CR)
- Argument analysis: short passage (~50–150 words), then a question.
- Question stems: assumption, strengthen, weaken, inference, paradox, evaluate, bold-faced (rare in Focus).
- 5-option multiple choice.

### Verbal — Reading Comprehension (RC)
- Passage (200–350 words; some "short" 200-word passages are common in Focus).
- 3–4 questions per passage.
- 5-option multiple choice.
- **Sentence Correction is removed in Focus Edition** — do NOT add SC questions.

### Data Insights — Data Sufficiency (DS)
- Question + 2 numbered statements `(1)` and `(2)`.
- Fixed 5 options, always identical wording:
  - A: Statement (1) alone is sufficient, but statement (2) alone is not sufficient.
  - B: Statement (2) alone is sufficient, but statement (1) alone is not sufficient.
  - C: Both statements together are sufficient, but neither statement alone is sufficient.
  - D: Each statement alone is sufficient.
  - E: Statements (1) and (2) together are not sufficient.
- The DS option text is canonical and must match exactly.

### Data Insights — Graphs & Tables (GT)
Three sub-formats encountered in real GT items:
1. **Standard MC + artifact** — chart/table shown, then a normal A–E question.
2. **Yes/No (or Supported / Not Supported) statements table** — N statements, each gets one of two columns. Test-taker selects one radio per row.
3. **Drop-down fill-in-the-blank** — sentences with blanks, each blank populated from a per-blank dropdown of options.

Artifact can be an HTML table, an image (chart/graph), or both.

### Data Insights — Multi-Source Reasoning (MSR)
- 2–3 **source tabs** (text + tables + images) shared by a *set* of 3 sub-questions.
- Each sub-question is independently typed: usually `multiple_choice` (A–E) or `yes_no_table` (N statements × 2 columns).
- Sources stay constant across the set; sub-questions change.

### Data Insights — Two-Part Analysis (TPA)
- One prompt, then a 2-column table with N rows (typically 5–6) of candidate values.
- User selects exactly one radio per column (the same row may be picked for both, depending on the prompt).
- Column headers are domain-specific (e.g., `v₀` / `v₁₀`, `Greater` / `Lesser`, `Fair` / `Discussion`).

## Question type codes used in this codebase

| DB code | Meaning | Card component |
|---------|---------|----------------|
| `PS` | Problem Solving | `PSQuestionCard.tsx` |
| `DS` (legacy) / `DI-DS` | Data Sufficiency | `DSQuestionCard.tsx` |
| `CR` | Critical Reasoning | `CRQuestionCard.tsx` |
| `RC` | Reading Comprehension | `RCQuestionCard.tsx` |
| `DI-GT` | DI: Graphs & Tables | `GTQuestionCard.tsx` |
| `DI-MSR` | DI: Multi-Source Reasoning | `MSRQuestionCard.tsx` |
| `DI-TPA` | DI: Two-Part Analysis | `TPAQuestionCard.tsx` |

The legacy v1 model also used long-form values: `'Multiple Choice'`, `'Critical Reasoning'`, `'Reading Comprehension'`. Treat these as deprecated; new code targets v2/v3 short codes.

## Difficulty bands

The codebase normalizes to: `Easy`, `Medium`, `Hard` (and sometimes `Very Hard`). GMAT Club source data uses `subTopic` and `difficulty_level` strings that need normalization on import.

## Why this matters for code

- **Scoring logic** must keep section scores independent and convert to the 60–90 band per section. The 205–805 total is computed from sections, not raw item count.
- **DI is the hardest type to model** — three of its four sub-types don't fit the `options: A-E` shape. See `QUESTION_DATA_MODEL.md` for the actual sub-structures.
- **Section ordering** is user-chosen; `frontend/src/components/GMATFocusConfig.tsx` exposes 6 permutations.
- **No SC questions** anywhere — if you find any, they're stale legacy imports and should be flagged.
