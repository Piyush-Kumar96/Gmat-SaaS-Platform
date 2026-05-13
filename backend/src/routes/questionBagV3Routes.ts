import express from 'express';
import mongoose from 'mongoose';
import { QuestionBagV3 } from '../models/QuestionBagV3';
import { User } from '../models/User';
import { AskedQuestion } from '../models/AskedQuestion';
import { authenticateToken, requirePaidUser, checkMockTestLimit, AuthRequest } from '../middleware/roleAuth';
import { featureFlags } from '../config/featureFlags';
import { filterValidQuestions } from '../services/questionQA';
import { tenantScope, TenancyMissingAccountError } from '../services/tenancy';

const router = express.Router();

/**
 * Transform QuestionBagV3 document to format expected by frontend
 */
const transformQuestionForFrontend = (question: any) => {
  const doc = question.toObject ? question.toObject() : question;

  // Convert options object to array format for frontend compatibility
  const transformedQuestion = {
    ...doc,
    options: Object.entries(doc.options || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, text]) => text)
  };

  return transformedQuestion;
};

// Get all DI questions with pagination - Admin only
router.get('/', authenticateToken, requirePaidUser, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Apply filters if provided
    const filter: any = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.questionType) filter.questionType = req.query.questionType;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;
    // Ready-for-quiz tri-state mirrors the V2 endpoint. See comment there.
    const orClauses: any[] = [];
    if (req.query.readyForQuiz === 'ready') {
      filter.readyForQuiz = true;
    } else if (req.query.readyForQuiz === 'notReady') {
      orClauses.push({ $or: [{ readyForQuiz: false }, { readyForQuiz: { $exists: false } }] });
    }
    if (req.query.search) {
      const term = String(req.query.search).trim();
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = { $regex: escaped, $options: 'i' };
        orClauses.push({
          $or: [
            { questionText: rx },
            { passageText: rx },
          ],
        });
      }
    }
    if (orClauses.length === 1) {
      Object.assign(filter, orClauses[0]);
    } else if (orClauses.length > 1) {
      filter.$and = orClauses;
    }

    console.log('Fetching V3 questions with filter:', filter);

    const questions = await QuestionBagV3.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await QuestionBagV3.countDocuments(filter);

    console.log(`Found ${questions.length} V3 questions, total: ${total}`);

    // Transform questions for frontend
    const transformedQuestions = questions.map(transformQuestionForFrontend);

    res.json({
      questions: transformedQuestions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching V3 questions:', error);
    res.status(500).json({ message: 'Failed to fetch questions', error });
  }
});

