# Question Forge — DI Question Editor — UI Implementation Plan

> **Question Forge** is the in-app, type-aware creator/editor for Data Insights questions. Since automated extraction is unreliable for G&T (Yes/No), MSR, and TPA, Forge is the canonical path for new DI content.
>
> **Route:** `/forge` (and `/forge/:id` for edit). **Nav slot:** immediately after "Question Bank DI", labelled **"Question Forge"** (admin-only). Color theme: amber/orange to set it apart from review pages.

## 1. Why we're building this

- Non-DI editor (`pages/ReviewPage.tsx` inline edit) works fine — PS/CR/RC/DS questions can be added by hand or via scrape + cleanup.
- DI extraction (Puppeteer + GPT) hits ~50–70% on G&T/MSR/TPA because those types use interaction patterns that don't fit `options: A-E` and have inconsistent HTML on GMAT Club.
- **Decision:** the canonical path for new DI content is human entry through a type-aware form. Extraction continues for *bulk drafting* but every DI question passes through this editor.

(See `context/USERS.md` § "Question-bank editor" and `context/QUESTION_SOURCING.md` § 5.)

## 2. Scope of this editor

### In scope (v1)
- Create / edit any of the 6 DI shapes:
  1. **DI-DS** — Data Sufficiency (canonical 5 options pre-filled).
  2. **DI-GT (MC)** — Graphs & Tables, standard 5-option MC + artifact.
  3. **DI-GT (Yes/No)** — Supported / Not Supported (or Yes/No) statements table.
  4. **DI-GT (dropdown)** — fill-in-the-blank with per-blank dropdowns.
  5. **DI-MSR** — multi-source set with N sub-questions.
  6. **DI-TPA** — two-part analysis, 2 columns × N rows.
- Save direct to `QuestionBagV3` collection.
- Admin-only. Reuse existing `requirePaidUser`/admin role-check pattern.
- Inline preview using existing card components.
- Optional: explanation, difficulty, tags, source URL, metadata.

### Out of scope (v1)
- Versioning / draft history (beyond browser-local autosave).
- Multi-user collaboration.
- Bulk import via CSV/JSON (extraction scripts already cover that).
- LaTeX live-render in the editor (we accept raw `\(...\)` / `$...$` and render in preview only).
- Image upload to internal CDN (v1 takes hosted URLs only; upload comes later).
- GT Dropdown card *rendering* extension to `GTQuestionCard.tsx` — Forge can save the shape; renderer is a follow-up PR.

## 3. UX flow

```
Admin lands on /admin/questions/new (or /review-di → "+ Create")
   │
   ▼
[Step 1] Pick question type   ──►  Modal radio: DS | GT-MC | GT-YesNo | GT-Dropdown | MSR | TPA
   │
   ▼
[Step 2] Type-specific form (left)   ║   Live preview (right, the actual question card)
   │                                 ║
   │  Common header fields:          ║   <Same card the test-taker sees>
   │   • Question text (textarea)    ║   shows artifact, options, statements,
   │   • Difficulty (Easy/Med/Hard)  ║   etc., reflecting current form state.
   │   • Tags / topic                ║
   │   • Source URL (optional)       ║
   │   • Explanation (optional)      ║
   │                                 ║
   ▼
[Step 3] Validate → Save
   • Client validation (per type — see § 6).
   • POST /api/question-bag-v3 (new)  or  PUT /api/question-bag-v3/:id (edit).
   • On success: toast + stay on edit screen (let editor refine) or "Save & New".
```

## 4. Routes & files

