import { Router } from 'express';
import { PDFImporter } from '../pdfImporter';
import { QuizItem } from '../models/QuizItem';
import { UserQuiz } from '../models/UserQuiz';
import { UserQuizV2, ItemSource, QuizMode } from '../models/UserQuizV2';
import { QuestionBag } from '../models/QuestionBag';
import { QuestionBagV2 } from '../models/QuestionBagV2';
import { QuestionBagV3 } from '../models/QuestionBagV3';
import mongoose from 'mongoose';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Result fields here are what Results/Review pages render. Keep questionText
// and questionType populated, otherwise the review surface shows a bare
// letter with no context.
interface QuizResult {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  correctAnswer?: string;
  correctAnswerText?: string;
  userAnswerText?: string;
  explanation?: string;
  questionText?: string;
  questionType?: string;
}

// Import PDF
router.post('/import-pdf', async (req: any, res) => {
  try {
    if (!req.files || !req.files.pdf) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const pdfFile = req.files.pdf;
    const type = req.body.type || 'mixed';
    const count = await PDFImporter.importPDF(pdfFile.data, type as 'questions' | 'answers' | 'mixed');
    
    res.json({ message: `Successfully imported ${count} items` });
  } catch (error) {
    console.error('PDF import error:', error);
    res.status(500).json({ error: 'Failed to import PDF' });
  }
});

