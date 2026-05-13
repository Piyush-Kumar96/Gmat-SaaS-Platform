import express from 'express';
import mongoose from 'mongoose';
import { QuestionBagV2 } from '../models/QuestionBagV2';
import { User } from '../models/User';
import { AskedQuestion } from '../models/AskedQuestion';
import { authenticateToken, requirePaidUser, checkMockTestLimit, AuthRequest } from '../middleware/roleAuth';
import { featureFlags } from '../config/featureFlags';
import { filterValidQuestions } from '../services/questionQA';
import { tenantScope, TenancyMissingAccountError } from '../services/tenancy';

const router = express.Router();

/**
 * Transform QuestionBagV2 document to format expected by frontend
 */
const transformQuestionForFrontend = (question: any) => {
    // Convert options object to array format for frontend compatibility
  const transformedQuestion = {
    ...question.toObject ? question.toObject() : question,
    options: Object.entries(question.options || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, text]) => text)
  };
  
  return transformedQuestion;
};

// Get all questions with pagination - Admin only
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
    // Ready-for-quiz tri-state: "ready" → only flagged docs; "notReady" →
    // explicitly unflagged or unset; anything else (incl. "all" / undefined) → no filter.
    // The notReady branch and the search branch each need an `$or`; combine
    // them under `$and` so they don't overwrite each other.
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
            { 'metadata.argument': rx },
            { 'metadata.passage': rx },
          ],
        });
      }
    }
    if (orClauses.length === 1) {
      Object.assign(filter, orClauses[0]);
    } else if (orClauses.length > 1) {
      filter.$and = orClauses;
    }

    console.log('Fetching questions with filter:', filter);

    const questions = await QuestionBagV2.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    const total = await QuestionBagV2.countDocuments(filter);
    
    console.log(`Found ${questions.length} questions, total: ${total}`);
    
    // Transform questions for frontend
    const transformedQuestions = questions.map(transformQuestionForFrontend);

    res.json({
      questions: transformedQuestions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Failed to fetch questions', error });
  }
});