### Frontend
| New file | Purpose |
|----------|---------|
| `frontend/src/pages/DIEditorPage.tsx` | Top-level page: type picker, layout, save logic. Routed at `/admin/questions/di/new` and `/admin/questions/di/:id/edit`. |
| `frontend/src/components/di-editor/TypeSelector.tsx` | Step 1 modal/inline radio for picking type. |
| `frontend/src/components/di-editor/CommonFields.tsx` | Shared header: questionText, difficulty, tags, source, explanation. |
| `frontend/src/components/di-editor/forms/DSForm.tsx` | DI-DS form (canonical 5 options pre-filled, just toggles correct answer + question stem). |
| `frontend/src/components/di-editor/forms/GTMCForm.tsx` | DI-GT MC: artifact (image URL or HTML table), 5 options, correct letter. |
| `frontend/src/components/di-editor/forms/GTYesNoForm.tsx` | DI-GT Yes/No: artifact + N statements + 2 column headers + per-row correct column. |
| `frontend/src/components/di-editor/forms/GTDropdownForm.tsx` | DI-GT dropdown: artifact + question text with `[[1]]` markers + per-blank options + correct value. |
| `frontend/src/components/di-editor/forms/MSRForm.tsx` | DI-MSR: N source tabs, N sub-questions (each MC or Yes/No), per-sub correct answer. |
| `frontend/src/components/di-editor/forms/TPAForm.tsx` | DI-TPA: 2 column headers, N row options, correct row index per column. |
| `frontend/src/components/di-editor/ArtifactEditor.tsx` | Reusable artifact widget: list of image URLs + list of HTML tables + description. |
| `frontend/src/components/di-editor/PreviewPane.tsx` | Wraps existing `<GTQuestionCard>` / `<MSRQuestionCard>` / `<TPAQuestionCard>` / `<DSQuestionCard>` in read-only preview mode. |
| `frontend/src/services/api.ts` | Add `createQuestionV3`, `updateQuestionV3`. |

Reuse the **existing card components** for preview — that's the whole point of having them.

### Backend
| File | Change |
|------|--------|
| `backend/src/routes/questionBagV3Routes.ts` | Add `POST /` (create) — admin-only, mirrors `PUT /:id` pattern. Validate per `questionType`. |
| (no model change) | `QuestionBagV3` already has `msrSources`, `subQuestions`, `artifactImages`, `artifactTables`. We extend convention, not schema. |

The `subQuestions` field's `questionType` enum already supports `multiple_choice | yes_no_table | two_part_analysis`. For dropdown fill-in, use `multiple_choice` per blank (one sub-question per blank), with `[[1]]`/`[[2]]` markers in the parent `questionText`.

### Routing wiring
- Add to `frontend/src/App.tsx`:
  - `<Route path="/admin/questions/di/new" element={<DIEditorPage />} />`
  - `<Route path="/admin/questions/di/:id/edit" element={<DIEditorPage />} />`
- Add a "+ Create DI question" button on `pages/DIReviewPage.tsx`.
- Optional: top-level "Create question" entry in `AdminPanel.tsx`.

## 5. Form fields per type

Common to all (in `CommonFields.tsx`):
- `questionText` (textarea, required, supports newlines + LaTeX)
- `category` — fixed `'Data Insights'`
- `difficulty` — select Easy / Medium / Hard / Very Hard
- `source` — default `'Manual entry'`, free text
- `sourceDetails.url` — optional
- `tags` — chips, default seeded from type
- `metadata.topic` / `metadata.subtopic` — optional
- `explanation` — textarea, optional

### 5.1 DS (DI-DS)
| Field | Notes |
|-------|-------|
| `questionText` | Stem + numbered statements `(1)` and `(2)` (one textarea, free-form). |
| Options | **Pre-filled, read-only** with the 5 canonical DS options. |
| `correctAnswer` | Radio A/B/C/D/E. |

Save shape: standard V3 doc with `options: { A..E }` populated.

### 5.2 GT MC (DI-GT, multiple choice + artifact)
| Field | Notes |
|-------|-------|
| `questionText` | Required. |
| `artifactImages[]` | List of URLs. Add/remove rows. |
| `artifactTables[]` | List of HTML strings. Textareas. |
| `artifactDescription` | Optional 1-line. |
| `options.A..E` | 5 textareas, all required. |
| `correctAnswer` | Radio. |

Save shape: V3 doc, `options` populated, `subQuestions` empty.

### 5.3 GT Yes/No (DI-GT, supported/yes-no statements)
| Field | Notes |
|-------|-------|
| `questionText` | Stem + lead-in (e.g., "For each conclusion, select Supported if ..."). |
| `artifactImages[]` / `artifactTables[]` | Same as GT MC. |
| Column headers | 2 inputs: e.g., `Supported`, `Not supported` (or `Yes`, `No`). |
| Statements[] | Repeatable list. Each row: text + correct column (radio between the two headers). |
| Min statements | 3 (typical 3–5). |

Save shape (V3):
```js
{
  questionType: 'DI-GT',
  options: {},
  correctAnswer: '',
  artifactTables: [...], artifactImages: [...],
  subQuestions: [{
    questionId: 'gt_yn_<uuid>',
    questionType: 'yes_no_table',
    columnHeaders: ['Supported', 'Not supported'],
    statements: [{ text }, { text }, ...],
    correctAnswer: ['0','1','0', ...]   // colIdx as string per statement
  }]
}
```

