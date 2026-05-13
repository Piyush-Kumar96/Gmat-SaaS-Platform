/**
 * Strip leading question-number / RC-tag prefixes from RC questionText.
 *
 * Patterns (applied in order, idempotently — safe to re-run):
 *   1. RC tag prefix: ^\s*RC\d+(?:-\d+)?(?:\s+\d{1,3}\.)?\s+
 *        "RC00120-02 3. The author ..."  -> "The author ..."
 *        "RC0001 The author ..."         -> "The author ..."
 *        "RC0001 5. The author ..."      -> "The author ..."
 *   2. Simple numeric prefix: ^\s*\d{1,3}\.\s+
 *        "4. The author mentions ..."    -> "The author mentions ..."
 *
 * Skipped (left untouched, surfaced for later passes):
 *     "showspoiler... 4. The author ..."
 *     "Q.4 The author ..."
 *
 * Run: cd backend && npx ts-node src/scripts/stripRCQuestionNumberPrefix.ts          # dry-run
 *      cd backend && npx ts-node src/scripts/stripRCQuestionNumberPrefix.ts --apply  # write
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { QuestionBagV2 } from '../models/QuestionBagV2';
import { QuestionBagV3 } from '../models/QuestionBagV3';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz';
const APPLY = process.argv.includes('--apply');

// RC-tag prefix swallows an optional inline question number ("3.", "1)") since
// that always co-occurs and is also redundant with the quiz pager.
const RC_TAG_PREFIX = /^\s*RC\d+(?:-\d+)?(?:\s+\d{1,3}[.)])?\s+/i;
const NUMERIC_PREFIX = /^\s*\d{1,3}\.\s+/;
// Used only as a secondary cleanup after the RC tag is stripped — accepts
// both "3." and "3)" because both patterns are seen in the data. Kept
// internal so the standalone numeric pass stays strict (only "3.").
const TRAILING_QNUM = /^\s*\d{1,3}[.)]\s+/;

function clean(text: string): { cleaned: string; matchedPattern: 'rc-tag' | 'numeric' | null } {
  if (RC_TAG_PREFIX.test(text)) {
    let next = text.replace(RC_TAG_PREFIX, '');
    if (TRAILING_QNUM.test(next)) next = next.replace(TRAILING_QNUM, '');
    return { cleaned: next, matchedPattern: 'rc-tag' };
  }
  if (NUMERIC_PREFIX.test(text)) {
    return { cleaned: text.replace(NUMERIC_PREFIX, ''), matchedPattern: 'numeric' };
  }
  return { cleaned: text, matchedPattern: null };
}

interface CollectionResult {
  label: string;
  scanned: number;
  matchedRcTag: number;
  matchedNumeric: number;
  updated: number;
  samples: { id: string; pattern: string; before: string; after: string }[];
}

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB. Mode: ${APPLY ? 'APPLY (writing)' : 'DRY-RUN'}\n`);

  const results: CollectionResult[] = [];

  // V2 — long-form 'Reading Comprehension'
  {
    const r: CollectionResult = { label: 'V2 (Reading Comprehension)', scanned: 0, matchedRcTag: 0, matchedNumeric: 0, updated: 0, samples: [] };
    const docs = await QuestionBagV2.find(
      { questionType: 'Reading Comprehension' },
      { questionText: 1 },
    ).lean();
    for (const doc of docs) {
      r.scanned += 1;
      const text: string = (doc.questionText as string) || '';
      const { cleaned, matchedPattern } = clean(text);
      if (!matchedPattern || !cleaned || cleaned === text) continue;
      if (matchedPattern === 'rc-tag') r.matchedRcTag += 1;
      else r.matchedNumeric += 1;
      if (r.samples.length < 8) {
        r.samples.push({ id: String(doc._id), pattern: matchedPattern, before: text.slice(0, 140), after: cleaned.slice(0, 140) });
      }
      if (APPLY) {
        await QuestionBagV2.updateOne({ _id: doc._id }, { $set: { questionText: cleaned } });
        r.updated += 1;
      }
    }
    results.push(r);
  }

  // V3 — short-form 'RC'
  {
    const r: CollectionResult = { label: 'V3 (RC)', scanned: 0, matchedRcTag: 0, matchedNumeric: 0, updated: 0, samples: [] };
    const docs = await QuestionBagV3.find(
      { questionType: 'RC' },
      { questionText: 1 },
    ).lean();
    for (const doc of docs) {
      r.scanned += 1;
      const text: string = (doc.questionText as string) || '';
      const { cleaned, matchedPattern } = clean(text);
      if (!matchedPattern || !cleaned || cleaned === text) continue;
      if (matchedPattern === 'rc-tag') r.matchedRcTag += 1;
      else r.matchedNumeric += 1;
      if (r.samples.length < 8) {
        r.samples.push({ id: String(doc._id), pattern: matchedPattern, before: text.slice(0, 140), after: cleaned.slice(0, 140) });
      }
      if (APPLY) {
        await QuestionBagV3.updateOne({ _id: doc._id }, { $set: { questionText: cleaned } });
        r.updated += 1;
      }
    }
    results.push(r);
  }

  for (const r of results) {
    console.log(`--- ${r.label} ---`);
    console.log(`  scanned: ${r.scanned}`);
    console.log(`  RC-tag prefix matches: ${r.matchedRcTag}`);
    console.log(`  numeric prefix matches: ${r.matchedNumeric}`);
    if (APPLY) console.log(`  updated: ${r.updated}`);
    if (r.samples.length) {
      console.log('  samples:');
      for (const s of r.samples) {
        console.log(`    [${s.id}] (${s.pattern})`);
        console.log(`      before: ${s.before}`);
        console.log(`      after:  ${s.after}`);
      }
    }
    console.log();
  }

  const matchedRc = results.reduce((acc, r) => acc + r.matchedRcTag, 0);
  const matchedNum = results.reduce((acc, r) => acc + r.matchedNumeric, 0);
  const updated = results.reduce((acc, r) => acc + r.updated, 0);
  console.log('================================================');
  console.log(`RC-tag prefix matches:  ${matchedRc}`);
  console.log(`Numeric prefix matches: ${matchedNum}`);
  console.log(`Total prefix matches:   ${matchedRc + matchedNum}`);
  if (APPLY) console.log(`Total updated:          ${updated}`);
  else console.log('(dry-run — re-run with --apply to write)');

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
