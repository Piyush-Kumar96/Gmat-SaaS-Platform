import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Quiz } from '../models/Quiz';
import { QuestionBag } from '../models/QuestionBag';

dotenv.config();

const createSampleQuiz = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz');
    console.log('Connected to MongoDB');

    // Check if sample quiz already exists
    const existingQuiz = await Quiz.findOne({ title: 'GMAT Practice Quiz 1' });
    if (existingQuiz) {
      console.log('Sample quiz already exists');
      process.exit(0);
    }

    // Get questions from QuestionBag
    const questions = await QuestionBag.find().limit(5);
    if (questions.length === 0) {
      console.log('No questions found in QuestionBag. Please run create-sample-questions first.');
      process.exit(1);
    }

    // Create sample quiz
    const sampleQuiz = new Quiz({
      title: 'GMAT Practice Quiz 1',
      description: 'A sample GMAT practice quiz with mixed question types',
      totalQuestions: questions.length,
      timeLimit: 30, // 30 minutes
      difficulty: 2,
      category: 'Mixed',
      questions: questions.map(q => q._id),
    });

    await sampleQuiz.save();
    console.log('Sample quiz created successfully');
    console.log(`Title: ${sampleQuiz.title}`);
    console.log(`Total Questions: ${sampleQuiz.totalQuestions}`);
    console.log(`Time Limit: ${sampleQuiz.timeLimit} minutes`);

    process.exit(0);
  } catch (error) {
    console.error('Error creating sample quiz:', error);
    process.exit(1);
  }
};

createSampleQuiz(); 