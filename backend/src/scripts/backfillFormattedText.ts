/**
 * Backfill bold + highlight formatting into existing CR/RC docs.
 *
 * The original Python extractors used BeautifulSoup `get_text(strip=True)`
 * which discards inline `<span style="font-weight: bold">…</span>` and
 * `<span style="background-color: #FFFF00">…</span>` markup. The result is
 * that questions like CR 77 (the Hunter / Greenrock boldface item) lost the
 * boldface portion, even though the source HTML on disk still has it.
 *
 * Strategy (non-destructive — *augments* existing text):
 *   1. Read each saved CR/RC HTML file under backend/exports/html_*.
 *   2. Pull out the question content node (`.item.text` for CR, `.reading-passage`
 *      for RC) and harvest the bold and highlight text fragments.
 *   3. Match the doc in the DB by questionNumber (filename `cr_77.html` →
 *      questionNumber 77) for CR, or by `rcNumber` for RC.
 *   4. In the DB doc's existing plain `passageText` and `questionText`, wrap
 *      each fragment's first occurrence with `<b>…</b>` or `<mark>…</mark>`.
 *   5. Save only the changed fields. If nothing matched, log and skip.
 *
 * Usage:
 *   cd backend
 *   npm run backfill-formatting              # dry-run, no DB writes
 *   npm run backfill-formatting -- --commit  # actually update the DB
 *   npm run backfill-formatting -- --commit --only=cr_ogquestions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { QuestionBagV2 } from '../models/QuestionBagV2';
import { QuestionBagV3 } from '../models/QuestionBagV3';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz';
const EXPORTS_DIR = path.resolve(__dirname, '..', '..', 'exports');

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const ONLY = args.find((a) => a.startsWith('--only='))?.split('=')[1];

interface FormatHits {
  bold: string[];
  highlight: string[];
}

const isBoldSpan = (style: string | undefined): boolean =>
  !!style && /font-weight\s*:\s*bold/i.test(style);

const isHighlightSpan = (style: string | undefined): boolean =>
  !!style && /background-color\s*:\s*(?:#FFFF00|yellow|#ff0|rgb\(\s*255\s*,\s*255\s*,\s*0)/i.test(style);

// `$` and `root` are intentionally untyped: the installed @types/cheerio is
// 0.22 (pre-1.0) and conflicts with cheerio 1.0's own bundled types. Using
// `any` here matches how extractQuestionsFromLinks.ts handles cheerio.
const collectFormatHits = ($: any, root: any): FormatHits => {
  const bold: string[] = [];
  const highlight: string[] = [];

  root.find('b, strong, span').each((_i: number, el: any) => {
    const tag = (el.tagName || '').toLowerCase();
    const text = $(el).text().trim();
    if (!text) return;

    if (tag === 'b' || tag === 'strong') {
      bold.push(text);
    } else if (tag === 'span') {
      const style = $(el).attr('style');
      if (isBoldSpan(style)) bold.push(text);
      else if (isHighlightSpan(style)) highlight.push(text);
    }
  });

  return {
    bold: Array.from(new Set(bold)).filter((s) => s.length >= 2),
    highlight: Array.from(new Set(highlight)).filter((s) => s.length >= 2),
  };
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Normalize curly quotes, em/en-dashes, NBSPs, and whitespace runs so we
 *  can compare HTML-extracted text against Mistral-normalized DB text. */
const normalizeForMatch = (s: string): string =>
  s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Wrap the first occurrence of `fragment` in `text` with the tag.
 * Returns the new text and whether a substitution actually happened.
 * Idempotent: skips if already wrapped. Tolerant of curly-quote /
 * dash / whitespace differences between the source HTML and the DB.
 */
const wrapFirst = (text: string, fragment: string, tag: 'b' | 'mark'): { text: string; hit: boolean } => {
  if (!fragment) return { text, hit: false };
  const wrappedRe = new RegExp(`<${tag}[^>]*>\\s*${escapeRegExp(fragment)}\\s*</${tag}>`, 'i');
  if (wrappedRe.test(text)) return { text, hit: false };

  // Fast path: exact match.
  const idx = text.indexOf(fragment);
  if (idx >= 0) {
    return {
      text: `${text.slice(0, idx)}<${tag}>${fragment}</${tag}>${text.slice(idx + fragment.length)}`,
      hit: true,
    };
  }

  // Fuzzy path: normalize both sides and find the matching slice in the
  // original text. We iterate character-by-character building a normalized
  // window so we can recover the original substring boundary.
  const target = normalizeForMatch(fragment);
  if (target.length < 3) return { text, hit: false };

  // Build a normalized version of `text` along with an index map so we can
  // translate normalized positions back to original positions.
  const map: number[] = [];
  let normalized = '';
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    let ch = text[i];
    const code = ch.charCodeAt(0);
    if (code === 0x2018 || code === 0x2019 || code === 0x02BC) ch = "'";
    else if (code === 0x201C || code === 0x201D) ch = '"';
    else if (code === 0x2013 || code === 0x2014) ch = '-';
    else if (code === 0x00A0) ch = ' ';

    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      ch = ' ';
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }
    normalized += ch;
    map.push(i);
  }
  const normTrimmed = normalized.replace(/^ +/, '');
  // Adjust map for any leading-space trim.
  const trimOffset = normalized.length - normTrimmed.length;
  const idxInNorm = normTrimmed.indexOf(target);
  if (idxInNorm < 0) return { text, hit: false };

  const startOrig = map[idxInNorm + trimOffset];
  const endNormPos = idxInNorm + trimOffset + target.length - 1;
  const endOrig = map[endNormPos] + 1;
  if (startOrig === undefined || endOrig === undefined) return { text, hit: false };

  const matchedSlice = text.slice(startOrig, endOrig);
  return {
    text: `${text.slice(0, startOrig)}<${tag}>${matchedSlice}</${tag}>${text.slice(endOrig)}`,
    hit: true,
  };
};

