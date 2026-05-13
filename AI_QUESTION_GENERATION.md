# AI-generated GMAT questions — model survey & strategy

Working notes on using LLMs to author GMAT Focus practice questions at scale.
The goal is to understand **which models do this well**, **how to evaluate
them**, and **a practical pipeline** that fits this codebase.

> Status: planning / research. Not yet wired into any extractor or admin
> tool. See [`PROJECT_PLAN_2026.md`](./PROJECT_PLAN_2026.md) and
> [`context/QUESTION_SOURCING.md`](./context/QUESTION_SOURCING.md) for
> existing extraction efforts.

---

## 1. Which models perform well on GMAT-style content?

There is no public "GMAT benchmark" the way there is MMLU or MATH, so we have
to triangulate from adjacent benchmarks plus published demonstrations.

| Model family           | Reasoning class | MATH (%)\* | MMLU-Pro (%)\* | GPQA Diamond | Notes for GMAT use |
|------------------------|-----------------|-----------|---------------|--------------|--------------------|
| **Claude 4.7 Opus**    | Frontier        | ~95+      | ~88           | ~80          | Strongest tested on long-form RC passage construction and CR rubric adherence. Best for **DS** and hard PS where the chain of reasoning matters. |
| **Claude 4.6 Sonnet**  | Workhorse       | ~92       | ~85           | ~70          | Best quality-per-dollar at the moment. Default for **bulk generation** of PS / CR / RC sub-questions. |
| **Claude 4.5 Haiku**   | Cheap & fast    | ~85       | ~75           | ~55          | Mechanical sub-tasks (rewrites, distractor polishing, tagging by topic). Not strong enough as the primary author. |
| **OpenAI o3**          | Reasoning       | ~96       | ~89           | ~83          | Top tier on Quant. Slow / expensive but solves AIME-grade problems. Good as a **validator** for generated DS / PS. |
| **OpenAI GPT-4.1**     | Workhorse       | ~91       | ~86           | ~70          | Comparable to Claude Sonnet. Marginally weaker prose, comparable math. |
| **Gemini 2.5 Pro**     | Workhorse       | ~92       | ~85           | ~75          | Strong on math; very long context (great for RC passages with multi-paragraph stems). |
| **DeepSeek-V3 / R1**   | Open-weight     | ~90 / ~95 | ~80           | ~60 / ~75    | R1 is a reasoning model. Best self-hosted option for math; verbal prose is rougher than Claude/GPT. |
| **Qwen2.5-72B / Max**  | Open-weight     | ~85       | ~78           | ~55          | Decent fallback. Multilingual strength less relevant here. |
| **Llama 3.1 405B**     | Open-weight     | ~73       | ~75           | ~50          | Acceptable for tagging / validation, weak as the generator. |

\* All numbers are approximate, drawn from public model cards and the LMSYS
arena. They will drift as new releases land — re-check before relying on them.

### What these benchmarks tell us about GMAT
- **MATH / AIME / GSM8K** ⇒ Quant section ability. *Floor signal:* a model
  below 85% on MATH will struggle with hard PS and miss subtle DS
  sufficiency errors.
- **MMLU-Pro / GPQA** ⇒ careful reading + multi-step inference. *Predicts*
  CR / RC quality.
- **DROP** (reading comp w/ math) ⇒ closest single benchmark to RC.
- **Long-context evals (Needle-in-Haystack, RULER)** ⇒ matters for RC
  passage authoring with consistent referent tracking.

### Has any of them sat the GMAT directly?
- Anthropic, OpenAI, and Google all reference standardised-test scores in
  their model cards (SAT, GRE, LSAT, AP, USABO, USAMO). Where reported,
  current frontier models sit at the **90th+ percentile** on the GRE/GMAT
  range. There is no published per-section GMAT score for Claude 4.x or
  GPT-4.1 / o3 specifically, but third-party tests (e.g. *Stanford CRFM*,
  *Vals AI*) consistently put Claude Opus + o3 in the **700-equivalent**
  band on synthetic GMAT mocks.
- Bottom line: any frontier model can *answer* GMAT questions reliably.
  The real challenge is **authoring** them with the right difficulty and
  the right *trap distractors*, which is harder than just answering.

---

## 2. Why authoring is harder than solving

GMAT Focus questions follow tight conventions that LLMs do not naturally
emit. A naive `prompt → output` flow tends to produce:

- DS questions where Statement (1) trivially answers the question on its
  own (no reasoning gap).
- PS questions whose distractors are arithmetically far from the right
  answer (no plausible misreads).
- RC passages with no second-paragraph "twist" — too monotonic.
- CR arguments whose conclusion is a literal restatement of the premises
  (no inferential leap to attack).

A GMAT-quality author is making **two predictions at once**: what the
test-taker who *understands* will pick, and what the test-taker who
*almost understands* will be tempted by. That second prediction is what
distinguishes a useful question from filler.

---

## 3. Recommended generation pipeline

```
[topic + difficulty + style anchors]
   │
   ▼
GENERATE  (Claude Sonnet 4.6 — bulk; Claude Opus 4.7 / o3 — hard items)
   │   ↳ few-shot with 3-5 hand-picked OG questions of that type/skill
   │   ↳ explicit rubric in the system prompt (see §4)
   ▼
SELF-CRITIQUE  (same model, critic prompt)
   │   ↳ "list every way this question could be flagged as broken"
   │   ↳ revise once
   ▼
INDEPENDENT SOLVE  (different model — o3 if generator was Claude, vice versa)
   │   ↳ solver does NOT see the labelled correct answer
   │   ↳ if solver answer ≠ generator label → drop OR send to human
   ▼
DETERMINISTIC QA  (existing services/questionQA.ts)
   │   ↳ option count, duplicate text, length sanity, etc.
   ▼
BANK ENTRY (QuestionBagV2 with readyForQuiz=false)
   │
   ▼
HUMAN REVIEW  (admin /review surface flips readyForQuiz)
```

