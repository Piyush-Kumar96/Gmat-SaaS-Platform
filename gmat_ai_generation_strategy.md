# Advanced AI GMAT Question Generation Strategy 2.0

## 🚨 Flaws in the Current Strategy (The Claude Approach)
The previous strategy outlined in `AI_QUESTION_GENERATION.md` relied heavily on a "Zero-to-One" generation model (Prompt -> Generate -> Critique -> Solve). While logical, this approach has three fatal flaws for standardized tests:
1. **The "Blank Canvas" Problem:** LLMs are terrible at inventing novel, airtight logical puzzles from scratch. They tend to write questions that are structurally sound but mathematically trivial or logically boring.
2. **Weak Distractors:** If you ask an LLM to generate 4 wrong answers, it usually generates random numbers or logically absurd statements. GMAT distractors are not random; they are the exact answers you get when you make a specific, predictable human error.
3. **Context Collapse:** Generating the question, correct answer, and traps all in one single API call overwhelms the model's attention, leading to grammatical leakage or statements in Data Sufficiency that give away the answer.

---

## 🚀 The New Strategy: Evol-Instruct + Persona Validation
To build a system capable of generating 700+ level questions, we must stop asking the AI to "invent" and start asking it to **"mutate and trap."** 

This strategy uses a **Multi-Agent Pipeline** breaking the generation down into specialized, isolated tasks.

### Phase 1: Seed Mutation (Evol-Instruct)
Instead of few-shot generation from scratch, we use **Mutation**.
1. **Retrieve a Seed:** Query your Vector DB (Qdrant) or MongoDB for a highly-rated, verified GMAT question (the "Seed").
2. **The Mutator Prompt (Claude 3.5 Sonnet):**
   * *Prompt:* "Here is a valid GMAT Data Sufficiency question. Extract the underlying logical trap (e.g., 'Student forgets that x can be a negative fraction'). Now, write a completely new question with a different real-world scenario and different numbers that relies on this EXACT same logical trap."
3. **Why this works:** It guarantees the logical rigor of the question because it inherits the structural DNA of an official question, ensuring it isn't trivial.

### Phase 2: Persona-Based Distractor Generation
This is the secret weapon for 700+ level questions. Do not ask the LLM to write "wrong options."
1. **The 'Flawed Student' Agent (Claude Haiku or GPT-4o-mini):** 
   * Feed the newly generated question stem to a cheaper, faster model.
   * *Prompt:* "You are a student taking the GMAT. Solve this problem, but make [Error A: e.g., forget to convert minutes to hours]. What is your final answer?"
   * Repeat this for Error B (Calculation error) and Error C (Misread the constraint).
2. **The Distractor Assembler:** Take the outputs of the "Flawed Student" agent and use them as options A, B, C, and D. 
3. **Why this works:** Every single wrong answer is now a mathematically plausible "trap" that a real human would fall for, exactly matching the psychological design of the real GMAT.

### Phase 3: The Blind Solver (OpenAI o3)
1. **The Validator Agent (OpenAI o3):**
   * Pass the completed question (Stem + 5 Options) to the reasoning model.
   * *Crucial:* Do NOT tell the model what the correct answer is.
   * *Prompt:* "Solve this GMAT question step-by-step and select the correct option A-E. If multiple options are correct, or if no option is correct, output 'ERROR'."
2. **The Gatekeeper Logic:**
   * If `o3_answer == true_answer` -> Push to `QuestionBagV2` (Status: Pending Human Review).
   * If `o3_answer != true_answer` -> Discard. The question is structurally broken or poorly worded.

---

## 🛠 Implementation Plan for `gmat-quiz-2-main`

To implement this without burning massive API costs, build the pipeline as asynchronous jobs (e.g., using BullMQ or standard background workers in Node.js).

### 1. Database Schema Updates
Add the following tracking fields to your `QuestionBagV2` schema:
```json
{
  "generation_method": "evol_instruct_v2",
  "seed_question_id": "mongo_id_of_original",
  "validation_model": "o3",
  "o3_confidence_score": 0.98,
  "trap_metadata": {
    "trap_type": "negative_fraction",
    "distractor_b_error": "failed_unit_conversion"
  }
}
```

### 2. The Cost Envelope
Because we use cheaper models for the "Flawed Student" generation, the cost per question drops significantly.
* **Mutator (Sonnet):** ~$0.01
* **Flawed Student Distractors (Haiku x3):** ~$0.005
* **Validator (o3):** ~$0.02
* **Total Cost per High-Quality Question:** **~$0.035** (Massively scalable).

### 3. Next Steps for You
If you agree with this architectural shift, we can begin writing the `generate_mutated_question.ts` script in your backend directory to establish this 3-agent pipeline.