// Get random questions for a quiz - Role-based access control
router.post('/random', authenticateToken, checkMockTestLimit, async (req: AuthRequest, res) => {
  try {
    const { count = 20, timeLimit = 30, filters = {} } = req.body;
    
    console.log('----------------------------------------------');
    console.log('Fetching random questions with filter config:', JSON.stringify(filters, null, 2));
    console.log(`User: ${req.user?.email} (${req.user?.role}) - Mock tests used: ${req.user?.mockTestsUsed}/${req.user?.mockTestLimit}`);

    // No-repeat exclusion. Pull the user's full ledger up-front; thread it into
    // every `_id: { $nin: ... }` clause below. Cheap (small per-user index hit)
    // and avoids re-querying inside hot loops. Empty for unauthenticated callers.
    const askedIds: mongoose.Types.ObjectId[] = req.user?.userId
      ? (await AskedQuestion.find({ userId: req.user.userId })
          .select('questionId').lean()).map((d: any) => d.questionId)
      : [];
    if (askedIds.length > 0) {
      console.log(`Excluding ${askedIds.length} previously-asked questions for user ${req.user?.email}`);
    }
    const exclude = (picked: any[]): any[] => [...askedIds, ...picked.map((q: any) => q._id)];

    // Record served questions in the no-repeat ledger. Bulk insert with
    // ordered:false so a duplicate key (rare race on retries) doesn't blow
    // the whole batch. Best-effort — we never block the response on it.
    const recordAsked = async (picked: any[]): Promise<void> => {
      if (!req.user?.userId || picked.length === 0) return;
      try {
        await AskedQuestion.insertMany(
          picked.map((q: any) => ({
            userId: req.user!.userId,
            accountId: req.user!.accountId,
            questionId: q._id,
            source: 'V2' as const,
            questionType: q.questionType || 'Unknown',
            firstAskedAt: new Date(),
          })),
          { ordered: false }
        );
      } catch (err: any) {
        // E11000 duplicate key is expected on retries; everything else is
        // logged but doesn't fail the quiz delivery.
        if (err?.code !== 11000 && !err?.writeErrors?.every((e: any) => e?.code === 11000)) {
          console.warn('AskedQuestion bulk insert (V2) had non-dup errors:', err?.message);
        }
      }
    };

    // Create a filter object based on provided filters
    const filter: any = {};
    
    // Handle single category or multiple categories
    if (filters.category) {
      filter.category = filters.category;
      console.log(`Set category filter to: ${filters.category}`);
    } else if (filters.categories && filters.categories.length > 0) {
      filter.category = { $in: filters.categories };
      console.log(`Set categories filter to: ${JSON.stringify(filters.categories)}`);
    }
    
    // Handle single question type or multiple question types
    if (filters.questionType) {
      filter.questionType = filters.questionType;
      console.log(`Set questionType filter to: ${filters.questionType}`);
    } else if (filters.questionTypes && filters.questionTypes.length > 0) {
      filter.questionType = { $in: filters.questionTypes };
      console.log(`Set questionTypes filter to: ${JSON.stringify(filters.questionTypes)}`);
    }
    
    // Handle single difficulty or multiple difficulties
    if (filters.difficulty) {
      filter.difficulty = filters.difficulty;
      console.log(`Set difficulty filter to: ${filters.difficulty}`);
    } else if (filters.difficulties && filters.difficulties.length > 0) {
      filter.difficulty = { $in: filters.difficulties };
      console.log(`Set difficulties filter to: ${JSON.stringify(filters.difficulties)}`);
    }

    // Opt-in "Ready for Quiz" gate. When the client passes onlyReadyForQuiz,
    // restrict every sub-filter below to docs where the editor flipped the flag.
    // Default off so legacy questions stay eligible for random pulls.
    const readyForQuizExtra: Record<string, unknown> = filters.onlyReadyForQuiz
      ? { readyForQuiz: true }
      : {};
    Object.assign(filter, readyForQuizExtra);

    // Tenancy scope. No-op in legacy_global mode; in tenant_scoped mode this
    // restricts the candidate pool to the user's accountId (plus the legacy
    // pool when legacyAccessEnabled=true).
    try {
      Object.assign(filter, await tenantScope(req));
    } catch (err) {
      if (err instanceof TenancyMissingAccountError) {
        return res.status(500).json({ success: false, code: err.code, message: err.message });
      }
      throw err;
    }

    console.log('Final MongoDB filter:', JSON.stringify(filter, null, 2));
    
    // Add sanity checks to filter out incomplete questions
    const validQuestionFilter = {
      questionText: { $exists: true, $ne: '' },  // Must have question text
      options: { $exists: true, $ne: {} },       // Must have at least one option
      correctAnswer: { $exists: true, $ne: '' }  // Must have correct answer
    };
    
    // Define type-specific validation filters
    const typeSpecificFilters = {
      'Reading Comprehension': {
        passageText: { $exists: true, $ne: '' },       // Must have a passage
        rcNumber: { $exists: true, $ne: null }         // Must have an RC number for grouping
      },
      'Critical Reasoning': {
        passageText: { $exists: true, $ne: '' }        // Must have an argument/passage
      },
      'Data Sufficiency': {
        $or: [
          {
            'metadata.statement1': { $exists: true, $ne: '' }, 
            'metadata.statement2': { $exists: true, $ne: '' }
          },
          { questionText: { $regex: /\(1\).*\(2\)/ } }  // Question contains statements
        ]
      },
      'Problem Solving': {
        // No additional requirements beyond the base validQuestionFilter
      }
    };
    
    // Final array to hold our quiz questions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let finalQuestions: Array<Record<string, unknown>> = [];
    
    // Get requested question types (for logging and logic)
    let requestedTypes: string[] = [];
    if (filters.questionType) {
      requestedTypes = [filters.questionType];
    } else if (filters.questionTypes && filters.questionTypes.length > 0) {
      requestedTypes = [...filters.questionTypes];
    }
    
    console.log('Requested question types:', requestedTypes);
    
    // Distribution of question types for a balanced quiz
    // Skip this if user has specified a specific question type
    const questionTypeDistribution: Record<string, number> | null = (requestedTypes.length > 0) ? null : {
      'Reading Comprehension': Math.ceil(count * 0.3), // 30% RC questions
      'Critical Reasoning': Math.ceil(count * 0.2),    // 20% CR questions
      'Data Sufficiency': Math.ceil(count * 0.25),     // 25% DS questions
      'Problem Solving': Math.ceil(count * 0.25)       // 25% PS questions
    };

    // Step 1: Handle Reading Comprehension questions ONLY if explicitly requested
    const shouldHandleRC = filters.questionType === 'Reading Comprehension' || 
        (filters.questionTypes && filters.questionTypes.includes('Reading Comprehension'));
    
    if (shouldHandleRC) {
      
      // Limit to 2-3 RC passages for a 20 question quiz, scaled by count
      const maxRCPassages = Math.ceil(count / 10); // 2 passages for 20 questions
      
      // Maximum RC questions should be ~30% of total questions unless specifically requested
      const maxRCQuestions = (filters.questionType === 'Reading Comprehension' || 
                              (filters.questionTypes && filters.questionTypes.length === 1 && 
                               filters.questionTypes.includes('Reading Comprehension')))
                              ? count 
                              : Math.ceil(count * 0.3);
      
      // RC filter should respect other filter conditions too. The no-repeat
      // ledger is folded in via _id $nin so previously-asked passages don't
      // resurface for the same user.
      const rcFilter: any = {
        questionType: 'Reading Comprehension',
        ...validQuestionFilter,
        ...typeSpecificFilters['Reading Comprehension'],
        ...readyForQuizExtra,
        ...(askedIds.length > 0 ? { _id: { $nin: askedIds } } : {}),
      };

      // Apply category and difficulty filters if specified
      if (filter.category) rcFilter.category = filter.category;
      if (filter.difficulty) rcFilter.difficulty = filter.difficulty;
      
      console.log('RC Filter:', rcFilter);
      
      // Find all RC questions and group by passage (rcNumber)
      const rcQuestions = await QuestionBagV2.find(rcFilter);
      
      console.log(`Found ${rcQuestions.length} RC questions across different passages`);
      
      // Group by rcNumber (passage)
      const rcPassageGroups = new Map();
      rcQuestions.forEach(q => {
        const passageId = q.rcNumber || 'unknown';
        if (!rcPassageGroups.has(passageId)) {
          rcPassageGroups.set(passageId, []);
        }
        rcPassageGroups.get(passageId).push(q);
      });
      
      console.log(`RC questions grouped into ${rcPassageGroups.size} passages`);
      
      // Sort passages by question count (descending) to pick passages with more questions
      const sortedPassages = Array.from(rcPassageGroups.entries())
        .sort(([, questionsA], [, questionsB]) => questionsB.length - questionsA.length);
      
      let rcQuestionsAdded = 0;
      
      // Add questions from each passage until we reach our limit
      for (const [passageId, questions] of sortedPassages) {
        if (rcQuestionsAdded >= maxRCQuestions) break;
        if (finalQuestions.length >= count) break;
        
        // Sort questions within the passage by some criteria (e.g., difficulty, creation date)
        const sortedQuestions = questions.sort((a: any, b: any) => {
          // Prefer questions with higher difficulty if available
          if (a.difficulty && b.difficulty) {
            return b.difficulty - a.difficulty;
          }
          // Otherwise sort by creation date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        // Real GMAT caps each RC passage at ~3-4 sub-questions; long
        // passages get 4, short get 3. Hard-cap at 4 here so a 7-question
        // passage in the bank can't dominate the quiz.
        const RC_MAX_PER_PASSAGE = 4;

        // Take questions from this passage, but don't exceed our limits
        const questionsToTake = Math.min(
          sortedQuestions.length,
          maxRCQuestions - rcQuestionsAdded,
          count - finalQuestions.length,
          RC_MAX_PER_PASSAGE
        );
        
        finalQuestions.push(...sortedQuestions.slice(0, questionsToTake));
        rcQuestionsAdded += questionsToTake;
        
        console.log(`Added ${sortedQuestions.length} questions from RC passage ${passageId}`);
      }
      
      console.log(`Total RC questions added: ${rcQuestionsAdded}`);
      
      // If we're only requesting RC questions, we can return now
      if (requestedTypes.length === 1 && requestedTypes[0] === 'Reading Comprehension') {
        // Skip to the end (sorting, transforming, etc.)
        const transformedQuestions = finalQuestions.map(transformQuestionForFrontend);
        
        // Count questions by type for logging
        const questionCounts = finalQuestions.reduce((acc: any, q: any) => {
          acc[q.questionType] = (acc[q.questionType] || 0) + 1;
          return acc;
        }, {});
        
        console.log(`Created quiz with ${transformedQuestions.length} questions. Distribution: ${JSON.stringify(questionCounts)}`);
        
        // Generate a unique quiz ID
        const quizId = new mongoose.Types.ObjectId().toString();
        
        // Update user's mock test count for non-unlimited users
        if (req.user && req.user.mockTestLimit !== -1) {
          await User.findByIdAndUpdate(req.user.userId, {
            $inc: { mockTestsUsed: 1 }
          });
        }

        await recordAsked(finalQuestions);

        return res.json({
          quizId,
          questions: transformedQuestions,
          timeLimit,
          // Exhaustion flag — frontend uses this to surface "you've seen
          // every available RC question; reset or change filters."
          exhausted: transformedQuestions.length < count,
          deliveredCount: transformedQuestions.length,
        });
      }
    }
    
    // Step 2: Fill the remaining slots with other question types according to distribution or specific types
    const remainingCount = count - finalQuestions.length;
    
    if (remainingCount > 0) {
      // Define the question types we want to fetch (excluding RC if already handled)
      let typesToFetch: string[] = [];
      
      if (requestedTypes.length > 0) {
        // User specified specific types
        typesToFetch = requestedTypes.filter(type => type !== 'Reading Comprehension');
      } else {
        // Use default distribution
        typesToFetch = ['Critical Reasoning', 'Data Sufficiency', 'Problem Solving'];
      }
      
      console.log(`Fetching ${remainingCount} more questions for types: ${typesToFetch.join(', ')}`);
      
      // For each question type, fetch questions according to distribution
      for (const qType of typesToFetch) {
        if (finalQuestions.length >= count) break;
        
        // Calculate how many questions of this type we need
        let questionsNeeded: number;
        if (requestedTypes.length > 0) {
          // If specific types requested, distribute evenly among remaining types
          questionsNeeded = Math.ceil(remainingCount / typesToFetch.length);
        } else {
          // Use distribution percentages
          const distribution = questionTypeDistribution?.[qType] || 0;
          questionsNeeded = Math.min(distribution, count - finalQuestions.length);
        }
        
        if (questionsNeeded <= 0) continue;
        
        // Create filter for this question type
        const typeFilter: any = {
          questionType: qType,
          ...validQuestionFilter,
          ...readyForQuizExtra,
          _id: { $nin: exclude(finalQuestions) } // Exclude already selected questions
        };
        
        // Add type-specific validation
        if (typeSpecificFilters[qType as keyof typeof typeSpecificFilters]) {
          Object.assign(typeFilter, typeSpecificFilters[qType as keyof typeof typeSpecificFilters]);
        }
        
        // Apply user's filter preferences
        if (filter.category) typeFilter.category = filter.category;
        if (filter.difficulty) typeFilter.difficulty = filter.difficulty;
        
        console.log(`Fetching ${questionsNeeded} ${qType} questions with filter:`, typeFilter);
        
        try {
          const typeQuestions = await QuestionBagV2.aggregate([
            { $match: typeFilter },
            { $sample: { size: questionsNeeded } }
          ]);
          
          console.log(`Added ${typeQuestions.length} ${qType} questions`);
          finalQuestions.push(...typeQuestions);
        } catch (error) {
          console.error(`Error fetching ${qType} questions:`, error);
        }
      }
      
      // Step 3: If we still don't have enough questions, try fallback queries
      if (finalQuestions.length < count) {
        console.log(`Still need ${count - finalQuestions.length} more questions. Using fallback query.`);
        
        // Try each question type again with more relaxed filters
        for (const qType of typesToFetch) {
          if (finalQuestions.length >= count) break;
          
          const fallbackFilter: any = {
            questionType: qType,
            questionText: { $exists: true, $ne: '' },
            ...readyForQuizExtra,
            _id: { $nin: exclude(finalQuestions) }
          };
          
          // Apply user's category and difficulty preferences if specified
          if (filter.category) fallbackFilter.category = filter.category;
          if (filter.difficulty) fallbackFilter.difficulty = filter.difficulty;
          
          const fallbackQuestionsResult = await QuestionBagV2.aggregate([
            { $match: fallbackFilter },
            { $sample: { size: count - finalQuestions.length } }
          ]);
          
          console.log(`Added ${fallbackQuestionsResult.length} ${qType} questions as fallback`);
          finalQuestions.push(...fallbackQuestionsResult);
        }
        
        // Last resort - if we still don't have enough, try again with minimal requirements
        if (finalQuestions.length < count) {
          // Create a more permissive filter but still respect question type if specified
          const anyQuestionsFilter: any = {
            questionText: { $exists: true, $ne: '' },  // Only require question text
            ...readyForQuizExtra,
            _id: { $nin: exclude(finalQuestions) }
          };
          
          // If specific question types were requested, still respect that
          if (filter.questionType) {
            anyQuestionsFilter.questionType = filter.questionType;
          } else if (filter.questionType && filter.questionType.$in && filter.questionType.$in.length > 0) {
            anyQuestionsFilter.questionType = filter.questionType;
          }
          
          const anyQuestions = await QuestionBagV2.aggregate([
            { $match: anyQuestionsFilter },
            { $sample: { size: count - finalQuestions.length } }
          ]);
          
          console.log(`Added ${anyQuestions.length} additional questions with minimal validation to complete the quiz`);
          finalQuestions = [...finalQuestions, ...anyQuestions];
        }
      }
    }
    
    // Don't shuffle RC questions to keep passage questions together
    // Instead, keep RC passages intact but randomize the order of other question types
    let rcQuestions: any[] = [];
    let nonRcQuestions: any[] = [];
    
    // Separate RC from non-RC questions
    finalQuestions.forEach((q: any) => {
      if (q.questionType === 'Reading Comprehension') {
        rcQuestions.push(q);
      } else {
        nonRcQuestions.push(q);
      }
    });
    
    // Shuffle non-RC questions
    nonRcQuestions = nonRcQuestions.sort(() => Math.random() - 0.5);
    
    // Group RC questions by passage to keep them together
    const rcPassageGroups = new Map();
    rcQuestions.forEach((q: any) => {
      if (!rcPassageGroups.has(q.rcNumber)) {
        rcPassageGroups.set(q.rcNumber, []);
      }
      rcPassageGroups.get(q.rcNumber).push(q);
    });
    
    // Create array of RC passage groups
    const rcGroupsArray = Array.from(rcPassageGroups.values());
    
    // Shuffle the order of RC passage groups
    rcGroupsArray.sort(() => Math.random() - 0.5);
    
    // Flatten RC groups while maintaining questions within each group
    rcQuestions = rcGroupsArray.flat();
    
    // Randomly decide to put RC at beginning, middle or end
    const rcPosition = Math.floor(Math.random() * 3); // 0, 1, or 2
    
    if (rcQuestions.length === 0) {
      // No RC questions, just use shuffled non-RC questions
      finalQuestions = nonRcQuestions;
    } else if (rcPosition === 0) {
      // RC at beginning
      finalQuestions = [...rcQuestions, ...nonRcQuestions];
    } else if (rcPosition === 1 && nonRcQuestions.length > 2) {
      // RC in middle - split non-RC questions
      const midPoint = Math.floor(nonRcQuestions.length / 2);
      finalQuestions = [
        ...nonRcQuestions.slice(0, midPoint),
        ...rcQuestions,
        ...nonRcQuestions.slice(midPoint)
      ];
    } else {
      // RC at end or fallback
      finalQuestions = [...nonRcQuestions, ...rcQuestions];
    }
    
    // ---- QA gate (toggle in backend/src/config/featureFlags.ts) ----
    // Drop questions that fail validation, then top up once with a single
    // aggregation pass. Capped at one extra pass to bound latency — if we
    // can't refill after that, return what we have rather than block the
    // user. The flag exists so we can disable QA without redeploying logic.
    if (featureFlags.QUIZ_QA_ENABLED) {
      const before = finalQuestions.length;
      const { kept } = filterValidQuestions(finalQuestions, 'v2/random');
      finalQuestions = kept;
      const short = before - kept.length;
      if (short > 0) {
        // Top-up uses the same coarse filter that drove the assembly so we
        // don't accidentally widen the type/category window. Asked-ledger
        // exclusion is folded in via the `exclude` helper.
        const topUpFilter: any = { _id: { $nin: exclude(finalQuestions) }, ...readyForQuizExtra };
        if (filter.questionType) topUpFilter.questionType = filter.questionType;
        if (filter.category) topUpFilter.category = filter.category;
        if (filter.difficulty) topUpFilter.difficulty = filter.difficulty;
        const oversample = Math.max(short * 3, 6);
        const candidates = await QuestionBagV2.aggregate([
          { $match: topUpFilter },
          { $sample: { size: oversample } },
        ]);
        const { kept: keptTopUp } = filterValidQuestions(candidates, 'v2/random:topup');
        finalQuestions.push(...keptTopUp.slice(0, short));
        console.log(`[QA:v2/random] top-up added ${Math.min(keptTopUp.length, short)} of ${short} needed`);
      }
    }

    // Generate a unique quiz ID
    const quizId = new mongoose.Types.ObjectId().toString();

    // Transform questions for frontend
    const transformedQuestions = finalQuestions.map(transformQuestionForFrontend);

    // Count questions by type and check sanity
    const questionCounts = finalQuestions.reduce((acc: any, q: any) => {
      acc[q.questionType] = (acc[q.questionType] || 0) + 1;
      return acc;
    }, {});

    // Log details about the quiz
    console.log('----------------------------------------------');
    console.log(`Quiz configuration - Requested filters:`, JSON.stringify(filters, null, 2));
    console.log(`MongoDB filter used:`, JSON.stringify(filter, null, 2));
    console.log(`Created quiz with ${transformedQuestions.length} questions.`);
    console.log(`Question type distribution: ${JSON.stringify(questionCounts)}`);
    console.log('----------------------------------------------');
    
    // Update user's mock test count for non-unlimited users
    if (req.user && req.user.mockTestLimit !== -1) {
      await User.findByIdAndUpdate(req.user.userId, {
        $inc: { mockTestsUsed: 1 }
      });
      console.log(`Updated mock test count for user ${req.user.email}: ${req.user.mockTestsUsed + 1}/${req.user.mockTestLimit}`);
    }

    // Verify the types of questions returned match the requested types
    if (requestedTypes.length > 0) {
      const typesInQuiz = new Set(finalQuestions.map((q: any) => q.questionType));
      const unexpectedTypes = Array.from(typesInQuiz).filter(type => !requestedTypes.includes(type as string));
      const missingTypes = requestedTypes.filter(type => !typesInQuiz.has(type));
      
      if (unexpectedTypes.length > 0) {
        console.log(`Warning: Quiz contains question types that weren't requested: ${unexpectedTypes.join(', ')}`);
      }
      
      if (missingTypes.length > 0) {
        console.log(`Warning: Requested question types missing from quiz: ${missingTypes.join(', ')}`);
      }
    }
    
    await recordAsked(finalQuestions);

    res.json({
      quizId,
      questions: transformedQuestions,
      timeLimit,
      // Exhaustion flag — frontend uses this to surface "you've seen
      // every available question for these filters; reset or widen filters."
      exhausted: transformedQuestions.length < count,
      deliveredCount: transformedQuestions.length,
    });
  } catch (error) {
    console.error('Error fetching random questions:', error);
    res.status(500).json({ message: 'Failed to fetch random questions', error });
  }
});

// Get a question by ID - Paid users only
router.get('/:id', authenticateToken, requirePaidUser, async (req: AuthRequest, res) => {
  try {
    const question = await QuestionBagV2.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    // Transform question for frontend
    const transformedQuestion = transformQuestionForFrontend(question);
    
    res.json(transformedQuestion);
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ message: 'Failed to fetch question', error });
  }
});