### 5.4 GT Dropdown (DI-GT, fill-in-the-blank)
| Field | Notes |
|-------|-------|
| `questionText` | Use `[[1]]`, `[[2]]` markers in the body for each blank. Editor counts markers. |
| Artifact | Same artifact controls. |
| Per-blank panel (one per `[[N]]`) | Inputs: list of options (label + value) + correct value. |

Save shape (V3):
```js
{
  questionType: 'DI-GT',
  options: {},
  artifactImages: [...], artifactTables: [...],
  subQuestions: [
    { questionId: 'gt_blank_1', questionType: 'multiple_choice',
      questionText: 'blank #1',
      options: [{value:'A',text:'…'}, {value:'B',text:'…'}, ...],
      correctAnswer: 'A' },
    { questionId: 'gt_blank_2', ... }
  ]
}
```

> **Note:** rendering this requires a small extension to `GTQuestionCard.tsx` (split text on `[[N]]` and inject inline `<select>`). Out of scope for v1 if we ship the editor first; the editor saves the right shape and a follow-up PR handles rendering.

### 5.5 MSR (DI-MSR)
| Field | Notes |
|-------|-------|
| `questionText` | Optional intro (often empty for MSR). |
| Sources[] | Repeatable. Per source: `tabName` (input), `content` (textarea), optional images[], optional tables[] (HTML). Min 2, typical 3. |
| Sub-questions[] | Repeatable. Per sub: type select (`multiple_choice` or `yes_no_table`) + the type-specific fields below. Typical 3 subs. |
| Sub `multiple_choice` | text + 5 options + correct letter. |
| Sub `yes_no_table` | column headers + statements[] + correct col per row. |

Save shape: standard V3 with `msrSources` and `subQuestions` populated.

### 5.6 TPA (DI-TPA)
| Field | Notes |
|-------|-------|
| `questionText` | Full prompt incl. "Make only two selections, one in each column." |
| Column headers | 2 inputs (LaTeX OK, e.g. `v_0`, `v_{10}`). |
| Row options | Repeatable list of strings (typical 5–6). |
| Correct answer | Two row pickers: column 1 picks row index, column 2 picks row index. |
| Optional `options.A..E` | Allow editor to also fill `options` mirroring rows + a sentinel "Insufficient information" option (some real TPAs have this). |

Save shape:
```js
{
  questionType: 'DI-TPA',
  questionText: '...',
  options: {},                       // or A..E mirror if editor opts in
  subQuestions: [{
    questionId: 'tpa_<uuid>',
    questionType: 'two_part_analysis',
    columnHeaders: ['v₀', 'v₁₀'],
    rowOptions: ['5','18','20','36','72'],
    correctAnswer: ['1','3']         // [col0_rowIdx, col1_rowIdx], stringified
  }]
}
```

## 6. Validation rules

Run on submit; show inline errors:

- All types: `questionText` non-empty; `category` = `'Data Insights'`; `difficulty` set.
- DS: `correctAnswer ∈ {A..E}`. Options are forced-canonical.
- GT MC: `options.A..E` all non-empty (>= 1 char). `correctAnswer` set.
- GT Yes/No: `subQuestions[0].statements.length >= 2`. Each statement has text. `correctAnswer.length === statements.length`. Both `columnHeaders` non-empty.
- GT Dropdown: number of `[[N]]` markers in `questionText` equals number of sub-questions, each with ≥ 2 options and a `correctAnswer`.
- MSR: `msrSources.length >= 2`; each source has a `tabName` and `content`. `subQuestions.length >= 1`; each sub validates per its sub-type rules.
- TPA: `columnHeaders.length === 2`; both non-empty. `rowOptions.length >= 2`. `correctAnswer.length === 2`, both are valid row indices.
- Optional fields (explanation, source, tags) free.

Server-side: re-validate the same rules in the new `POST /api/question-bag-v3` route — never trust the client.

## 7. Preview pane

Right-hand pane renders the live form state via the existing card component:

| Type | Component |
|------|-----------|
| DS | `DSQuestionCard` |
| GT MC | `GTQuestionCard` |
| GT Yes/No | `GTQuestionCard` (extend to render `subQuestions[0]` if `yes_no_table`) |
| GT Dropdown | `GTQuestionCard` (extension TODO) |
| MSR | `MSRQuestionCard` |
| TPA | `TPAQuestionCard` |

