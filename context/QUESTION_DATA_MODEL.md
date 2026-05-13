# Question Data Model

> **Purpose:** every shape a question can take, in code. Read this before adding fields, building forms, or writing extractors.

There are **three Mongoose models** for questions, layered for backward compatibility:

| Model | File | Use when |
|-------|------|----------|
| `QuestionBag` (v1) | `backend/src/models/QuestionBag.ts` | Don't. Legacy. |
| `QuestionBagV2` | `backend/src/models/QuestionBagV2.ts` | Standard non-DI questions (PS, DS legacy, CR, RC). Has validation fields. |
| `QuestionBagV3` | `backend/src/models/QuestionBagV3.ts` | DI questions and new RC ingestion. Adds `passageId`, MSR/TPA/GT sub-shapes. **Preferred for new work.** |

In the rest of this doc, "the schema" means **V3** unless noted.

---

## V3 — Common fields (all question types)

```ts
{
  _id: ObjectId,
  questionText: string,                     // The prompt. May contain LaTeX/MathJax.
  questionType: 'PS' | 'DS' | 'CR' | 'RC'   // Legacy short codes (Quant + Verbal)
              | 'DI-DS' | 'DI-GT' | 'DI-MSR' | 'DI-TPA',
  options: Record<string, string>,          // { A: '...', B: '...', ... } — empty {} for MSR set-level docs
  correctAnswer: string,                    // 'A'..'E' or '' if unknown / not applicable
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very Hard' | string,
  source: string,                           // e.g. 'GMAT Club', 'Official Guide'
  sourceDetails: { url: string, [k]: any }, // Often { url, questionId, category }
  category: string,                         // 'Quantitative' | 'Verbal' | 'Data Insights'
  tags: string[],                           // e.g. ['DI-TPA', 'Two-Part Analysis']
  passageText?: string,                     // RC passage / CR argument
  passageId?: string,                       // Group RC questions: 'rc_gmatprep_134'
  explanation?: string,
  rcNumber?: string,                        // Legacy RC grouping field
  questionNumber?: number,
  metadata: { topic?: string, subtopic?: string, [k]: any },
  statistics: {
    answeredCount: number,
    correctPercentage: string,
    answerStats?: { a, b, c, d, e },        // % choosing each option (from GMAT Club)
    sessionStats?: { difficultyLevel, correctTime, wrongTime, sessionsCount, ... }
  },
  validationStatus: 'perfect' | 'needs_revision' | 'unfixable' | 'fixed' | null,
  validationIssues: string[],
  proposedRevision: { questionText, options, correctAnswer, passageText } | null,
  extractionVersion?: string,               // 'v3', 'di_v1', etc.
  createdAt, updatedAt,

  // DI-specific (optional, see per-type below)
  msrSources?: IMSRSource[],
  subQuestions?: ISubQuestion[],
  artifactImages?: string[],                // URLs
  artifactTables?: string[],                // Raw HTML strings
  artifactDescription?: string
}
```

The frontend type wrapper is `frontend/src/types/quiz.ts → Question`. Note that the `/api/question-bag-v3` route **transforms `options` from object to sorted array** before sending to FE (see `routes/questionBagV3Routes.ts:transformQuestionForFrontend`). So:

- DB form: `options: { A: 'foo', B: 'bar', ... }`
- FE form: `options: ['foo', 'bar', ...]`
- `correctAnswer` is always the letter on both sides.

---

## Per-type shapes & examples

### 1. PS (Problem Solving) — Quant

```js
{
  questionType: 'PS',
  questionText: 'If 3x + 5 = 23, what is the value of x?',
  options: { A: '4', B: '5', C: '6', D: '8', E: '9' },
  correctAnswer: 'C',
  difficulty: 'Easy',
  category: 'Quantitative',
  explanation: '3x = 18 → x = 6.'
}
```

### 2. CR (Critical Reasoning) — Verbal

```js
{
  questionType: 'CR',
  questionText: 'Which of the following most weakens the conclusion above?',
  passageText: '<the argument paragraph>',
  options: { A: '...', B: '...', C: '...', D: '...', E: '...' },
  correctAnswer: 'D',
  category: 'Verbal',
  metadata: { topic: 'Weaken' }
}
```

### 3. RC (Reading Comprehension) — Verbal

