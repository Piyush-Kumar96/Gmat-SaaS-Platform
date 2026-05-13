import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { QuestionBag } from '../models/QuestionBag';

dotenv.config();

const createSampleQuestions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz');
    console.log('Connected to MongoDB');

    // Sample questions
    const sampleQuestions = [
      {
        questionText: 'If x + y = 10 and x - y = 4, what is the value of x?',
        questionType: 'Multiple Choice',
        options: ['3', '5', '7', '9'],
        correctAnswer: '7',
        explanation: 'Adding the two equations: (x + y) + (x - y) = 10 + 4, which simplifies to 2x = 14. Therefore, x = 7.',
        difficulty: 2,
        category: 'Quantitative',
        tags: ['algebra', 'equations'],
      },
      {
        questionText: 'The GMAT is a standardized test used for graduate business school admissions.',
        questionType: 'True/False',
        options: [],
        correctAnswer: 'True',
        explanation: 'The GMAT (Graduate Management Admission Test) is indeed a standardized test used by many business schools as part of their admissions process.',
        difficulty: 1,
        category: 'Verbal',
        tags: ['gmat', 'factual'],
      },
      {
        questionText: 'In the sentence "The company\'s profits have increased significantly over the past year," the word "significantly" is an adverb modifying the verb "have increased."',
        questionType: 'True/False',
        options: [],
        correctAnswer: 'True',
        explanation: 'In this sentence, "significantly" is an adverb that modifies the verb phrase "have increased," indicating the degree or extent of the increase.',
        difficulty: 2,
        category: 'Verbal',
        tags: ['grammar', 'parts of speech'],
      },
      {
        questionText: 'If a rectangle has a length of 8 units and a width of 6 units, what is its area?',
        questionType: 'Multiple Choice',
        options: ['14 square units', '28 square units', '48 square units', '56 square units'],
        correctAnswer: '48 square units',
        explanation: 'The area of a rectangle is calculated by multiplying its length by its width. In this case, 8 × 6 = 48 square units.',
        difficulty: 1,
        category: 'Quantitative',
        tags: ['geometry', 'area'],
      },
      {
        questionText: 'According to the passage, which of the following is NOT mentioned as a benefit of regular exercise?',
        questionType: 'Multiple Choice',
        options: ['Improved cardiovascular health', 'Reduced stress levels', 'Enhanced cognitive function', 'Increased muscle mass'],
        correctAnswer: 'Enhanced cognitive function',
        explanation: 'While the passage mentions improved cardiovascular health, reduced stress levels, and increased muscle mass as benefits of regular exercise, it does not mention enhanced cognitive function.',
        difficulty: 3,
        category: 'Verbal',
        tags: ['reading comprehension', 'detail'],
      },
    ];

    // Check if questions already exist
    const existingQuestions = await QuestionBag.find();
    if (existingQuestions.length > 0) {
      console.log('Sample questions already exist');
      process.exit(0);
    }

    // Insert sample questions
    await QuestionBag.insertMany(sampleQuestions);
    console.log('Sample questions created successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error creating sample questions:', error);
    process.exit(1);
  }
};

createSampleQuestions(); 