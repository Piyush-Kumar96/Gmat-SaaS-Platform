# `context/` — Architecture reference

Short orientation docs for anyone (human or AI) reading this codebase for the first time. Code-level details live in the `.ts` source; these docs orient you on the bigger picture.

## Read order

1. **[OVERVIEW.md](./OVERVIEW.md)** — tech stack, repo layout, dev commands.
2. **[MODULES.md](./MODULES.md)** — application surfaces: home, config, quiz, results, review, admin, payments. File-level pointers.
3. **[QUESTION_DATA_MODEL.md](./QUESTION_DATA_MODEL.md)** — `QuestionBag` v1/v2/v3 Mongoose schemas with examples for every supported question type.

## How to use this directory

- These docs describe **architecture and code structure**, not product strategy.
- If you find anything stale, **edit the doc in place** rather than relying on conversation memory.
- Code-level details (function signatures, exact field names) are in the `.ts` source. These docs orient you; the source is authoritative for runtime behaviour.

## Conventions

- File paths are repo-relative and clickable in markdown: `backend/src/models/QuestionBagV3.ts`.
- When introducing a new question type, update `QUESTION_DATA_MODEL.md` and `MODULES.md` together.
