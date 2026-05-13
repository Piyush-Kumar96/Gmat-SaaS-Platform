# Question Sourcing & Extraction — Living Log

> **Purpose:** what we source from, what extraction pipelines exist, what works, what doesn't, and an append-only log of new findings.
> **Update rule:** when an extractor changes, a source breaks, or a new strategy is tried, append a dated entry to the **Findings log** at the bottom. Do **not** delete old entries.

## 1. Primary sources

| Source | What we use it for | Form | Notes |
|--------|--------------------|------|-------|
| **GMAT Club forum** | Live, community-vetted bank for all types. Stats (% correct, timing) included. | HTML pages, Cloudflare-protected | The **richest** source but messiest HTML. Stats live inside `.stoker` blocks; correct answer often inside spoiler/discussion. |
| **Official Guide (OG) spreadsheets** | Authoritative question lists. | XLSX in `backend/materials/`: `GMAT __ OG Spreadsheet.xlsx`, `GMAT Official Questions Bank OG GMAT Prep.xlsx` | Use as the "what should exist" index; cross-check scraped content against these. |
| **Source PDFs** | Older OG editions, prep books. | PDFs in `backend/pdfs/` | Imported via `backend/src/pdfImporter.ts` and `services/pdfProcessor.ts`. Quality variable. |
| **GMAT Club Best-of-2025 DI** | Curated DI bank. | `https://gmatclub.com/forum/best-of-the-best-of-2025-data-insights-453189.html` | Index page that links to category pages (DS, GT, MSR, TPA). |

## 2. Extraction pipelines

### 2.1 V3 generic pipeline — `backend/src/scripts/v3_extraction/`
**Status:** ✅ working for **RC** and **Quant**.

```
config.py
html_parser.py            # deterministic Cheerio/BeautifulSoup parsing
gpt4o_formatter.py        # GPT cleanup (text, LaTeX, missing fields)
db_inserter.py            # writes to QuestionBagV3
audit_questions.py        # post-insert validation
extract_rc_questions.py
extract_quant_questions.py
```

Pattern: Puppeteer scrape → save HTML → deterministic parse → GPT cleanup → insert. RC adds `passageId` for grouping.

### 2.2 DI-specific pipeline — `backend/src/scripts/di_extraction/`
**Status:** ⚠️ partial. Works for some DS and TPA; G&T (Yes/No) and MSR are unreliable.

```
explore_di_page.ts        # Puppeteer DOM exploration
discover_di_links.ts      # crawl index → category → question URLs
extract_di_html.ts        # save raw HTML per question
parse_di_questions.py     # heuristic parser per type
format_di_questions.py    # GPT-based cleanup
insert_di_questions.ts    # write to QuestionBagV3
fetch_sample_question.js  # dev helper
explore_msr_tabs.js       # MSR-specific tab exploration
```

Latest output: `backend/output/di_test_extraction.json` (80 sample questions, Feb 2026).

### 2.3 Legacy scrapers
- `backend/src/scripts/extractWithPuppeteer.ts`
- `backend/src/scripts/extractWithPuppeteer_html.ts`
- `backend/src/scripts/extractQuestionsFromLinks.ts`

Use only as reference — superseded by the v3 pipeline.

### 2.4 Validation / fixers
- `backend/src/scripts/validateQuestionsWithGPT4.ts` — pre-import validation pass.
- `backend/src/scripts/validateQuestionsImproved.ts` — improved checks.
- `backend/src/scripts/fixIncompleteOptions.ts` — completes truncated options via LLM.
- `backend/src/scripts/auditAllQuestions.ts` — planned (per `PROJECT_PLAN_2026.md`).

## 3. What works / what doesn't (as of Feb 2026)

