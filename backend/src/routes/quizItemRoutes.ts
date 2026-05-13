import express from 'express';
import { QuizItem } from '../models/QuizItem';
import { QuestionBag, IQuestionBag } from '../models/QuestionBag';
import mongoose from 'mongoose';

const router = express.Router();

// Define a generic question interface that works for both collections
interface QuestionResponse {
  _id: mongoose.Types.ObjectId;
  questionText: string;
  questionType: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: number | string;
  category: string;
  tags: string[];
  paragraph?: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any; // Allow additional properties
}

// Get paginated quiz items
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const items = await QuizItem.find()
      .sort({ questionNumber: 1 })
      .skip(skip)
      .limit(limit);

    const total = await QuizItem.countDocuments();

    res.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching quiz items:', error);
    res.status(500).json({ message: 'Error fetching quiz items' });
  }
});

// Get questions from QuestionBag with filtering
router.get('/question-bag', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter based on query parameters
    const filter: any = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.questionType) filter.questionType = req.query.questionType;
    if (req.query.difficulty) filter.difficulty = parseInt(req.query.difficulty as string);
    if (req.query.tags) {
      const tags = (req.query.tags as string).split(',');
      filter.tags = { $in: tags };
    }

    console.log('Fetching questions with filter:', filter);

    // Try to fetch from QuestionBag first
    const questionBagResults = await QuestionBag.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    let total = await QuestionBag.countDocuments(filter);
    let responseQuestions: QuestionResponse[] = [];

    // If we found questions in QuestionBag, use those
    if (questionBagResults.length > 0) {
      responseQuestions = questionBagResults.map(q => q.toObject() as QuestionResponse);
    } else {
      // Otherwise, try QuizItem as fallback
      console.log('No questions found in QuestionBag, trying QuizItem collection');
      
      // Convert filter to work with QuizItem schema
      const quizItemFilter: any = {};
      if (filter.category) quizItemFilter.category = filter.category;
      if (filter.questionType) quizItemFilter.questionType = filter.questionType;
      if (filter.difficulty) quizItemFilter.difficulty = filter.difficulty;
      if (filter.tags) quizItemFilter.tags = filter.tags;
      
      const quizItems = await QuizItem.find(quizItemFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      total = await QuizItem.countDocuments(quizItemFilter);
      
      // Map QuizItem fields to match expected format for frontend
      responseQuestions = quizItems.map(item => {
        const doc = item.toObject();
        return {
          _id: doc._id,
          questionText: doc.questionText || '',
          questionType: doc.questionType || doc.type || 'Multiple Choice',
          options: doc.options || [],
          correctAnswer: doc.correctAnswer || doc.answerText || '',
          explanation: doc.explanation || doc.explanationText || '',
          difficulty: doc.difficulty || 1,
          category: doc.category || 'General',
          tags: doc.tags || [],
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        } as QuestionResponse;
      });
    }

    console.log(`Found ${responseQuestions.length} questions, total: ${total}`);

    res.json({
      questions: responseQuestions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching questions from question bag:', error);
    res.status(500).json({ message: 'Error fetching questions from question bag' });
  }
});

// Delete a quiz item
router.delete('/:id', async (req, res) => {
  try {
    const item = await QuizItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Quiz item not found' });
    }
    res.json({ message: 'Quiz item deleted successfully' });
  } catch (error) {
    console.error('Error deleting quiz item:', error);
    res.status(500).json({ message: 'Error deleting quiz item' });
  }
});

// Delete a question from QuestionBag
router.delete('/question-bag/:id', async (req, res) => {
  try {
    const question = await QuestionBag.findByIdAndDelete(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found in question bag' });
    }
    res.json({ message: 'Question deleted successfully from question bag' });
  } catch (error) {
    console.error('Error deleting question from question bag:', error);
    res.status(500).json({ message: 'Error deleting question from question bag' });
  }
});

// Get random questions for quiz from QuestionBag
router.get('/random-questions', async (req, res) => {
  try {
    const count = parseInt(req.query.count as string) || 20;
    const filter: any = {};
    
    // Optional filtering
    if (req.query.category) filter.category = req.query.category;
    if (req.query.questionType) filter.questionType = req.query.questionType;
    if (req.query.difficulty) filter.difficulty = parseInt(req.query.difficulty as string);
    
    console.log('Fetching random questions with filter:', filter);
    
    // Use MongoDB aggregation to get random questions
    const randomQuestions = await QuestionBag.aggregate([
      { $match: filter },
      { $sample: { size: count } },
      {
        $project: {
          _id: 1,
          questionText: 1,
          questionType: 1,
          options: 1,
          correctAnswer: 1, 
          explanation: 1,
          difficulty: 1,
          category: 1,
          tags: 1,
          paragraph: 1
        }
      }
    ]);
    
    console.log(`Found ${randomQuestions.length} random questions for quiz`);
    
    // Generate a unique quiz ID
    const quizId = new mongoose.Types.ObjectId();
    
    res.json({
      quizId: quizId.toString(),
      questions: randomQuestions,
      timeLimit: parseInt(req.query.timeLimit as string) || 30 // Default 30 minutes
    });
  } catch (error) {
    console.error('Error fetching random questions:', error);
    res.status(500).json({ 
      message: 'Error fetching random questions for quiz',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;