All cards already accept `showAnswer` + `correctAnswer(s)` props — pass `showAnswer={true}` in preview so the editor can see the highlighted correct option(s). Disable click handlers (`onAnswerSelect`) in preview.

## 8. Save / update API

### Create — `POST /api/question-bag-v3`
- Auth: `authenticateToken` + admin role (mirror existing `PUT /:id`).
- Body: full V3-shaped doc (all the fields documented in `context/QUESTION_DATA_MODEL.md`).
- Server: per-type validation, set `extractionVersion = 'manual_v1'`, `validationStatus = 'perfect'` (since human-entered).
- Return: created doc, transformed via existing `transformQuestionForFrontend`.

### Update — `PUT /api/question-bag-v3/:id`
- Already exists. No change needed beyond validation parity.

### Optional — `POST /api/question-bag-v3/:id/clone`
- Useful UX. Returns a new doc with `_id` stripped. Implement only if cheap.

## 9. Implementation sequence

Build in this order — each step is shippable on its own.

1. **Backend**: add `POST /api/question-bag-v3` with per-type validation. (~ 100 LOC)
2. **Page scaffolding**: `DIEditorPage.tsx` with type picker + empty form area + `PreviewPane`. Route wiring. (~ 150 LOC)
3. **DS form** — easiest, validates the architecture end-to-end.
4. **GT MC form** — exercises artifact controls.
5. **TPA form** — exercises `subQuestions` save shape.
6. **GT Yes/No form** — exercises statement repeaters.
7. **MSR form** — most complex; reuses Yes/No + MC sub-forms.
8. **GT Dropdown form** — schema-only in v1; rendering extension is a follow-up.
9. **Edit mode** (`/edit/:id`) — load existing doc, prefill, switch route on save.
10. **Polish**: inline preview improvements, autosave to localStorage, "Save & New" button, clone-from-existing.

Estimated v1 scope (no extraction work): ~3–5 focused days.

## 10. Resolved decisions (was: open questions)

1. **Nav placement** — top nav, slot **after "Question Bank DI"**, labelled **"Question Forge"**. Admin-only, hidden for everyone else.
2. **Autosave** — yes, in v1. Drafts persist in `localStorage` keyed by `forge:draft:<questionType>` (or `forge:draft:edit:<id>` in edit mode). Restored automatically; cleared on save.
3. **GT Dropdown rendering** — Forge saves the correct shape in v1; rendering extension to `GTQuestionCard.tsx` ships in a follow-up PR.
4. **Image hosting** — external URLs only in v1; native upload deferred.
5. **Validation status** — manual entries default to `validationStatus: 'perfect'`. The editor is the human review.

## 11. New requirements (added 2026-04-30)

### 11.1 `entryMethod` field on `QuestionBagV3`

A separate dimension from `source` (which captures *where the question content originated* — GMAT OG, GMAT Prep, GMAT Club, etc.). `entryMethod` captures *how it landed in our DB*. Used later for analytics and quality instrumentation.

```ts
entryMethod:
  | 'manual'         // typed in via Question Forge
  | 'scraped'        // Puppeteer + parser pipeline
  | 'ai_generated'   // synthesized by an LLM
  | 'pdf_import'     // pdfImporter / pdfProcessor
  | 'excel_import'   // OG spreadsheet import
  | 'unknown'        // legacy / pre-instrumentation (default for existing docs)
```

- Schema: optional, default `'unknown'` (so all existing docs are valid).
- The Forge POST sets `entryMethod: 'manual'` automatically.
- Future ingestion scripts must set their own value at insert time.

### 11.2 Editor capabilities (left pane)

The left pane is a **type-aware editor** that gives the question-bank editor enough power to author DI questions without raw HTML. v1 capabilities:

#### Templates (per type)
A "Templates" button at the top of every form preloads sensible defaults:
- **DS** — canonical 5 options pre-filled (read-only).
- **GT-MC** — empty A–E options + empty data table (3×3) pre-seeded.
- **GT-YesNo** — column headers `Supported` / `Not supported` + 3 blank statement rows.
- **GT-Dropdown** — questionText skeleton with `[[1]]` and `[[2]]` markers + 2 blank dropdown panels.
- **MSR** — 3 source tabs (`Email 1`, `Email 2`, `Memo`) + 3 blank sub-questions (default type = MC).
- **TPA** — 2 columns + 5 blank row options.