| Type | Extraction | Insertion | Rendering | Notes |
|------|:----------:|:---------:|:---------:|-------|
| PS | ✅ | ✅ | ✅ | Stable |
| CR | ✅ | ✅ | ✅ | Stable |
| RC | ✅ | ⚠️ V3 backfill 0 | ✅ V3-first / V2-fallback | **Quiz fetch uses V3 first, V2 fallback** via `getRcQuiz()` in `frontend/src/services/api.ts`. V3 RC bank is currently empty (0 docs); V2 holds 1,395 RC docs across 261 passages and is what users actually see today. As V3 RC content lands (per-passage manual entry via Forge or deterministic re-extraction), it will start being served first and V2 fallback recedes. `getVerbalQuiz()` returns `rcSourcedFrom: 'v2' \| 'v3'` so the UI / telemetry can tell where each RC quiz came from. Run `npm run rc-migration-report` (in `backend/`) to see V2-only passages still needing V3 import. |
| DS / DI-DS | ✅ | ✅ | ✅ | Standard 5-options canonical |
| DI-GT (standard MC) | ✅ | ✅ | ✅ | When the artifact is a parseable HTML table |
| DI-GT (Yes/No table) | ⚠️ broken | ⚠️ wrong shape | ❌ no card | Statements crammed into A/B/C, D/E empty |
| DI-GT (dropdown fill-in) | ❌ | ❌ | ❌ | Not implemented |
| DI-MSR | ⚠️ partial | ⚠️ `msrSources` often empty | ⚠️ falls back to questionText only | Sub-questions not linked to source set reliably |
| DI-TPA | ⚠️ partial | ⚠️ `subQuestions` sometimes empty; `correctAnswer` often `''` | ✅ when populated | Column headers with MathJax break easily |

## 3a. Boldface / highlight in passages and arguments

Real GMAT CR items reference "the portion in **boldface**" and RC items sometimes have highlighted spans. Source HTML preserves this (`<span style="font-weight: bold">…</span>` for bold, `<span style="background-color: #FFFF00">…</span>` for highlight) but the original Python extractors used `BeautifulSoup.get_text(strip=True)`, which discards inline markup — so the DB ended up with plain text and the front-end couldn't render the cue.

Fix landed:
- **Front-end** renders `passageText`/`questionText` via `dangerouslySetInnerHTML` filtered through `frontend/src/utils/sanitizeHtml.ts` (allowlist: `b`, `strong`, `i`, `em`, `mark`, `br`, `p`, `span`, `sup`, `sub`, `u`).
- **V3 RC extractor** (`backend/src/scripts/v3_extraction/html_parser.py`) now serializes the passage with `_serialize_with_format()`, which keeps `<b>` and `<mark>` and drops everything else.
- **Backfill** for existing CR/RC docs: `cd backend && npm run backfill-formatting` (dry-run) or `... -- --commit`. Walks `exports/html_cr_*` and `exports/html_rc_*`, harvests bold/highlight fragments from `.item.text` / `.reading-passage`, locates each fragment in the matching DB doc's existing plain text, and wraps it with `<b>`/`<mark>` — non-destructive (no other fields touched).

The legacy Python processors (`process_RC_*.py`, `processCROGQuestionsWithMistralSequential.py`) still strip formatting on a fresh re-run; backfill is the canonical path until those are migrated to the same helper.

## 4. Known reliability issues

- **Cloudflare** sometimes triggers on consecutive rapid requests — `puppeteer-extra-plugin-stealth` mitigates but doesn't eliminate. Rate-limit to 2–4s between requests.
- **MathJax in HTML** — extraction captures the giant rendered MathJax span tree instead of the underlying `<script type="math/tex">` source. Always strip MathJax HTML and prefer the `data-mathml` or script-tag source.
- **Truncated options** — older scrapes cut off options at page-pagination boundaries. Tracked in `backend/incomplete_options_report.json` (~254 questions, 375 truncations).
- **Correct answers** are frequently in forum spoiler tags or buried in discussion replies — needs targeted scraping.
- **Stats and timing** live in dedicated blocks; structurally consistent but easy to mis-parse if classnames change.

## 5. Decision: manual DI editor (Feb 2026)

Because (a) DI extraction reliability is below threshold and (b) the existing non-DI editor (`ReviewPage.tsx`) works well, the team has decided to **build a manual DI Question Editor** as the canonical path for new DI content. Extraction continues for bulk drafting, but every DI question is expected to pass through human review/entry before going live.

See **`DI_EDITOR_PLAN.md`** for the implementation plan.

---

## Findings log (append-only)

Newest entries at the top. One entry = a discovery, change, or attempt.

