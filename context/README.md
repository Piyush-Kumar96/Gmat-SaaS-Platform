# `context/` — AI / LLM Onboarding for GMAT Quiz Platform

This directory is the **fast-path context bundle** for any AI assistant (Claude, agents, copilots) working on this repo. Read these in order on a cold start so you can begin contributing without re-deriving everything from the codebase.

## Read order

1. **[OVERVIEW.md](./OVERVIEW.md)** — what this product is, tech stack, repo layout, dev commands.
2. **[GMAT_EXAM.md](./GMAT_EXAM.md)** — domain knowledge: GMAT Focus Edition, sections, every question type, scoring conventions.
3. **[USERS.md](./USERS.md)** — personas: end users (free / paid), admin, question-bank editor.
4. **[MODULES.md](./MODULES.md)** — application surfaces: home, config, quiz, results, review, admin, payments. File-level pointers.
5. **[QUESTION_DATA_MODEL.md](./QUESTION_DATA_MODEL.md)** — `QuestionBag` v1/v2/v3 schemas with examples for every question type, including DI sub-shapes.
6. **[QUESTION_SOURCING.md](./QUESTION_SOURCING.md)** — primary sources, extraction pipelines, what works / doesn't, ongoing log of findings.

## How to use this directory

- These docs are **the canonical context**. If you find anything stale, **edit the doc in place** rather than relying on conversation memory.
- `QUESTION_SOURCING.md` is a **living log** — append new findings under the dated sections.
- Code-level details (function signatures, exact field names) are also in the `.ts` source. These docs orient you; the source is authoritative for runtime behaviour.

## Conventions

- Every doc has a 1-line purpose at the top, followed by a short TOC if it spans more than ~150 lines.
- File paths are repo-relative and clickable in markdown: `backend/src/models/QuestionBagV3.ts`.
- When introducing a new question type, update `GMAT_EXAM.md`, `QUESTION_DATA_MODEL.md`, and `MODULES.md` together.