```js
{
  questionType: 'RC',
  questionText: 'The primary purpose of the passage is to...',
  passageText: '<the full passage, 200–350 words>',
  passageId: 'rc_og_24_017',                // shared across the 3–4 questions on this passage
  options: { A: '...', ..., E: '...' },
  correctAnswer: 'B',
  category: 'Verbal'
}
```

> **Grouping:** all questions sharing a passage have the same `passageId`. Front-end can fetch them via `GET /api/question-bag-v3/passage/:passageId`.

### 4. DI-DS (Data Sufficiency) — Data Insights

The 5 options are **canonical**. Always store the standard wording, do not paraphrase:

```js
{
  questionType: 'DI-DS',                    // or 'DS' for legacy V2 docs
  questionText: 'Are at least 10 percent of the people in Country X who are 65 or older employed?\n\n(1) ...\n(2) ...',
  options: {
    A: 'Statement (1) alone is sufficient, but statement (2) alone is not sufficient.',
    B: 'Statement (2) alone is sufficient, but statement (1) alone is not sufficient.',
    C: 'Both statements together are sufficient, but neither statement alone is sufficient.',
    D: 'Each statement alone is sufficient.',
    E: 'Statements (1) and (2) together are not sufficient.'
  },
  correctAnswer: 'E',
  category: 'Data Insights',
  metadata: { subtopic: 'yes_no' | 'value' }
}
```

### 5. DI-GT (Graphs & Tables) — three sub-formats

The current model can only fully express **5a (standard MC)**. For 5b (Yes/No table) and 5c (dropdown fill-in), the schema needs extension or repurposed use of `subQuestions`. See **Open issues** at the bottom.

#### 5a. Standard MC + artifact (works today)

```js
{
  questionType: 'DI-GT',
  questionText: 'Based on the table, which statement is true?',
  options: { A: '...', B: '...', C: '...', D: '...', E: '...' },
  correctAnswer: 'B',
  artifactTables: ['<table class="stoker table-sortable">...</table>'],
  artifactImages: [],
  artifactDescription: 'Survey of minority-owned businesses (Latino, African American, Asian American, Native American).'
}
```

#### 5b. Yes/No (or "Supported / Not Supported") statements table

Today's extractor stuffs statements into `options.A..E` with empty trailing options — **wrong shape**. The proper representation re-uses the `subQuestions` array with a single `yes_no_table` sub-question:

```js
{
  questionType: 'DI-GT',
  questionText: 'For each conclusion, select Supported if supported by the table, otherwise Not supported.',
  artifactTables: ['<the data table HTML>'],
  options: {},  // empty at top-level
  subQuestions: [{
    questionId: 'gt_supported_<id>',
    questionText: '',
    questionType: 'yes_no_table',
    columnHeaders: ['Supported', 'Not supported'],
    statements: [
      { text: 'A majority of the respondents believe adding a website could benefit their businesses.' },
      { text: 'Fewer than 25% of those who believe ...' },
      { text: 'Only a small proportion of the respondents are concerned ...' }
    ],
    correctAnswer: ['1','0','0']  // per-row column index ('0' or '1')
  }]
}
```

#### 5c. Dropdown fill-in-the-blank

Not yet rendered. Recommended extension:

```js
{
  questionType: 'DI-GT',
  questionText: 'Based on the chart, the correlation between A and B is [[1]] and the slope is [[2]].',
  artifactImages: ['https://.../chart.png'],
  subQuestions: [{
    questionId: 'gt_blank_1',
    questionType: 'multiple_choice',
    questionText: 'blank #1',
    options: [{ value: 'A', text: 'positive' }, { value: 'B', text: 'negative' }, ...],
    correctAnswer: 'A'
  }, {
    questionId: 'gt_blank_2',
    questionType: 'multiple_choice',
    questionText: 'blank #2',
    options: [{ value: 'A', text: '1.0' }, { value: 'B', text: '2.5' }, ...],
    correctAnswer: 'B'
  }]
}
```

The `[[1]]` / `[[2]]` markers in `questionText` map to `subQuestions[i]`.

### 6. DI-MSR (Multi-Source Reasoning)

A single MSR document represents a **set**: shared sources + N sub-questions.

