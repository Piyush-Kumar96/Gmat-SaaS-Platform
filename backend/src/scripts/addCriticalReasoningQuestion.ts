import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { QuestionBag } from '../models/QuestionBag';

dotenv.config();

const addCriticalReasoningQuestion = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz');
    console.log('Connected to MongoDB');

    // Check if the question already exists
    const existingQuestion = await QuestionBag.findOne({
      questionText: 'Although fullerenes—spherical molecules made entirely of carbon—were first found in the laboratory, they have since been found in nature, formed in fissures of the rare mineral shungite. Since laboratory synthesis of fullerenes requires distinctive conditions of temperature and pressure, this discovery should give geologists a test case for evaluating hypotheses about the state of the Earth\'s crust at the time these naturally occurring fullerenes were formed. Which of the following, if true, most seriously undermines the argument?'
    });

    if (existingQuestion) {
      console.log('Question already exists');
      process.exit(0);
    }

    // Create the question
    const question = new QuestionBag({
      questionText: 'Although fullerenes—spherical molecules made entirely of carbon—were first found in the laboratory, they have since been found in nature, formed in fissures of the rare mineral shungite. Since laboratory synthesis of fullerenes requires distinctive conditions of temperature and pressure, this discovery should give geologists a test case for evaluating hypotheses about the state of the Earth\'s crust at the time these naturally occurring fullerenes were formed. Which of the following, if true, most seriously undermines the argument?',
      questionType: 'Critical Reasoning',
      subType: 'Weakening the Argument',
      options: [
        'A. Confirming that the shungite genuinely contained fullerenes took careful experimentation.',
        'B. Some fullerenes have also been found on the remains of a small meteorite that collided with a spacecraft.',
        'C. The mineral shungite itself contains large amounts of carbon, from which the fullerenes apparently formed.',
        'D. The naturally occurring fullerenes are arranged in a previously unknown crystalline structure.',
        'E. Shungite itself is formed only under distinctive conditions.'
      ],
      correctAnswer: 'D',
      explanation: 'The argument suggests that the discovery of naturally occurring fullerenes in shungite provides a test case for evaluating hypotheses about the Earth\'s crust conditions when these fullerenes formed. This is because laboratory synthesis of fullerenes requires distinctive conditions of temperature and pressure.\n\nOption D undermines this argument by suggesting that the naturally occurring fullerenes have a "previously unknown crystalline structure." This implies that the formation conditions for these natural fullerenes might be different from those required in the laboratory, making them less useful as a test case for evaluating hypotheses about the Earth\'s crust conditions.\n\nIf the natural fullerenes have a different structure than those created in the laboratory, it suggests they might have formed under different conditions, which would make them less reliable indicators of the Earth\'s crust conditions at the time they were formed.',
      difficulty: 4,
      category: 'Verbal',
      tags: ['critical reasoning', 'weakening argument', 'chemistry', 'geology']
    });

    await question.save();
    console.log('Critical Reasoning question added successfully');
    console.log(`Question ID: ${question._id}`);

    process.exit(0);
  } catch (error) {
    console.error('Error adding Critical Reasoning question:', error);
    process.exit(1);
  }
};

addCriticalReasoningQuestion(); 