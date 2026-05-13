/**
 * tagSimilarity.ts — LLM tagging script for similarity / "more like this"
 *
 * STATUS: SCAFFOLD ONLY. Do not run yet.
 *
 * Why this exists:
 *   The QuestionBagV2 / QuestionBagV3 schemas now carry `skillTags`,
 *   `topicCluster`, and `difficultyBand`. These are the keys the future
 *   "Practice similar questions" endpoint will look up. None are populated
 *   yet — the user wants to define the tagging strategy (taxonomy, prompt,
 *   cost cap) before any LLM run.
 *
 * What's intentionally missing:
 *   - The taxonomy of `topicCluster` values. Pinned in backlog.md ("LLM-driven
 *     similarity backfill"). Likely a closed enum the LLM is forced to pick
 *     from rather than free-form strings.
 *   - The prompt itself. The skeleton below sends a placeholder prompt that
 *     should NOT be shipped to OpenAI as-is.
 *   - Cost guard. A real run wants `--limit`, `--dryRun`, and a per-batch
 *     resume marker so a half-finished run can pick up.
 *
 * Run shape (when ready):
 *   ts-node src/scripts/tagSimilarity.ts \
 *     --collection v3 \
 *     --questionType "Critical Reasoning" \
 *     --limit 50 \
 *     --dryRun
 *
 * Concurrency:
 *   Tag in batches of N (e.g. 10) to amortise API latency. Stay under the
 *   user's OpenAI rate limit. The script does NOT mutate questions on
 *   `--dryRun`; it logs what it would write.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { QuestionBagV2 } from '../models/QuestionBagV2';
import { QuestionBagV3 } from '../models/QuestionBagV3';
// Intentionally not importing the OpenAI service yet — the prompt + taxonomy
// have to be agreed on first. Use a stub `tagOne` to mark the integration
// point.

interface TagResult {
  skillTags: string[];
  topicCluster: string;
  difficultyBand: '500-600' | '600-700' | '700-800';
}

interface TagJobOptions {
  collection: 'v2' | 'v3';
  questionType?: string;
  limit?: number;
  dryRun: boolean;
}

const parseArgs = (argv: string[]): TagJobOptions => {
  const args: TagJobOptions = { collection: 'v3', dryRun: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--collection') args.collection = (argv[++i] as 'v2' | 'v3');
    else if (a === '--questionType') args.questionType = argv[++i];
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--dryRun') args.dryRun = true;
    else if (a === '--apply') args.dryRun = false;
  }
  return args;
};

/**
 * Stub LLM call. Replace with real OpenAI call once the taxonomy + prompt
 * are agreed. Returning a placeholder lets the rest of the pipeline
 * compile and run end-to-end on `--dryRun` without spending tokens.
 */
const tagOne = async (_question: any): Promise<TagResult> => {
  throw new Error(
    'tagSimilarity: LLM call not implemented. Define the taxonomy in ' +
    'context/QUESTION_DATA_MODEL.md and wire openaiService here before running.'
  );
};

const fetchBatch = async (opts: TagJobOptions): Promise<any[]> => {
  const Model = opts.collection === 'v2' ? QuestionBagV2 : QuestionBagV3;
  // Untagged docs only — assume topicCluster being unset is the canonical
  // "not yet tagged" signal.
  const filter: any = { $or: [{ topicCluster: { $exists: false } }, { topicCluster: null }, { topicCluster: '' }] };
  if (opts.questionType) filter.questionType = opts.questionType;
  return (Model as any).find(filter).limit(opts.limit ?? 50).lean();
};

const writeBack = async (
  collection: 'v2' | 'v3',
  questionId: string,
  tags: TagResult
): Promise<void> => {
  const Model = collection === 'v2' ? QuestionBagV2 : QuestionBagV3;
  await (Model as any).findByIdAndUpdate(questionId, {
    skillTags: tags.skillTags,
    topicCluster: tags.topicCluster,
    difficultyBand: tags.difficultyBand,
  });
};

const main = async (): Promise<void> => {
  const opts = parseArgs(process.argv);
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(mongoUri);

  const docs = await fetchBatch(opts);
  console.log(`[tagSimilarity] ${opts.dryRun ? 'DRY' : 'APPLY'} — ${docs.length} candidate(s) in ${opts.collection.toUpperCase()}`);

  let succeeded = 0;
  let failed = 0;
  for (const d of docs) {
    try {
      const tags = await tagOne(d);
      console.log(` - ${d._id}: ${tags.topicCluster} / ${tags.difficultyBand} / [${tags.skillTags.join(', ')}]`);
      if (!opts.dryRun) await writeBack(opts.collection, String(d._id), tags);
      succeeded += 1;
    } catch (err: any) {
      failed += 1;
      console.error(` ! ${d._id}: ${err?.message || err}`);
      if (failed >= 3) {
        console.error('[tagSimilarity] aborting — 3 consecutive failures');
        break;
      }
    }
  }

  console.log(`[tagSimilarity] done. ok=${succeeded} fail=${failed} ${opts.dryRun ? '(dry-run, nothing written)' : ''}`);
  await mongoose.disconnect();
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