// Get random DI questions for a quiz - Role-based access control
router.post('/random', authenticateToken, checkMockTestLimit, async (req: AuthRequest, res) => {
  try {
    const { count = 20, timeLimit = 45, filters = {} } = req.body;

    console.log('----------------------------------------------');
    console.log('Fetching random DI questions with filter config:', JSON.stringify(filters, null, 2));
    console.log(`User: ${req.user?.email} (${req.user?.role})`);

    // Create a filter object based on provided filters
    const filter: any = {};

    // Handle DI question types (DI-DS, DI-GT, DI-MSR, DI-TPA)
    if (filters.questionType) {
      filter.questionType = filters.questionType;
    } else if (filters.questionTypes && filters.questionTypes.length > 0) {
      filter.questionType = { $in: filters.questionTypes };
    } else {
      // Default: include all DI question types
      filter.questionType = { $in: ['DI-DS', 'DI-GT', 'DI-MSR', 'DI-TPA'] };
    }

    // Handle difficulty filter
    if (filters.difficulty) {
      filter.difficulty = filters.difficulty;
    } else if (filters.difficulties && filters.difficulties.length > 0) {
      filter.difficulty = { $in: filters.difficulties };
    }

    // Opt-in "Ready for Quiz" gate. Off by default so legacy V3 questions
    // stay eligible. Gets folded into every sub-filter via the base `filter`.
    if (filters.onlyReadyForQuiz) {
      filter.readyForQuiz = true;
    }

    // Tenancy scope. In legacy_global mode this is `{}` (no-op).
    // In tenant_scoped mode, the user's accountId (and the legacy pool if
    // legacyAccessEnabled=true) is added to the filter.
    try {
      Object.assign(filter, await tenantScope(req));
    } catch (err) {
      if (err instanceof TenancyMissingAccountError) {
        return res.status(500).json({ success: false, code: err.code, message: err.message });
      }
      throw err;
    }

    console.log('Final MongoDB filter:', JSON.stringify(filter, null, 2));

    // No-repeat ledger. Pulls (user, questionId) pairs and folds the IDs into
    // every match stage below so a question the user has already seen never
    // resurfaces. Empty for unauthenticated callers (none in practice — this
    // route is auth-gated — but defensive in case middleware changes).
    const askedIds: mongoose.Types.ObjectId[] = req.user?.userId
      ? (await AskedQuestion.find({ userId: req.user.userId })
          .select('questionId').lean()).map((d: any) => d.questionId)
      : [];
    if (askedIds.length > 0) {
      console.log(`Excluding ${askedIds.length} previously-asked questions for ${req.user?.email}`);
      filter._id = { $nin: askedIds };
    }

    const recordAsked = async (picked: any[]): Promise<void> => {
      if (!req.user?.userId || picked.length === 0) return;
      try {
        await AskedQuestion.insertMany(
          picked.map((q: any) => ({
            userId: req.user!.userId,
            accountId: req.user!.accountId,
            questionId: q._id,
            source: 'V3' as const,
            questionType: q.questionType || 'Unknown',
            firstAskedAt: new Date(),
          })),
          { ordered: false }
        );
      } catch (err: any) {
        if (err?.code !== 11000 && !err?.writeErrors?.every((e: any) => e?.code === 11000)) {
          console.warn('AskedQuestion bulk insert (V3) had non-dup errors:', err?.message);
        }
      }
    };

    // Detect RC-only requests so we can do passage-grouped selection. RC
    // questions for one passage must come back together and consecutive in
    // the response, so the front-end RC card can show the passage stably.
    const requestedTypes: string[] = filters.questionType
      ? [filters.questionType]
      : (filters.questionTypes || []);
    const isRCRequest = requestedTypes.length > 0 && requestedTypes.every((t: string) => t === 'RC');

    let questions: any[] = [];
    let itemCount = 0;

    if (isRCRequest) {
      // RC: pull all matching docs, group by passageId, pick whole passages
      // until we've collected `count` questions.
      const rcDocs = await QuestionBagV3.find({
        ...filter,
        passageText: { $exists: true, $ne: '' }
      }).lean();

      const groups = new Map<string, any[]>();
      for (const q of rcDocs) {
        const key = q.passageId || q.rcNumber || `orphan_${q._id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(q);
      }

      // Shuffle group order; keep questions inside a group in their natural order.
      const shuffledGroups = Array.from(groups.values()).sort(() => Math.random() - 0.5);

      // Real GMAT caps each RC passage at 3-4 sub-questions. Hard-cap at 4
      // so a passage with more questions in the bank can't dominate the quiz.
      const RC_MAX_PER_PASSAGE = 4;
      for (const group of shuffledGroups) {
        if (itemCount >= count) break;
        const remaining = count - itemCount;
        const take = group.slice(0, Math.min(group.length, remaining, RC_MAX_PER_PASSAGE));
        questions.push(...take);
        itemCount += take.length;
      }

      console.log(`RC quiz: packed ${questions.length} questions from ${groups.size} passages`);
    } else {
      // DI: 20 *scored items*, not 20 stems. Each MSR set contributes one
      // item per sub-question (typically 3); every other DI type is one item.
      const subItemWeight = (q: any): number => {
        if (q.questionType === 'DI-MSR') return Math.max(1, (q.subQuestions || []).length);
        return 1;
      };

      const sample = await QuestionBagV3.aggregate([
        { $match: filter },
        { $sample: { size: count * 2 } }
      ]);

      for (const q of sample) {
        const w = subItemWeight(q);
        if (itemCount + w > count) continue;
        questions.push(q);
        itemCount += w;
        if (itemCount >= count) break;
      }
      // Top up if the over-sample didn't yield enough light-weight items.
      if (itemCount < count) {
        // Merge already-picked with the asked-ledger so neither is lost when
        // we override `_id` here. (Spreading `filter` first would otherwise
        // overwrite the asked-ledger _id clause set above.)
        const exclude = [...questions.map((q) => q._id), ...askedIds];
        const more = await QuestionBagV3.aggregate([
          { $match: { ...filter, _id: { $nin: exclude }, questionType: { $ne: 'DI-MSR' } } },
          { $sample: { size: count - itemCount } }
        ]);
        for (const q of more) {
          if (itemCount >= count) break;
          questions.push(q);
          itemCount += 1;
        }
      }

      console.log(`Packed ${questions.length} DI stems = ${itemCount} scored items (target ${count})`);
    }

    if (questions.length === 0) {
      return res.status(404).json({
        message: isRCRequest
          ? 'No RC questions found in V3. Run the V3 RC extraction pipeline to populate.'
          : 'No Data Insights questions found. Please run the insertion script first.'
      });
    }

    // ---- QA gate (toggle in backend/src/config/featureFlags.ts) ----
    // Drop questions that fail validation; one top-up pass to refill. The
    // RC branch tops up by walking remaining shuffled passages so passage
    // grouping stays intact; the DI branch tops up via $sample.
    if (featureFlags.QUIZ_QA_ENABLED) {
      const before = questions.length;
      const { kept } = filterValidQuestions(questions, isRCRequest ? 'v3/random:rc' : 'v3/random:di');
      const droppedCount = before - kept.length;
      questions = kept;

      if (droppedCount > 0) {
        const excludeIds = new Set(questions.map((q: any) => String(q._id)));
        if (isRCRequest) {
          // Refill from remaining passage groups (already shuffled above is
          // not in scope here — re-pull and walk fresh, skipping kept ids).
          // Asked-ledger IDs merged in so they don't get reintroduced here.
          const mergedExclude = [...Array.from(excludeIds), ...askedIds.map((id) => String(id))];
          const moreRcDocs = await QuestionBagV3.find({
            ...filter,
            passageText: { $exists: true, $ne: '' },
            _id: { $nin: mergedExclude },
          }).lean();
          const groups = new Map<string, any[]>();
          for (const q of moreRcDocs) {
            const key = (q as any).passageId || (q as any).rcNumber || `orphan_${q._id}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(q);
          }
          const RC_MAX_PER_PASSAGE = 4;
          const shuffled = Array.from(groups.values()).sort(() => Math.random() - 0.5);
          let need = droppedCount;
          for (const group of shuffled) {
            if (need <= 0) break;
            const { kept: keptGroup } = filterValidQuestions(group, 'v3/random:rc:topup');
            const take = keptGroup.slice(0, Math.min(keptGroup.length, need, RC_MAX_PER_PASSAGE));
            questions.push(...take);
            need -= take.length;
          }
          console.log(`[QA:v3/random:rc] top-up added ${droppedCount - need} of ${droppedCount} needed`);
        } else {
          const mergedExclude = [...Array.from(excludeIds), ...askedIds.map((id) => String(id))];
          const topUp = await QuestionBagV3.aggregate([
            { $match: { ...filter, _id: { $nin: mergedExclude } } },
            { $sample: { size: Math.max(droppedCount * 3, 6) } },
          ]);
          const { kept: keptTopUp } = filterValidQuestions(topUp, 'v3/random:di:topup');
          questions.push(...keptTopUp.slice(0, droppedCount));
          console.log(`[QA:v3/random:di] top-up added ${Math.min(keptTopUp.length, droppedCount)} of ${droppedCount} needed`);
        }
      }
    }

    // Generate a unique quiz ID
    const quizId = new mongoose.Types.ObjectId().toString();

    // Transform questions for frontend
    const transformedQuestions = questions.map(transformQuestionForFrontend);

    // Count questions by type
    const questionCounts = questions.reduce((acc: any, q: any) => {
      acc[q.questionType] = (acc[q.questionType] || 0) + 1;
      return acc;
    }, {});

    console.log(`Created DI quiz with ${transformedQuestions.length} questions. Distribution: ${JSON.stringify(questionCounts)}`);

    // Update user's mock test count for non-unlimited users
    if (req.user && req.user.mockTestLimit !== -1) {
      await User.findByIdAndUpdate(req.user.userId, {
        $inc: { mockTestsUsed: 1 }
      });
    }

    await recordAsked(questions);

    res.json({
      quizId,
      questions: transformedQuestions,
      timeLimit,
      exhausted: transformedQuestions.length < count,
      deliveredCount: transformedQuestions.length,
    });
  } catch (error) {
    console.error('Error fetching random DI questions:', error);
    res.status(500).json({ message: 'Failed to fetch random questions', error });
  }
});