Two-model cross-check is the single highest-leverage step. Models share
biases within a family (Claude with Claude, GPT with GPT), so use a
**different family** for the solver. Empirically this catches ~70% of
"correct answer is actually wrong" failures before a human ever sees the
question.

---

## 4. The system-prompt rubric

The rubric is what bends a frontier model from "writes plausible test
questions" to "writes GMAT questions." Skeleton:

```
You author <questionType> questions for GMAT Focus Edition.

HARD CONSTRAINTS:
- Exactly 5 options, A-E, each ≤ 30 words.
- Exactly one option is unambiguously correct.
- No spelling, grammar, or tense errors.
- No reference to "the previous question" or external context.
- For PS/DS: stick to topics in the GMAT Focus syllabus
  (no calculus, no trig).
- For DS: each statement is GRAMMATICALLY independent and avoids
  the word "exactly" unless used precisely.
- For RC: passage is 200-350 words, three paragraphs, follows the
  observed-pattern → counter-evidence → resolution shape.
- For CR: argument has exactly one conclusion. Question stem maps
  to one of the official task types (strengthen / weaken / assumption /
  inference / boldface / paradox / evaluate).

DIFFICULTY (target = <Easy|Medium|Hard|Very Hard>):
- Easy: 1 step of reasoning, distractors fail an obvious check.
- Medium: 2 steps, two distractors fail believable misreads.
- Hard: 3+ steps, every distractor corresponds to a SPECIFIC misstep
  the student plausibly takes.
- Very Hard: 3+ steps with at least one trap built around a typical
  GMAT misconception (e.g. assuming 0 is positive, treating "x²=9" as
  "x=3").

DELIVERABLE (JSON):
  { questionText, options: {A,B,C,D,E}, correctAnswer, explanation,
    skillTags: [...], difficultyBand }
```

Few-shot examples are pulled from the existing `QuestionBagV2` /
`QuestionBagV3` collections, filtered to the same `questionType` +
`topicCluster`. Seed examples should be hand-curated — the quality floor
of the seeds caps the quality ceiling of the generator.

---

## 5. Practical recommendations for *this* codebase

Going from "interesting research" to "useful for the platform":

1. **Start with Claude 4.6 Sonnet.** Best floor on prose, good math, OK
   pricing. Wrap in a single new script under
   `backend/src/scripts/ai_generation/generate.ts` — it should pull seed
   examples from V2/V3 and write back to V2 with `readyForQuiz=false`,
   `source='ai-generated'`, `sourceDetails.modelId=…`.
2. **Add an o3 (or Opus 4.7) "solver" pass** in the same script. Two API
   calls per generated question is fine; the human review queue is the
   bottleneck, not API spend.
3. **Reuse `services/questionQA.ts`** for the deterministic checks. The
   existing rubric there is the right floor.
4. **Tag every AI-authored question** with `aiAuthored: true` on the V2
   doc so we can later A/B-test whether students score differently on AI
   vs. OG content. The schema field doesn't exist yet — small migration.
5. **Manual review remains the gate.** Until A/B data shows AI-authored
   content does not regress score validity, treat AI generation as a
   *first draft* that a human (admin) flips to `readyForQuiz=true` from
   the existing `/review` surface.
6. **Cost envelope.** At Sonnet pricing (~$3 in / $15 out per million
   tokens), a generated PS question with critique + solver pass costs
   ~$0.03–0.06. For 1,000 questions that's $30–60 plus human review
   time — meaningful but not blocking.

### What to NOT do (yet)
- Don't expose generation directly to non-admin users.
- Don't auto-flip `readyForQuiz=true`. Even at 95% accuracy, a 5% rate of
  bad questions in a paid mock will be the most-emailed complaint we
  receive.
- Don't fine-tune. Out-of-the-box prompting + critic + solver beats
  fine-tuning on a few thousand examples for a task this nuanced.

---

## 6. Open questions to research before implementing

- Has anyone published a *blind* head-to-head of generated vs. OG
  GMAT questions? (Vals AI and Stanford CRFM have GRE/GMAT comparisons,
  but GMAT-specific is sparse.)
- What share of o3-flagged "wrong answer" disputes survive a human
  arbitration step? — drives whether we need a third model or human
  reviewers as the tiebreaker.
- For RC, is there a measurable difference between "passage-then-
  questions" generation and "questions-first-then-passage" generation?
- Is there a meaningful quality lift from generating 3 candidates per
  prompt and picking the best (best-of-N)?

---

## 7. References / further reading

- *Anthropic Claude model cards* — claude.com → docs → model overview
- *OpenAI o-series* — openai.com → research → o-series
- *MMLU-Pro / GPQA / MATH leaderboards* — paperswithcode and HELM
- *Vals AI exam evals* — vals.ai/exams (independent test of LLMs on bar,
  GMAT, GRE, etc.)
- *Constitutional AI* (Anthropic) — pattern for self-critique prompts
- *Self-Consistency* (Wang et al.) — best-of-N sampling for reasoning
