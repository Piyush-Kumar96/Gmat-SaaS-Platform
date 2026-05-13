/**
 * RC Migration Report
 *
 * Compares Reading Comprehension content in QuestionBagV2 (long-form
 * `'Reading Comprehension'`, grouped by `rcNumber`) against QuestionBagV3
 * (short-form `'RC'`, grouped by `passageId`) and prints a backlog of
 * V2-only passages that still need to be migrated.
 *
 * Run: cd backend && npx ts-node src/scripts/rcMigrationReport.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { QuestionBagV2 } from '../models/QuestionBagV2';
import { QuestionBagV3 } from '../models/QuestionBagV3';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz';

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log('================================================');
  console.log('RC MIGRATION REPORT');
  console.log('================================================');

  // V2 RC stats
  const v2Total = await QuestionBagV2.countDocuments({ questionType: 'Reading Comprehension' });
  const v2WithPassage = await QuestionBagV2.countDocuments({
    questionType: 'Reading Comprehension',
    passageText: { $exists: true, $ne: '' }
  });
  const v2WithRcNumber = await QuestionBagV2.countDocuments({
    questionType: 'Reading Comprehension',
    rcNumber: { $exists: true, $ne: null }
  });
  const v2Passages: { _id: string; count: number }[] = await QuestionBagV2.aggregate([
    { $match: { questionType: 'Reading Comprehension', rcNumber: { $exists: true, $ne: null } } },
    { $group: { _id: '$rcNumber', count: { $sum: 1 } } }
  ]);

  console.log('\n--- V2 (long-form "Reading Comprehension") ---');
  console.log(`  Total questions:        ${v2Total}`);
  console.log(`  With passageText:       ${v2WithPassage}`);
  console.log(`  With rcNumber:          ${v2WithRcNumber}`);
  console.log(`  Distinct passages:      ${v2Passages.length}`);
  if (v2Passages.length > 0) {
    const distribution = v2Passages.reduce((acc: Record<number, number>, p) => {
      acc[p.count] = (acc[p.count] || 0) + 1;
      return acc;
    }, {});
    console.log(`  Questions-per-passage:`);
    Object.entries(distribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([q, n]) => console.log(`    ${q}-Q passages: ${n}`));
  }

  // V3 RC stats
  const v3Total = await QuestionBagV3.countDocuments({ questionType: 'RC' });
  const v3WithPassage = await QuestionBagV3.countDocuments({
    questionType: 'RC',
    passageText: { $exists: true, $ne: '' }
  });
  const v3WithPassageId = await QuestionBagV3.countDocuments({
    questionType: 'RC',
    passageId: { $exists: true, $ne: null }
  });
  const v3Passages: { _id: string; count: number }[] = await QuestionBagV3.aggregate([
    { $match: { questionType: 'RC', passageId: { $exists: true, $ne: null } } },
    { $group: { _id: '$passageId', count: { $sum: 1 } } }
  ]);

  console.log('\n--- V3 (short-form "RC") ---');
  console.log(`  Total questions:        ${v3Total}`);
  console.log(`  With passageText:       ${v3WithPassage}`);
  console.log(`  With passageId:         ${v3WithPassageId}`);
  console.log(`  Distinct passages:      ${v3Passages.length}`);

  // Migration backlog: V2 passages whose rcNumber doesn't appear as a V3 passageId
  const v3PassageIds = new Set(v3Passages.map((p) => String(p._id)));
  const backlog = v2Passages.filter((p) => !v3PassageIds.has(String(p._id)));
  const backlogQuestions = backlog.reduce((sum, p) => sum + p.count, 0);

  console.log('\n--- MIGRATION BACKLOG ---');
  console.log(`  V2-only passages:       ${backlog.length}`);
  console.log(`  V2-only questions:      ${backlogQuestions}`);
  console.log('  (These rcNumbers exist in V2 but no matching passageId in V3.');
  console.log('   Front-end now reads RC from V3 only, so these are not served.)');

  if (backlog.length > 0) {
    console.log('\n  First 20 backlog rcNumbers:');
    backlog.slice(0, 20).forEach((p) => {
      console.log(`    ${p._id}  →  ${p.count} questions`);
    });
    if (backlog.length > 20) {
      console.log(`    ...and ${backlog.length - 20} more.`);
    }
  }

  console.log('\n================================================');
  console.log('Next step: re-run V3 RC extraction for the backlog.');
  console.log('  See: backend/src/scripts/v3_extraction/extract_rc_questions.py');
  console.log('================================================');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('RC migration report failed:', err);
  process.exit(1);
});