### 2026-05-04 — DI-DS fallback, RC ≤4 cap, deterministic QA gate
- **Bug**: Main GMAT quiz Data Insights section returned only DI-MSR/GT/TPA — DI-DS missing because V3 has zero DI-DS docs (V2 has 101 `Data Sufficiency`).
- **Fix**: New `getDataInsightsQuiz()` in `frontend/src/services/api.ts` pulls non-DS DI types from V3 + DS from V2 (default ~25% share), mirrors the `getRcQuiz` V3-first / V2-fallback pattern.
- **Bug**: Verbal section served an RC passage with 6 sub-questions; real GMAT caps each passage at 4. **Fix**: hard cap `RC_MAX_PER_PASSAGE = 4` in both V2 and V3 random endpoints' RC selection loops.
- **New**: deterministic question quality gate `backend/src/services/questionQA.ts` + feature flag in `backend/src/config/featureFlags.ts` (`QUIZ_QA_ENABLED`, default true; override via `.env`). Both `/random` endpoints filter candidates and run one bounded top-up pass when QA drops anything. Validator catches: empty/short questionText, scrape leftovers (`"Show Answer"`, `"Official Answer and Stats..."`), missing RC passage, RC grouping key missing, MSR with no sources or sub-questions, MSR sub-question missing correctAnswer, TPA missing column/row/answer-pair, GT with no renderable shape, options array with all-empty entries, correctAnswer that doesn't map to a real letter (with tolerant extraction for `"OA:B"` / `"Answer: C"` / `"95. A …"` legacy forms — but rejects `"Unknown"`).
- **Real-data findings from a sample** (200 V2 docs per type, all V3): V2 CR 0.5% drop, V2 PS 1.2%, V2 DS 0%, V2 RC 27.5% (mostly genuine `"Unknown"` correct-answer markers from prior extraction failures), V3 MSR 95% (sub-question `correctAnswer` never populated by the MSR insertion script — known unfixed pipeline bug). Toggle the flag off if it starts blocking quiz generation while we fix data.