```js
{
  questionType: 'DI-MSR',
  questionText: '<intro / scenario, optional>',
  options: {},
  correctAnswer: '',
  msrSources: [
    {
      tabName: 'Email 1',
      content: 'On October 12, the marketing director wrote...',
      images: [],
      tables: []
    },
    {
      tabName: 'Email 2',
      content: 'In response, the analyst replied...',
      tables: [{ html: '<table>...</table>', rows: 4, cols: 3 }]
    },
    {
      tabName: 'Memo',
      content: '...'
    }
  ],
  subQuestions: [
    {
      questionId: 'msr_<id>_q1',
      questionText: 'According to the emails, which is most likely true?',
      questionType: 'multiple_choice',
      options: [
        { value: 'A', text: '...' }, { value: 'B', text: '...' },
        { value: 'C', text: '...' }, { value: 'D', text: '...' }, { value: 'E', text: '...' }
      ],
      correctAnswer: 'C'
    },
    {
      questionId: 'msr_<id>_q2',
      questionText: 'For each of the following, select Yes if it can be inferred...',
      questionType: 'yes_no_table',
      columnHeaders: ['Yes', 'No'],
      statements: [
        { text: 'The analyst agrees with the director.' },
        { text: 'The campaign launched in November.' },
        { text: 'Spend exceeded budget by 12%.' }
      ],
      correctAnswer: ['1','0','1']
    },
    { /* msr_<id>_q3 ... */ }
  ]
}
```

### 7. DI-TPA (Two-Part Analysis)

```js
{
  questionType: 'DI-TPA',
  questionText: 'A car is travelling... Select values of v0 and v10. One in each column.',
  options: {},                         // not used at top level
  correctAnswer: '',
  subQuestions: [{
    questionId: 'tpa_<id>',
    questionText: '',                  // typically empty (prompt is in top-level questionText)
    questionType: 'two_part_analysis',
    columnHeaders: ['v₀', 'v₁₀'],
    rowOptions: ['5', '18', '20', '36', '72'],
    correctAnswer: ['1','3']           // rowIndex per column: col0 picks row 1 ('18'), col1 picks row 3 ('36')
  }]
}
```

The rendering contract for TPA (see `components/TPAQuestionCard.tsx`):
- The user makes one selection per column.
- Selection state shape: `{ [questionId]: [colIndexAsString, colIndexAsString] }` where each value is the **row index** chosen for that column.

---

## Statistics shape (from GMAT Club)

```ts
statistics: {
  answeredCount: 0,
  correctPercentage: '67%',
  answerStats: { a: '12%', b: '5%', c: '67%', d: '10%', e: '6%' },
  sessionStats: {
    difficultyLevel: '655',
    difficultyCategory: 'Hard',
    correctTime: '02:14',
    wrongPercentage: '33%',
    wrongTime: '02:48',
    sessionsCount: '12,453'
  }
}
```

These are imported as-is from scrapes; treat as informational. Internal scoring should not depend on them.

---

## Validation lifecycle

```
validationStatus:
  null              → freshly imported, never reviewed
  'perfect'         → reviewed and approved as-is
  'needs_revision'  → reviewed, needs human/AI fix
  'fixed'           → AI proposed a revision (in proposedRevision); awaiting approval
  'unfixable'       → triage: source quality too poor, drop it
```

Quiz routes should serve only `validationStatus ∈ {'perfect', 'fixed'}` to end users (see `PROJECT_PLAN_2026.md` Phase 2).

---

## Open issues / debt

1. **`DI-GT` with Yes/No table is misshapen in current data** — extractor stuffs N statements into A–E options, leaving D/E empty. The fix is to migrate to the `subQuestions[yes_no_table]` shape above. See `QUESTION_SOURCING.md` for the migration plan.
2. **`DI-GT` dropdown fill-in is unrepresented** — neither extractor nor `GTQuestionCard` handles it.
3. **TPA `correctAnswer` ambiguity** — extracted docs sometimes have empty `correctAnswer` and `subQuestions`; the manual editor must enforce both (a `[colA_rowIdx, colB_rowIdx]` pair).
4. **MSR `msrSources` and `subQuestions` are commonly empty** — extraction reliability is the main blocker; manual editor will become the canonical entry path.
5. **Legacy `questionType: 'DS'` vs `'DI-DS'`** — codebase accepts both; keep that until a migration script unifies.