#### Inline table builder (`ArtifactEditor`)
- "Add table" button → modal with rows/cols/has-header inputs → grid of editable cells.
- On save, serializes to a clean `<table class="stoker table-sortable">…</table>` string and pushes onto `artifactTables`.
- Existing tables can be re-opened, edited (cell-by-cell), or deleted.
- "Paste raw HTML" fallback for power users.

#### Image / graph attachment
- "Add image" → input for an image URL (with paste-from-clipboard helper).
- Optional caption (stored in `artifactDescription` if it's the first image, otherwise ignored in v1).
- Per-image preview thumbnail; remove button.
- "Native upload" stub button that's disabled with a tooltip "Coming soon".

#### Options template helpers
- "Reset to A–E" button — wipes the 5 MC option fields and re-numbers.
- "Add option" / "Remove option" — only on types that allow > 5 (none in v1, but the helper is generic).

#### Modern UI conventions
- Two-pane layout, sticky preview on the right (≥ lg breakpoint).
- Steps strip at the top: `1 Type → 2 Compose → 3 Save`.
- Ant Design `Card`, `Form`, `Steps`, `Tabs`, `Segmented`, `Tag`, `Tooltip`. Tailwind for spacing.
- Theme accent: amber/orange (distinct from blue Quiz / red Admin / purple DI Review).
- All inputs labelled, with helper text and inline validation.
- Form keyboard-friendly (Enter ≠ submit; Cmd/Ctrl+S triggers save).

### 11.3 Updated file list

(Adds to § 4.)

| New / changed | Purpose |
|---|---|
| `backend/src/models/QuestionBagV3.ts` | Add `entryMethod` field. |
| `backend/src/routes/questionBagV3Routes.ts` | Add `POST /` (create) — admin-only, validates per-type, sets `entryMethod: 'manual'`. |
| `frontend/src/pages/DIEditorPage.tsx` | Top page (Forge). |
| `frontend/src/components/forge/ForgeShell.tsx` | Layout: stepper + 2-pane + save bar. |
| `frontend/src/components/forge/TypePicker.tsx` | Step 1: type cards. |
| `frontend/src/components/forge/CommonFields.tsx` | Shared header. |
| `frontend/src/components/forge/ArtifactEditor.tsx` | Tables (inline builder + raw HTML), images (URL list). |
| `frontend/src/components/forge/forms/DSForm.tsx` | DI-DS form. |
| `frontend/src/components/forge/forms/GTMCForm.tsx` | DI-GT MC form. |
| `frontend/src/components/forge/forms/GTYesNoForm.tsx` | DI-GT Yes/No form. |
| `frontend/src/components/forge/forms/GTDropdownForm.tsx` | DI-GT Dropdown form (saver only in v1). |
| `frontend/src/components/forge/forms/MSRForm.tsx` | DI-MSR form. |
| `frontend/src/components/forge/forms/TPAForm.tsx` | DI-TPA form. |
| `frontend/src/components/forge/PreviewPane.tsx` | Wraps existing card components in read-only mode. |
| `frontend/src/components/forge/useForgeDraft.ts` | localStorage autosave hook. |
| `frontend/src/components/forge/templates.ts` | Per-type starter payloads. |
| `frontend/src/services/api.ts` | `createQuestionV3`, `updateQuestionV3`. |
| `frontend/src/components/Navbar.tsx` | Add "Question Forge" link after "Question Bank DI" (admin-only). |
| `frontend/src/App.tsx` | Routes `/forge`, `/forge/:id`. |


Workflow Assessment & action items : 
1. Need a drop down since questions aren't appearing properly anywhere for Two parts analysis
2. Multi source reasoning show answer does not work, clicking n the question tab does not work as well. Information tab is working.
3. Artifiact description should appear below the artifact and not above, currently it's appearing above the artifact.
4. Question was configured for G&T supported not supported, but in the question bank DI section unable to see the question!! maybe data type not supprted in the UI of question bank. But question and everything was configured for the Yes/No table.
5. Unable to select options and look at questions in the quiz as well...
6. Maybe need to increase the horizontal iwidth of viewing the question live rendering.

--- above fix was done---

1. Quiz section wasn't resetting questions in case of consecutive MSRs. 
2. Quiz should have 20 questions in total and not 20 parent questions which can have mutliple questions within them. 
3. Check RC db currently, what is the db from where ui is rendered and questions picked up . if RC is coming sequentially per paragraph. 
4. Make tbles interactive -- allow sorting by all columns.