// Update a question - Admin only
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Only admin can update questions
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required to update questions' 
      });
    }
    
    const questionId = req.params.id;
    const updateData = req.body;
    
    console.log(`Admin ${req.user.email} updating question ${questionId}`);
    
    const updatedQuestion = await QuestionBagV2.findByIdAndUpdate(
      questionId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedQuestion) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    // Transform question for frontend
    const transformedQuestion = transformQuestionForFrontend(updatedQuestion);
    
    console.log('Question updated successfully');
    res.json(transformedQuestion);
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ message: 'Failed to update question', error });
  }
});

// Delete a question - Admin only
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Only admin can delete questions
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required to delete questions' 
      });
    }
    
    const questionId = req.params.id;
    
    console.log(`Admin ${req.user.email} deleting question ${questionId}`);
    
    const deletedQuestion = await QuestionBagV2.findByIdAndDelete(questionId);
    
    if (!deletedQuestion) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    console.log('Question deleted successfully');
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Failed to delete question', error });
  }
});

// Create a new question - Admin only
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Only admin can create questions
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required to create questions' 
      });
    }
    
    const questionData = req.body;
    
    console.log(`Admin ${req.user.email} creating new question`);
    console.log('Creating new question with data:', JSON.stringify(questionData, null, 2));
    
    // Create the question
    const newQuestion = new QuestionBagV2(questionData);
    await newQuestion.save();
    
    // Transform the question for frontend
    const transformedQuestion = transformQuestionForFrontend(newQuestion);
    
    console.log('Question created successfully with ID:', newQuestion._id);
    res.status(201).json(transformedQuestion);
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ message: 'Failed to create question', error });
  }
});

export default router; 