// Get a question by ID
router.get('/:id', authenticateToken, requirePaidUser, async (req: AuthRequest, res) => {
  try {
    const question = await QuestionBagV3.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const transformedQuestion = transformQuestionForFrontend(question);
    res.json(transformedQuestion);
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ message: 'Failed to fetch question', error });
  }
});

// Get questions by passage ID (for MSR with multiple sub-questions)
router.get('/passage/:passageId', authenticateToken, requirePaidUser, async (req: AuthRequest, res) => {
  try {
    const questions = await QuestionBagV3.find({ passageId: req.params.passageId });

    if (!questions || questions.length === 0) {
      return res.status(404).json({ message: 'No questions found for this passage' });
    }

    const transformedQuestions = questions.map(transformQuestionForFrontend);
    res.json(transformedQuestions);
  } catch (error) {
    console.error('Error fetching passage questions:', error);
    res.status(500).json({ message: 'Failed to fetch passage questions', error });
  }
});

// Get question type statistics
router.get('/stats/types', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const stats = await QuestionBagV3.aggregate([
      {
        $group: {
          _id: '$questionType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const totalCount = await QuestionBagV3.countDocuments();

    res.json({
      types: stats,
      total: totalCount
    });
  } catch (error) {
    console.error('Error fetching question stats:', error);
    res.status(500).json({ message: 'Failed to fetch question stats', error });
  }
});

/**
 * Validate a V3 payload per question type.
 * Returns an array of error strings; empty means valid.
 */
const validateV3Payload = (payload: any): string[] => {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') return ['Payload must be an object.'];

  const { questionType, questionText, category, difficulty, options, correctAnswer, subQuestions, msrSources } = payload;

  if (!questionType || typeof questionType !== 'string') errors.push('questionType is required.');
  if (!questionText || typeof questionText !== 'string' || !questionText.trim()) errors.push('questionText is required.');
  if (!category || typeof category !== 'string') errors.push('category is required.');
  if (!difficulty || typeof difficulty !== 'string') errors.push('difficulty is required.');

  switch (questionType) {
    case 'DI-DS':
    case 'DS': {
      if (!options || typeof options !== 'object') errors.push('DS requires the 5 canonical options.');
      else {
        for (const k of ['A', 'B', 'C', 'D', 'E']) {
          if (!options[k] || !String(options[k]).trim()) errors.push(`DS option ${k} is missing.`);
        }
      }
      if (!['A', 'B', 'C', 'D', 'E'].includes(correctAnswer)) errors.push('DS correctAnswer must be A-E.');
      break;
    }
    case 'PS':
    case 'CR':
    case 'RC':
    case 'DI-GT': {
      // GT comes in two persisted shapes: standard MC (top-level options) or subQuestions[yes_no_table | multiple_choice]
      const hasSub = Array.isArray(subQuestions) && subQuestions.length > 0;
      if (hasSub) {
        // Validate each sub-question
        subQuestions.forEach((sq: any, idx: number) => {
          if (!sq.questionType) errors.push(`subQuestion[${idx}] missing questionType.`);
          if (sq.questionType === 'yes_no_table') {
            if (!Array.isArray(sq.columnHeaders) || sq.columnHeaders.length !== 2) errors.push(`subQuestion[${idx}] yes_no_table needs 2 columnHeaders.`);
            if (!Array.isArray(sq.statements) || sq.statements.length < 2) errors.push(`subQuestion[${idx}] needs at least 2 statements.`);
            if (!Array.isArray(sq.correctAnswer) || sq.correctAnswer.length !== (sq.statements?.length || 0)) errors.push(`subQuestion[${idx}] correctAnswer length must match statements.`);
          } else if (sq.questionType === 'multiple_choice') {
            if (!Array.isArray(sq.options) || sq.options.length < 2) errors.push(`subQuestion[${idx}] needs >=2 options.`);
            if (!sq.correctAnswer) errors.push(`subQuestion[${idx}] missing correctAnswer.`);
          }
        });
      } else {
        if (!options || typeof options !== 'object') errors.push(`${questionType} requires options A-E.`);
        else for (const k of ['A', 'B', 'C', 'D', 'E']) {
          if (!options[k] || !String(options[k]).trim()) errors.push(`${questionType} option ${k} is missing.`);
        }
        if (!['A', 'B', 'C', 'D', 'E'].includes(correctAnswer)) errors.push(`${questionType} correctAnswer must be A-E.`);
      }
      break;
    }
    case 'DI-MSR': {
      if (!Array.isArray(msrSources) || msrSources.length < 2) errors.push('MSR needs at least 2 sources.');
      else {
        msrSources.forEach((s: any, idx: number) => {
          if (!s.tabName || !s.content) errors.push(`MSR source[${idx}] needs tabName and content.`);
        });
      }
      if (!Array.isArray(subQuestions) || subQuestions.length < 1) errors.push('MSR needs at least 1 sub-question.');
      else {
        subQuestions.forEach((sq: any, idx: number) => {
          if (sq.questionType === 'multiple_choice') {
            if (!Array.isArray(sq.options) || sq.options.length < 2) errors.push(`MSR sub[${idx}] needs >=2 options.`);
            if (!sq.correctAnswer) errors.push(`MSR sub[${idx}] missing correctAnswer.`);
          } else if (sq.questionType === 'yes_no_table') {
            if (!Array.isArray(sq.statements) || sq.statements.length < 2) errors.push(`MSR sub[${idx}] needs >=2 statements.`);
            if (!Array.isArray(sq.correctAnswer) || sq.correctAnswer.length !== sq.statements.length) errors.push(`MSR sub[${idx}] correctAnswer length must match statements.`);
          } else {
            errors.push(`MSR sub[${idx}] questionType must be multiple_choice or yes_no_table.`);
          }
        });
      }
      break;
    }
    case 'DI-TPA': {
      if (!Array.isArray(subQuestions) || subQuestions.length !== 1) errors.push('TPA needs exactly 1 sub-question.');
      else {
        const sq = subQuestions[0];
        if (sq.questionType !== 'two_part_analysis') errors.push('TPA sub-question type must be two_part_analysis.');
        if (!Array.isArray(sq.columnHeaders) || sq.columnHeaders.length !== 2) errors.push('TPA needs 2 columnHeaders.');
        if (!Array.isArray(sq.rowOptions) || sq.rowOptions.length < 2) errors.push('TPA needs >=2 rowOptions.');
        if (!Array.isArray(sq.correctAnswer) || sq.correctAnswer.length !== 2) errors.push('TPA correctAnswer must be a [colA_rowIdx, colB_rowIdx] pair.');
      }
      break;
    }
    default:
      // Unknown type — accept loosely; useful for migration paths
      break;
  }
  return errors;
};

// Create a new V3 question - Admin only (Question Forge)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required to create questions' });
    }

    const errors = validateV3Payload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const doc = {
      ...req.body,
      entryMethod: 'manual',
      validationStatus: req.body.validationStatus || 'perfect',
      extractionVersion: req.body.extractionVersion || 'manual_v1',
      source: req.body.source || 'Manual entry',
      sourceDetails: req.body.sourceDetails || { url: '' },
      tags: req.body.tags || [],
      metadata: req.body.metadata || {},
      statistics: req.body.statistics || { answeredCount: 0, correctPercentage: '' }
    };

    const created = await QuestionBagV3.create(doc);
    const transformed = transformQuestionForFrontend(created);
    console.log(`Admin ${req.user.email} created V3 question ${created._id} (${created.questionType})`);
    res.status(201).json(transformed);
  } catch (error: any) {
    console.error('Error creating V3 question:', error);
    // Surface mongoose validation errors clearly so the editor can show them inline.
    if (error?.name === 'ValidationError' && error?.errors) {
      const errors = Object.entries(error.errors).map(([path, e]: [string, any]) =>
        `${path}: ${e.message || String(e)}`
      );
      return res.status(400).json({ success: false, message: 'Mongo validation failed', errors });
    }
    res.status(500).json({
      message: 'Failed to create question',
      error: error?.message || String(error)
    });
  }
});

// Update a question - Admin only
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to update questions'
      });
    }

    const questionId = req.params.id;
    const updateData = req.body;

    console.log(`Admin ${req.user.email} updating V3 question ${questionId}`);

    const updatedQuestion = await QuestionBagV3.findByIdAndUpdate(
      questionId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedQuestion) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const transformedQuestion = transformQuestionForFrontend(updatedQuestion);
    console.log('V3 Question updated successfully');
    res.json(transformedQuestion);
  } catch (error) {
    console.error('Error updating V3 question:', error);
    res.status(500).json({ message: 'Failed to update question', error });
  }
});

// Delete a question - Admin only
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to delete questions'
      });
    }

    const questionId = req.params.id;

    console.log(`Admin ${req.user.email} deleting V3 question ${questionId}`);

    const deletedQuestion = await QuestionBagV3.findByIdAndDelete(questionId);

    if (!deletedQuestion) {
      return res.status(404).json({ message: 'Question not found' });
    }

    console.log('V3 Question deleted successfully');
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting V3 question:', error);
    res.status(500).json({ message: 'Failed to delete question', error });
  }
});

export default router;