interface BackfillCounts {
  filesScanned: number;
  filesWithFormat: number;
  docsMatched: number;
  docsUpdated: number;
  fragmentsApplied: number;
  fragmentsMissed: number;
  unmatchedFiles: string[];
}

const cnt: BackfillCounts = {
  filesScanned: 0,
  filesWithFormat: 0,
  docsMatched: 0,
  docsUpdated: 0,
  fragmentsApplied: 0,
  fragmentsMissed: 0,
  unmatchedFiles: [],
};

const processCRFile = async (filePath: string) => {
  const fileName = path.basename(filePath);
  // Three naming patterns observed: cr_NNN.html, cr_gmatprep_NNN.html,
  // cr_exampacks_NNN.html. The trailing digit is the question number.
  const m = fileName.match(/^cr_(?:[a-z]+_)?(\d+)\.html$/);
  if (!m) return;
  const qNumber = parseInt(m[1], 10);
  cnt.filesScanned++;

  const html = await fs.readFile(filePath, 'utf-8');
  const $: any = cheerio.load(html);
  const node = $('.item.text').first();
  if (node.length === 0) return;

  const hits = collectFormatHits($, node);
  if (hits.bold.length === 0 && hits.highlight.length === 0) return;
  cnt.filesWithFormat++;

  // Match by source URL — `questionNumber` is not unique in the CR collection
  // (the Mistral importer reuses the same number across docs), but every doc
  // has a unique gmatclub forum URL stored in `sourceDetails.url`, which the
  // saved HTML carries in `.source-url a`.
  const sourceUrl = ($('.source-url a').attr('href') || '').trim();

  let doc: any = null;
  if (sourceUrl) {
    doc =
      (await QuestionBagV2.findOne({ questionType: 'Critical Reasoning', 'sourceDetails.url': sourceUrl })) ||
      (await QuestionBagV3.findOne({ questionType: 'CR', 'sourceDetails.url': sourceUrl }));
  }
  // Fallback by questionNumber (safe for V3 where it tends to be unique).
  if (!doc) {
    doc =
      (await QuestionBagV2.findOne({ questionType: 'Critical Reasoning', questionNumber: qNumber })) ||
      (await QuestionBagV3.findOne({ questionType: 'CR', questionNumber: qNumber }));
  }

  if (!doc) {
    cnt.unmatchedFiles.push(fileName);
    return;
  }
  cnt.docsMatched++;

  let passage = doc.passageText || '';
  let questionText = doc.questionText || '';
  let changed = false;

  // CR: bold portion typically lives inside the argument (passageText), but
  // sometimes also inside the question stem ("the portion in <b>boldface</b>").
  for (const fragment of hits.bold) {
    const inPassage = wrapFirst(passage, fragment, 'b');
    if (inPassage.hit) {
      passage = inPassage.text;
      cnt.fragmentsApplied++;
      changed = true;
      continue;
    }
    const inQuestion = wrapFirst(questionText, fragment, 'b');
    if (inQuestion.hit) {
      questionText = inQuestion.text;
      cnt.fragmentsApplied++;
      changed = true;
    } else {
      cnt.fragmentsMissed++;
    }
  }
  // CR rarely uses highlight, but apply if present.
  for (const fragment of hits.highlight) {
    const inPassage = wrapFirst(passage, fragment, 'mark');
    if (inPassage.hit) {
      passage = inPassage.text;
      cnt.fragmentsApplied++;
      changed = true;
    } else {
      cnt.fragmentsMissed++;
    }
  }

  if (changed) {
    cnt.docsUpdated++;
    if (COMMIT) {
      doc.passageText = passage;
      doc.questionText = questionText;
      // See RC branch: skip full-doc validation to tolerate pre-existing
      // schema drift on fields we're not touching.
      await doc.save({ validateBeforeSave: false });
    } else {
      console.log(`[dry-run] CR #${qNumber}: bold=${hits.bold.length} highlight=${hits.highlight.length}`);
    }
  }
};