### 2026-05-04 — RC quiz unblock + GMAT-correct MSR/RC sub-question stepping
- **Bug**: Verbal section returned 11 CR + 0 RC; explicit RC-only quiz threw a 404. Root cause: V3 RC bank holds 0 docs (DB check: V3 has 3 DI-GT, 21 DI-MSR, 1 DI-TPA; no RC). The earlier RC→V3 migration wired the routing but data never landed.
- **Fix**: `getRcQuiz()` in `frontend/src/services/api.ts` does V3-first / V2-fallback. `getVerbalQuiz` switched to call it. Both `QuizPage` and `GMATFocusQuizPage` route RC-only requests through it. RC quizzes now serve from V2 (1,395 docs / 261 passages) until V3 is populated per-passage.
- **UX fix**: Real GMAT shows MSR sub-questions ONE at a time, no jumping, no sibling count visible. New `frontend/src/utils/flattenQuiz.ts` (a) explodes each MSR stem into N virtual entries so the main pager steps through sub-questions, and (b) provides `countAnsweredSubItems()` so the footer "X of N answered" counts each MSR sub-Q individually. Sub-Q pill nav inside `MSRQuestionCard` only renders when `onSubQuestionChange` is supplied (admin Question Bank preview); the quiz no longer passes it. RC sibling pills hidden in quiz via new `hidePassagePills` prop on `QuestionCard`/`RCQuestionCard`.
- **Strategic note**: V3 backfill remains per-passage and validation-gated. Two-collection setup carries no infra cost (MongoDB doesn't bill per collection); operational cost is the dual read paths in the random-quiz endpoints, which `getRcQuiz` consolidates.

### 2026-04-30 — Manual DI editor decision
- Confirmed: extraction works ~50–70% for DI; G&T/MSR/TPA shapes don't fit `options: A-E`.
- Decision: build a manual creator/editor UI with type-aware forms, save direct to `QuestionBagV3`.
- Plan: see `DI_EDITOR_PLAN.md` (UI implementation plan, separate doc).

### 2026-02-08 — DI extraction strategy v2
- Captured findings in `DI Question Extraction strategy v2.md` (project root).
- Summary: HTML-deterministic parse beats GPT-only; recommended sub-typing into `interactionType: 'multiple_choice' | 'yes_no_table' | 'two_part_analysis' | 'dropdown_fill'`. **Not yet adopted in DB.**
- Output sample: 80 questions in `backend/output/di_test_extraction.json` (20 DS / 20 GT / 20 MSR / 20 TPA).

### 2026-01 (project plan baseline)
- 254 questions flagged with truncated options across 375 instances (`incomplete_options_report.{json,txt}`).
- Mistral 7B local timed out on bulk runs; GPT-4o accuracy issues on educational content.
- Recommended switch to Claude Sonnet 4.5 for option completion + explanation generation (see `PROJECT_PLAN_2026.md` § AI Model Recommendations).

### 2025-mid — V3 pipeline introduced
- Added `passageId` to V3 to group RC questions by passage.
- Quant + RC scraping stabilized; DI deferred.

### 2025-early — Legacy Puppeteer scrapers
- `extractWithPuppeteer*.ts` family. Used for initial bulk imports. Quality issues led to the v2/v3 redesigns.

---

## Adding a new finding

Append above this line, with the date and a 1–3 paragraph note. Cover: what was tried, what worked, what to do next, and any new file or DB-shape changes.


#### Question sourcing Strategy : 

  ---                                                                                                       
  Assessment: render the raw HTMLs directly?                                                                
                                                                                                            
  Short answer: not as-is, but a "structured-extract → render" approach is much more promising than the     
  current AI-text pipeline. Here's the evidence from the four file types I inspected.                       
                                                                                                          
  What the HTMLs actually contain                                                                           
                                                            
  Looking at cr_77.html, rc_213.html, question_1.html (Quant PS), they all share the same structure (saved  
  by your scraper, not the raw GMAT Club page):             
                                                                                                            
  ┌─────────────────────────────┬────────────────────────────────────────┬─────────────────────────────┐    
  │            Block            │                Selector                │         Cleanliness         │ 
  ├─────────────────────────────┼────────────────────────────────────────┼─────────────────────────────┤    
  ────────────────────────────────────────                                                               
  Block: Metadata (Source, Type, Difficulty, Topic, Question Number, RC Number)                          
  Selector: .metadata > div (key:value pairs)                                                            
  Cleanliness: ✅ structured                                                                                
  ────────────────────────────────────────                                                               
  Block: Question stem                                                                                      
  Selector: .question-text .item.text                                                                       
  Cleanliness: ✅ contains the prose, options as text with <br>, and bold/highlight spans intact         
  ────────────────────────────────────────                                                                  
  Block: RC passage                                                                                      
  Selector: .reading-passage                                                                             
  Cleanliness: ✅ separate from the question — perfect for grouping                                         
  ────────────────────────────────────────                                                               
  Block: Options                                                                                            
  Selector: embedded inline as (A) ... <br>(B) ... text                                                     
  Cleanliness: ⚠️  not in semantic <ol>/<li> — needs splitting                                            
  ────────────────────────────────────────                                                                  
  Block: Correct answer                                                                                     
  Selector: <div id="spoiler_NNN">…Official Answer and Stats are available only to registered users.</div>
  Cleanliness: ❌ not in HTML — Cloudflare-gated                                                            
  ────────────────────────────────────────                                                              
  Block: Answer % stats                                                                                 
  Selector: .answer-stats .statisticWrapExisting (a/b/c/d/e + percentages)                              
  Cleanliness: ✅ structured per option                                                                     
  ────────────────────────────────────────                                                              
  Block: Difficulty % + label                                                                               
  Selector: .session-stats .difficulty                                                                      
  Cleanliness: ✅ structured                                                                            
  ────────────────────────────────────────                                                                  
  Block: Timing / sessions                                                                              
  Selector: .session-stats .question                                                                        
  Cleanliness: ✅ structured                                                                            
  ────────────────────────────────────────                                                                  
  Block: Spoiler/discussion clutter                                                                         
  Selector: various .spoiler, .twoRowsBlock, timer JS
  Cleanliness: ⚠️  noise, but skippable                                                                      
  ────────────────────────────────────────                  
  Block: Inline images (Quant)
  Selector: <img src="https://gmatclub.com/forum/download/file.php?id=...">
  Cleanliness: ⚠️  hot-linked + Cloudflare-protected; need to mirror
  ────────────────────────────────────────
  Block: MathJax                                                                                            
  Selector: rendered to giant span trees (not in these three samples but present in many quant)
  Cleanliness: ❌ unusable — needs script[type="math/tex"] source instead                                   
                                                            
  Three rendering strategies

  1. "Render raw HTML in an iframe with style override" — No.                                               
  - Pulls in scraper-injected styling, JS handlers (hideAnswer(this,'spoiler_…')), spoiler boxes, and
  discussion blocks that actively hide the answer.                                                          
  - Hot-linked images (gmatclub.com/forum/download/...) will fail in production because of Cloudflare
  hotlink protection.                                                                                       
  - MathJax is missing source — what's stored is the rendered span soup.                                    
  - Won't match the platform look-and-feel without a wholesale CSS rewrite per file.
                                                                                                            
  2. "Strip + inject into our card via dangerouslySetInnerHTML" — Partially viable, ~70-80% of cases.       
  - Already what your sanitizeHtml utility supports (b, mark, i, em, br, p, span, sup, sub, u).             
  - For CR and RC this would give you bold/highlight + paragraph structure with no AI.                      
  - Breaks for: questions with images, MathJax, embedded tables (Quant DS, GT), embedded answer-choice      
  formatting that's actually semantic (e.g. fractions).                                                     
  - Still leaves you with: option splitting (parsing (A) … <br>(B) …), correct-answer fetching (separate    
  problem — Cloudflare spoiler), stats parsing.                                                             
                                                                                                            
  3. "Deterministic structured-extract → store rich fields → render in your existing cards" — This is the 
  best path. ← recommended                                                                                  
  - Walk the same .item.text, .reading-passage, .metadata, .answer-stats, .session-stats selectors with
  cheerio.                                                                                                  
  - Output: passageText (HTML, allowlist-sanitized — keeps <b>/<mark>), questionText (same), options: { A, 
  B, C, D, E } (from regex split on the (X) markers in the trailing chunk), statistics.answerStats (already 
  parsed), statistics.sessionStats, metadata (Source/Type/Topic/Difficulty key-value).                      
  - No LLM needed for ~80–90% of CR/RC questions. AI is only required for: option-splitting failures,
  MathJax-source recovery, image migration, correct-answer recovery.                                        
  - Your front-end cards already render this shape today. Zero card changes.                                
                                                                            
  What I'd recommend you do next                                                                            
                                                                                                            
  1. Build a deterministic V3 extractor for CR + RC (probably 2–3 days). Selectors above are stable across  
  all three sample files — same scraper produced them. Targets:                                             
    - passageText / questionText as sanitized HTML (no LLM rephrase)                                        
    - options.A..E from regex-splitting the question text tail                                              
    - statistics block from .answer-stats and .session-stats                                                
  2. Solve the correct-answer problem separately. It's not in the HTML at all — spoiler_NNN always says     
  "Official Answer and Stats are available only to registered users." You need either an authenticated      
  re-scrape, or to keep the existing answers from the AI pipeline (correct answer is rarely the part it gets
   wrong — most failures are option text truncation and bold loss, both of which the deterministic path     
  fixes).                                                   
  3. Skip Quant initially. MathJax + image-heavy = harder. Same approach works but image migration to your
  CDN is a chunk of extra work.                                                                             
  4. DI stays manual per your existing decision in DI_EDITOR_PLAN.md.
                                                                                                            
  The boldface backfill we just shipped is essentially a partial version of strategy 3 (fragments only,     
  layered onto AI text). A full deterministic re-extractor would replace the AI text entirely and remove the
   dependence on fragment-locating heuristics — at which point the 60% production-grade rate should jump    
  significantly because you're no longer asking an LLM to faithfully reproduce a paragraph of source text.

  Want me to prototype the deterministic CR+RC extractor against, say, 10 sample HTMLs so you can compare   
  output quality vs. the current DB rows before committing to the full rebuild?


  DS & Quant ingestion — gap assessment
                                                                                                            

  ##########                                                                                                          
  You're right that the live numbers (~167 PS, ~101 DS) are tiny vs. what's available. Here's the actual
  state:                                                                                                    
                                                            
  What's on disk                                                                                            
                                                            
  ┌──────────────────────────────────────────────┬──────────────────┬────────────────────────┬──────────┐   
  │                Source folder                 │   HTML files     │   Mistral-processed    │ In V2 DB │
  │                                              │     scraped      │         JSONs          │          │   
  ├──────────────────────────────────────────────┼──────────────────┼────────────────────────┼──────────┤
  │ html_quant_og → mistral'd                    │            1,939 │       (mixed in below) │  ~167 PS │   
  ├──────────────────────────────────────────────┼──────────────────┼────────────────────────┼──────────┤   
  │ html_quant_gmatprep →                        │            1,574 │ 1,574 (823 DS, 751 PS) │  ~101 DS │   
  │ quant_gmatprep_mistral7b                     │                  │                        │          │   
  ├──────────────────────────────────────────────┼──────────────────┼────────────────────────┼──────────┤   
  │ html_quant_exampacks →                       │              297 │                    297 │ (subset) │
  │ quant_exampacks_mistral7b                    │                  │                        │          │   
  ├──────────────────────────────────────────────┼──────────────────┼────────────────────────┼──────────┤
  │ Total                                        │            3,810 │                 ~1,872 │     ~268 │   
  └──────────────────────────────────────────────┴──────────────────┴────────────────────────┴──────────┘   
   
  The real bottleneck                                                                                       
                                                            
  backend/src/scripts/importQuantQuestionsToDb.ts is hard-coded to only process quant_exampacks_mistral7b   
  (line 66 has a strict === 'quant_exampacks_mistral7b' filter, despite the CLI exposing --folder= and --all
   arguments that go ignored). So the ~1,574 GMAT Prep questions (823 DS + 751 PS) sit untouched on disk.   
                                                            
  Recommended areas of work, ordered by impact                                                              
   
  1. Unblock the existing import script (smallest, biggest immediate win).                                  
    - Remove the hard-coded folder filter so --folder=quant_gmatprep_mistral7b and --all actually work.
    - Wire QA validator (already built) into the import path so we don't ingest garbage. Per Phase 2 of the 
  QA roadmap.                                                                                               
    - Estimated effort: 1-2 hours. Result: jump from 268 → ~1,800 live Quant docs (10× growth).             
  2. Re-process OG Quant via the deterministic V3 path, not Mistral.                                        
    - Mistral was found to be slow + unreliable per PROJECT_PLAN_2026.md. The v3_extraction/ pipeline is    
  more reliable but only 6 quant files have been processed so far.                                          
    - Recommended: run extract_quant_questions.py over the 1,939 OG HTMLs. Validate one batch with the QA   
  gate, compare against the existing V2 OG Quant, then ingest.                                              
    - Effort: 1-2 days (LLM API time dominates). Result: V3 PS bank populated, eventual replacement of V2
  PS.                                                                                                       
  3. DS-specific extraction enhancements.                   
    - DS questions have a distinct shape: stem + Statement (1) + Statement (2) + canonical 5 options. The   
  current extractor lumps DS into the same Quant pipeline; this is fine but adds risk because (1) / (2)     
  parsing is fragile (your existing DSQuestionCard:40 already does a regex split on the question text).
    - Recommended: add a DS-specific structured extractor that pulls the two statements as separate fields  
  (V3 schema already supports metadata.statement1 + metadata.statement2). Then the front-end stops doing    
  string-splitting at render time.
    - Effort: 2-3 days. Result: cleaner DS rendering + the validator can add a ds_statements_missing rule.  
  4. Image migration for Quant.                                                                             
    - Many PS questions reference figures hot-linked from gmatclub.com/forum/download/.... These will break
  in production behind Cloudflare hotlink protection.                                                       
    - Recommended: a one-shot script to download referenced images, upload to your CDN/S3, and rewrite URLs
  in DB. Could be combined with the V3 re-extraction in step 2.                                             
    - Effort: 1 day. Result: no broken images at scale.     
  5. MathJax / KaTeX source recovery.                                                                       
    - For Quant, current extracts have rendered MathJax span trees instead of source LaTeX. PS card already 
  runs renderWithMath (KaTeX) but won't render anything if the source is missing.                           
    - Recommended: in the V3 extractor, prefer <script type="math/tex"> or data-mathml attribute over       
  visible HTML.                                                                                             
    - Effort: 4-6 hours. Result: math expressions render correctly across new ingest.
                                                                                                            
  Suggested order                                           
                                                                                                            
  If you want maximum questions live tomorrow: do step 1 only. It's a one-script fix and triples your live  
  bank.
                                                                                                            
  If you want production-grade Quant: do step 1 to unblock now, then schedule 2 + 4 + 5 together as a "V3   
  Quant migration" sprint.
                                                                                                            
  DS specifically: step 1 immediately gets you ~900+ DS in the bank; step 3 makes them render cleaner once  
  you're past the validation phase.
                                                                                                            
  ---                                                       
  Files changed
               
  - New: frontend/src/utils/formatStatements.ts
  - New: context/QA_validator.md                                                                            
  - Modified:
  frontend/src/components/{PSQuestionCard,RCQuestionCard,CRQuestionCard,DSQuestionCard,QuestionCard}.tsx —  
  apply addStatementBreaks                                  
  - Modified: CLAUDE.md — added QA_validator.md to cold-start reading list                                  
                                                                                                            
  Test plan                                                                                                 
                                                                                                            
  1. Find a multi-statement question (search Question Bank for which of the following? I.) → in the quiz it 
  should now render statements on separate lines.           
  2. Spot-check a "Section I/II" type document (rare, but if you see one) → still readable but with extra   
  line breaks.                                                                                              
  3. Read context/QA_validator.md end-to-end and tell me if anything is missing or unclear.
                                                                                                            
  Want me to take a swing at step 1 of the ingestion fix (unblock the import script) right now? It's small  
  enough to do this turn.   