// Get random quiz questions and create a new quiz
router.get('/quizzes', optionalAuthMiddleware, async (req: any, res) => {
  try {
    const count = parseInt(req.query.count as string) || 20;
    const timeLimit = parseInt(req.query.timeLimit as string) || 30;
    
    // Get random questions from the QuestionBag collection
    const questions = await QuizItem.aggregate([
      { $match: { questionText: { $exists: true } } },
      { $sample: { size: count } },
      { 
        $project: { 
          _id: 1,
          questionText: 1,
          options: 1,
          category: 1,
          questionType: 1,
          difficulty: 1,
          tags: 1
        } 
      }
    ]);

    // Create a new quiz ID
    const quizId = new mongoose.Types.ObjectId();

    // If user is authenticated, create a UserQuiz document
    if (req.user) {
      const userId = req.user.userId;
      
      await UserQuiz.create({
        userId,
        quizId,
        score: 0,
        totalQuestions: questions.length,
        correctAnswers: 0,
        timeSpent: 0,
        questionTypes: [],
        questions: [],
        createdAt: new Date()
      });
    }

    res.json({
      quizId,
      questions,
      timeLimit
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Failed to get quiz questions' });
  }
});

// Submit quiz answers.
//
// Auth is required: previously this was `optionalAuthMiddleware`, which silently
// dropped submits when the access token had expired and was the most likely
// cause of "My Quizzes is empty" reports. The frontend's axios refresh
// interceptor handles token refresh transparently, so legitimate users won't
// notice the change.
//
// Body shape (backwards compatible):
//   { quizId, answers, timeSpent, mode?, filtersUsed?,
//     itemMeta?: { [qid]: { source, timeSpentMs, flaggedForReview, answeredAt } } }
//
// `itemMeta` is the new path the frontend uses to send per-question wall-clock
// time + source so we can populate UserQuizV2 properly. Old clients without
// itemMeta still work — we fall back to averaged time and source detection.
router.post('/quizzes/submit', authMiddleware, async (req: any, res) => {
  try {
    const { quizId, answers, timeSpent, mode, filtersUsed, itemMeta } = req.body;

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    const results: QuizResult[] = [];
    const questionTypes = new Map();
    // Per-question metadata captured for the new UserQuizV2 write path.
    const v2Items: Array<{
      questionId: any;
      source: ItemSource;
      questionType: string;
      userAnswer: any;
      isCorrect: boolean | null;
      timeSpentMs: number;
      flaggedForReview: boolean;
      answeredAt: Date | null;
    }> = [];
    
    // Process each answer. Look up across V2 → V3 → legacy V1 → QuizItem so
    // DI / new-RC questions (which live in V3) are also resolved and show up
    // on the review page.
    for (const [questionId, answer] of Object.entries(answers)) {
      let question: any = null;
      let correctAnswerValue: string | null | undefined = null;
      let explanation: string = '';
      let questionType = 'Unknown';
      let questionText: string = '';
      let optionsRef: any = null;
      // Track which collection produced the question so the UserQuizV2 item
      // can carry the right `source` discriminator. Drives the resolver in
      // the history detail endpoint.
      let resolvedSource: ItemSource = 'V2';

      if (mongoose.Types.ObjectId.isValid(questionId)) {
        question = await QuestionBagV2.findById(questionId);
        if (question) {
          correctAnswerValue = question.correctAnswer;
          explanation = question.explanation || '';
          questionType = question.questionType || 'Unknown';
          questionText = question.questionText || '';
          optionsRef = question.options;
          resolvedSource = 'V2';
        }
      }

      if (!question && mongoose.Types.ObjectId.isValid(questionId)) {
        question = await QuestionBagV3.findById(questionId);
        if (question) {
          correctAnswerValue = question.correctAnswer;
          explanation = question.explanation || '';
          questionType = question.questionType || 'Unknown';
          questionText = question.questionText || '';
          optionsRef = question.options;
          resolvedSource = 'V3';
        }
      }

      if (!question && mongoose.Types.ObjectId.isValid(questionId)) {
        question = await QuestionBag.findById(questionId);
        if (question) {
          correctAnswerValue = question.correctAnswer;
          explanation = question.explanation || '';
          questionType = question.questionType || 'Unknown';
          questionText = question.questionText || '';
          optionsRef = question.options;
          resolvedSource = 'V1';
        }
      }

      if (!question && mongoose.Types.ObjectId.isValid(questionId)) {
        question = await QuizItem.findById(questionId);
        if (question) {
          correctAnswerValue = question.answerText;
          // AI_generated_explanation is a legacy field that may exist on older documents
          explanation = question.explanationText || (question as unknown as { AI_generated_explanation?: string }).AI_generated_explanation || '';
          questionType = question.type || 'Unknown';
          questionText = question.questionText || '';
          optionsRef = question.options;
          resolvedSource = 'QuizItem';
        }
      }

      if (!question) continue;
      
      // Handle different answer formats (letter vs full text)
      let isCorrect = false;
      const userAnswer = answer as string;
      
      if (correctAnswerValue) {
        // For QuestionBagV2, the correct answer might be a letter (A, B, C, etc.)
        // or it might be the full text of the answer
        isCorrect = userAnswer === correctAnswerValue;
        
        // If not exact match, try to handle the case where answer is a letter but correctAnswer is full text
        if (!isCorrect && question.options) {
          // For QuestionBagV2, options could be an array or an object
          if (Array.isArray(question.options)) {
            // If options is an array, try to match by index (A=0, B=1, etc.)
            const letterIndex = userAnswer.charCodeAt(0) - 65; // 'A' = 0, 'B' = 1, etc.
            if (letterIndex >= 0 && letterIndex < question.options.length) {
              isCorrect = question.options[letterIndex] === correctAnswerValue;
            }
          } else if (typeof question.options === 'object') {
            // If options is an object, check if the answer matches the letter key
            isCorrect = question.options[userAnswer] === correctAnswerValue || 
                       (userAnswer === correctAnswerValue);
          }
        }
      }
      
      // Track question type statistics
      if (!questionTypes.has(questionType)) {
        questionTypes.set(questionType, { type: questionType, total: 0, correct: 0 });
      }
      const typeStats = questionTypes.get(questionType);
      typeStats.total += 1;
      if (isCorrect) typeStats.correct += 1;

      // Resolve the option text the user picked + the correct option text so
      // the Results page can render them next to the letter.
      let userAnswerText = '';
      let correctAnswerText = '';
      if (optionsRef) {
        if (Array.isArray(optionsRef)) {
          const userIdx = userAnswer.charCodeAt(0) - 65;
          if (userIdx >= 0 && userIdx < optionsRef.length) userAnswerText = optionsRef[userIdx] || '';
          if (correctAnswerValue) {
            const correctIdx = correctAnswerValue.charCodeAt(0) - 65;
            if (correctIdx >= 0 && correctIdx < optionsRef.length) correctAnswerText = optionsRef[correctIdx] || '';
          }
        } else if (typeof optionsRef === 'object') {
          // V2/V3 store options as { A: '...', B: '...' }. Mongoose Map-like
          // objects need .get(), plain objects bracket-access.
          const getOpt = (k: string) => (typeof optionsRef.get === 'function' ? optionsRef.get(k) : optionsRef[k]) || '';
          userAnswerText = getOpt(userAnswer);
          if (correctAnswerValue) correctAnswerText = getOpt(correctAnswerValue);
        }
      }

      results.push({
        questionId,
        userAnswer: userAnswer,
        isCorrect,
        correctAnswer: correctAnswerValue ?? undefined,
        correctAnswerText,
        userAnswerText,
        explanation,
        questionText,
        questionType,
      });

      // Mirror into the UserQuizV2 item shape. Use the client-supplied
      // itemMeta when available; otherwise fall back to defaults so old
      // clients still write something sensible.
      const meta = (itemMeta && itemMeta[questionId]) || {};
      v2Items.push({
        questionId,
        source: resolvedSource,
        questionType,
        userAnswer: answer,
        isCorrect,
        timeSpentMs: typeof meta.timeSpentMs === 'number' ? meta.timeSpentMs : 0,
        flaggedForReview: !!meta.flaggedForReview,
        answeredAt: meta.answeredAt ? new Date(meta.answeredAt) : new Date(),
      });
    }

    const score = results.filter(r => r.isCorrect).length;
    const total = results.length;
    const percentage = total > 0 ? (score / total) * 100 : 0;

    const userId = req.user.userId;

    // Legacy UserQuiz dual-write — kept until we cut over reads completely.
    // Tracked in backlog.md ("UserQuizV2 migration cutover").
    const userQuiz = await UserQuiz.findOneAndUpdate(
      { quizId, userId },
      {
        score,
        correctAnswers: score,
        timeSpent: timeSpent || 0,
        questionTypes: Array.from(questionTypes.values()),
        questions: results.map(r => ({
          questionId: r.questionId,
          userAnswer: r.userAnswer,
          isCorrect: r.isCorrect,
          timeSpent: Math.floor((timeSpent || 0) / Math.max(total, 1)),
        })),
      },
      { new: true, upsert: true }
    );
    const userQuizId = userQuiz._id;

    // New UserQuizV2 write — the canonical record going forward.
    const skippedCount = v2Items.filter((i) => i.userAnswer === null || i.userAnswer === undefined).length;
    const perTypeMap = new Map<string, { type: string; total: number; correct: number; skipped: number; totalTimeMs: number }>();
    for (const it of v2Items) {
      const slot = perTypeMap.get(it.questionType) || {
        type: it.questionType, total: 0, correct: 0, skipped: 0, totalTimeMs: 0,
      };
      slot.total += 1;
      if (it.isCorrect === true) slot.correct += 1;
      if (it.userAnswer === null || it.userAnswer === undefined) slot.skipped += 1;
      slot.totalTimeMs += it.timeSpentMs || 0;
      perTypeMap.set(it.questionType, slot);
    }
    const perType = Array.from(perTypeMap.values()).map((s) => ({
      type: s.type,
      total: s.total,
      correct: s.correct,
      skipped: s.skipped,
      avgTimeMs: s.total > 0 ? Math.round(s.totalTimeMs / s.total) : 0,
    }));

    await UserQuizV2.findOneAndUpdate(
      { quizId, userId },
      {
        userId,
        quizId,
        mode: (mode as QuizMode) || 'custom',
        filtersUsed: filtersUsed || {},
        startedAt: new Date(Date.now() - (timeSpent || 0) * 1000),
        submittedAt: new Date(),
        timeSpent: timeSpent || 0,
        status: 'submitted' as const,
        items: v2Items.map((it, idx) => ({ order: idx + 1, ...it })),
        summary: {
          score,
          total,
          correctCount: score,
          skippedCount,
          perType,
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      quizId,
      score,
      total,
      percentage,
      results,
      userQuizId
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ 
      error: 'Failed to submit quiz',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List the current user's past quiz attempts for the /quizzes history page.
//
// Reads from UserQuizV2 first (canonical going forward); falls back to the
// legacy UserQuiz collection for attempts that pre-date the dual-write.
// We tag each row with `schema: 'v2' | 'legacy'` so the FE knows whether
// rich fields (mode, perType.avgTimeMs, skippedCount) are available.
router.get('/history', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);

    const [v2Items, v2Total, legacyItems, legacyTotal] = await Promise.all([
      UserQuizV2.find({ userId, status: 'submitted' })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('_id quizId mode summary timeSpent createdAt')
        .lean(),
      UserQuizV2.countDocuments({ userId, status: 'submitted' }),
      // Pull legacy in parallel; we only surface those without a V2
      // counterpart (dual-write means new attempts are in both).
      UserQuiz.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('_id quizId score totalQuestions correctAnswers timeSpent questionTypes createdAt')
        .lean(),
      UserQuiz.countDocuments({ userId }),
    ]);

    const v2QuizIds = new Set(v2Items.map((q) => String(q.quizId)));
    const legacyOnly = legacyItems.filter((q) => !v2QuizIds.has(String(q.quizId)));

    const items = [
      ...v2Items.map((q: any) => ({
        id: q._id,
        quizId: q.quizId,
        schema: 'v2' as const,
        mode: q.mode,
        score: q.summary?.correctCount ?? q.summary?.score ?? 0,
        totalQuestions: q.summary?.total ?? 0,
        correctAnswers: q.summary?.correctCount ?? 0,
        skippedCount: q.summary?.skippedCount ?? 0,
        percentage: (q.summary?.total ?? 0) > 0 ? ((q.summary?.correctCount ?? 0) / q.summary.total) * 100 : 0,
        timeSpent: q.timeSpent,
        questionTypes: (q.summary?.perType || []).map((p: any) => ({ type: p.type, total: p.total, correct: p.correct })),
        createdAt: q.createdAt,
      })),
      ...legacyOnly.map((q: any) => ({
        id: q._id,
        quizId: q.quizId,
        schema: 'legacy' as const,
        mode: 'custom' as const,
        score: q.score,
        totalQuestions: q.totalQuestions,
        correctAnswers: q.correctAnswers,
        skippedCount: undefined,
        percentage: q.totalQuestions > 0 ? (q.correctAnswers / q.totalQuestions) * 100 : 0,
        timeSpent: q.timeSpent,
        questionTypes: q.questionTypes || [],
        createdAt: q.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());

    res.json({
      items: items.slice(0, limit),
      // Total is approximate when both stores are involved; for the cleanly
      // dual-written era it's the V2 count. Legacy-only catch-up uses the
      // legacy total, which over-reports slightly — acceptable for pagination.
      total: Math.max(v2Total, legacyTotal),
      page,
      limit,
    });
  } catch (error) {
    console.error('Quiz history error:', error);
    res.status(500).json({ message: 'Failed to fetch quiz history' });
  }
});

// Detailed view of a single past attempt for the /quizzes/:id review page.
//
// Prefers UserQuizV2 (canonical). Falls back to legacy UserQuiz for older
// attempts. Per-question lookup uses the `source` discriminator on V2 items
// to skip the V2→V3→V1→QuizItem cascade; legacy attempts still cascade.
//
// Returned `results` includes V3-specific fields (passageText, passageId,
// msrSources, subQuestions, artifactImages, artifactTables, artifactDescription)
// when the underlying doc carries them, so the FE QuestionCard router can
// render any DI variant from the same payload.
router.get('/history/:id', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid quiz id' });
    }

    // Resolve a single question by id, optionally constrained to the source
    // discriminator stored on the v2 item. Walks the cascade for legacy.
    const resolveQuestion = async (qid: string, hint?: ItemSource) => {
      const tryV2 = async () => QuestionBagV2.findById(qid);
      const tryV3 = async () => QuestionBagV3.findById(qid);
      const tryV1 = async () => QuestionBag.findById(qid);
      const tryQI = async () => QuizItem.findById(qid);
      const order: Array<() => Promise<any>> =
        hint === 'V3' ? [tryV3, tryV2, tryV1, tryQI]
        : hint === 'V1' ? [tryV1, tryV2, tryV3, tryQI]
        : hint === 'QuizItem' ? [tryQI, tryV2, tryV3, tryV1]
        : [tryV2, tryV3, tryV1, tryQI];
      for (const fn of order) {
        const doc = await fn();
        if (doc) return doc;
      }
      return null;
    };

    const formatResult = (doc: any, userAnswer: any, isCorrect: boolean | null) => {
      const correctAnswerValue = doc.correctAnswer ?? doc.answerText ?? null;
      const explanation = doc.explanation || doc.explanationText || (doc as any).AI_generated_explanation || '';
      const questionType = doc.questionType || doc.type || 'Unknown';
      const questionText = doc.questionText || '';
      const optionsRef = doc.options;
      const passageText = (doc.passageText !== undefined ? doc.passageText : null);

      let userAnswerText = '';
      let correctAnswerText = '';
      if (optionsRef && typeof userAnswer === 'string') {
        if (Array.isArray(optionsRef)) {
          const userIdx = userAnswer.charCodeAt(0) - 65;
          if (userIdx >= 0 && userIdx < optionsRef.length) userAnswerText = optionsRef[userIdx] || '';
          if (correctAnswerValue) {
            const correctIdx = correctAnswerValue.charCodeAt(0) - 65;
            if (correctIdx >= 0 && correctIdx < optionsRef.length) correctAnswerText = optionsRef[correctIdx] || '';
          }
        } else if (typeof optionsRef === 'object') {
          const getOpt = (k: string) => (typeof (optionsRef as any).get === 'function' ? (optionsRef as any).get(k) : (optionsRef as any)[k]) || '';
          userAnswerText = getOpt(userAnswer);
          if (correctAnswerValue) correctAnswerText = getOpt(correctAnswerValue);
        }
      }

      return {
        questionId: String(doc._id),
        userAnswer,
        isCorrect,
        correctAnswer: correctAnswerValue ?? undefined,
        correctAnswerText,
        userAnswerText,
        explanation,
        questionText,
        questionType,
        // V3 / DI fields — included when present, ignored by non-DI cards.
        passageText,
        passageId: doc.passageId,
        msrSources: doc.msrSources,
        subQuestions: doc.subQuestions,
        artifactImages: doc.artifactImages,
        artifactTables: doc.artifactTables,
        artifactDescription: doc.artifactDescription,
        // Options as an object (V2/V3 native shape) so the FE renders
        // labels A..E reliably; legacy `options[]` arrays come through too.
        options: optionsRef,
      };
    };

    // ---- Prefer UserQuizV2 ----
    const v2 = await UserQuizV2.findOne({ _id: id, userId }).lean();
    if (v2) {
      const results: any[] = [];
      for (const it of v2.items) {
        const doc = await resolveQuestion(String(it.questionId), it.source as ItemSource);
        if (!doc) continue;
        const r = formatResult(doc, it.userAnswer, it.isCorrect);
        results.push({
          ...r,
          // Carry through the V2 per-item enrichments so the FE can show
          // time, flag state, source, and order without an extra fetch.
          order: it.order,
          source: it.source,
          timeSpentMs: it.timeSpentMs,
          flaggedForReview: it.flaggedForReview,
          answeredAt: it.answeredAt,
        });
      }
      return res.json({
        schema: 'v2',
        quizId: v2.quizId,
        mode: v2.mode,
        filtersUsed: v2.filtersUsed,
        score: v2.summary?.correctCount ?? 0,
        total: v2.summary?.total ?? 0,
        percentage: (v2.summary?.total ?? 0) > 0 ? ((v2.summary?.correctCount ?? 0) / v2.summary.total) * 100 : 0,
        skippedCount: v2.summary?.skippedCount ?? 0,
        perType: v2.summary?.perType || [],
        results,
        userQuizId: v2._id,
        timeSpent: v2.timeSpent,
        // `timestamps: true` adds createdAt at runtime but isn't reflected
        // in the typed Document — cast through `any` for the lean shape.
        createdAt: (v2 as any).createdAt,
      });
    }

    // ---- Legacy fallback ----
    const userQuiz = await UserQuiz.findOne({ _id: id, userId }).lean();
    if (!userQuiz) {
      return res.status(404).json({ message: 'Quiz attempt not found' });
    }

    const results: any[] = [];
    for (const q of userQuiz.questions) {
      const doc = await resolveQuestion(q.questionId.toString());
      if (!doc) continue;
      results.push(formatResult(doc, q.userAnswer, q.isCorrect));
    }

    res.json({
      schema: 'legacy',
      quizId: userQuiz.quizId,
      mode: 'custom',
      score: userQuiz.score,
      total: userQuiz.totalQuestions,
      percentage: userQuiz.totalQuestions > 0 ? (userQuiz.correctAnswers / userQuiz.totalQuestions) * 100 : 0,
      results,
      userQuizId: userQuiz._id,
      timeSpent: userQuiz.timeSpent,
      createdAt: userQuiz.createdAt,
    });
  } catch (error) {
    console.error('Quiz history detail error:', error);
    res.status(500).json({ message: 'Failed to fetch quiz attempt' });
  }
});

// ---- Stub endpoints for future AI tutor + similar-question features ----
// Wired now so the FE can render disabled buttons that point to real URLs;
// implementation tracked in backlog.md.

router.post('/tutor/explain', authMiddleware, async (_req: any, res) => {
  return res.status(501).json({
    message: 'AI tutor not implemented yet. Tracked in backlog.md.',
  });
});

router.get('/practice/similar', authMiddleware, async (_req: any, res) => {
  return res.status(501).json({
    message: 'Similar-question practice not implemented yet. Tracked in backlog.md.',
  });
});

export default router;