const processRCFile = async (filePath: string) => {
  const fileName = path.basename(filePath);
  // RC files come as `rc_NNN.html` (whole passage) or `rc_NNN_M.html` (per-Q
  // shards). The passage text is the same across shards for one rcNumber, so
  // we only act on the rc_NNN.html form.
  const m = fileName.match(/^rc_(\d+)\.html$/);
  if (!m) return;
  const rcNumber = m[1];
  cnt.filesScanned++;

  const html = await fs.readFile(filePath, 'utf-8');
  const $: any = cheerio.load(html);
  const node = $('.reading-passage, .reading.passage').first();
  if (node.length === 0) return;

  const hits = collectFormatHits($, node);
  if (hits.bold.length === 0 && hits.highlight.length === 0) return;
  cnt.filesWithFormat++;

  // RC docs: every question in the passage carries the same passageText, so
  // we update each one. Match by rcNumber across V2 and V3.
  const v2Docs = await QuestionBagV2.find({ questionType: 'Reading Comprehension', rcNumber });
  const v3Docs = await QuestionBagV3.find({ questionType: 'RC', rcNumber });
  const docs: any[] = [...v2Docs, ...v3Docs];

  if (docs.length === 0) {
    cnt.unmatchedFiles.push(fileName);
    return;
  }
  cnt.docsMatched += docs.length;

  for (const doc of docs) {
    let passage = doc.passageText || '';
    let changed = false;
    for (const fragment of hits.bold) {
      const next = wrapFirst(passage, fragment, 'b');
      if (next.hit) {
        passage = next.text;
        cnt.fragmentsApplied++;
        changed = true;
      } else {
        cnt.fragmentsMissed++;
      }
    }
    for (const fragment of hits.highlight) {
      const next = wrapFirst(passage, fragment, 'mark');
      if (next.hit) {
        passage = next.text;
        cnt.fragmentsApplied++;
        changed = true;
      } else {
        cnt.fragmentsMissed++;
      }
    }
    if (changed) {
      cnt.docsUpdated++;
      if (COMMIT) {
        doc.passageText = passage;
        // Skip full-doc validation: some pre-existing docs have legacy
        // values (e.g. validationStatus=null) that fail the current schema
        // enum even though we're not touching those fields.
        await doc.save({ validateBeforeSave: false });
      } else {
        console.log(`[dry-run] RC ${rcNumber} (doc ${doc._id}): updated passage`);
      }
    }
  }
};

const walkDir = async (dir: string, onFile: (full: string) => Promise<void>) => {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) await walkDir(full, onFile);
    else if (entry.endsWith('.html')) await onFile(full);
  }
};

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB. Mode: ${COMMIT ? 'COMMIT' : 'dry-run'}`);
  console.log('=================================================');

  const crDirs = ['html_cr_ogquestions', 'html_cr_gmatprep', 'html_cr_exampacks'];
  const rcDirs = ['html_rc_ogquestions', 'html_rc_gmatprep', 'html_rc_exampacks'];

  for (const dir of crDirs) {
    if (ONLY && !dir.includes(ONLY)) continue;
    console.log(`\nProcessing CR dir: ${dir}`);
    await walkDir(path.join(EXPORTS_DIR, dir), processCRFile);
  }
  for (const dir of rcDirs) {
    if (ONLY && !dir.includes(ONLY)) continue;
    console.log(`\nProcessing RC dir: ${dir}`);
    await walkDir(path.join(EXPORTS_DIR, dir), processRCFile);
  }

  console.log('\n=================================================');
  console.log('SUMMARY');
  console.log('=================================================');
  console.log(`Files scanned:           ${cnt.filesScanned}`);
  console.log(`Files with bold/highlight: ${cnt.filesWithFormat}`);
  console.log(`DB docs matched:         ${cnt.docsMatched}`);
  console.log(`DB docs updated:         ${cnt.docsUpdated}`);
  console.log(`Fragments applied:       ${cnt.fragmentsApplied}`);
  console.log(`Fragments not found:     ${cnt.fragmentsMissed}`);
  console.log(`Unmatched files:         ${cnt.unmatchedFiles.length}`);
  if (cnt.unmatchedFiles.length > 0 && cnt.unmatchedFiles.length <= 25) {
    console.log(`  ${cnt.unmatchedFiles.join('\n  ')}`);
  } else if (cnt.unmatchedFiles.length > 25) {
    console.log(`  (showing first 25)\n  ${cnt.unmatchedFiles.slice(0, 25).join('\n  ')}`);
  }

  if (!COMMIT) {
    console.log('\nThis was a dry-run. Re-run with --commit to write changes.');
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
