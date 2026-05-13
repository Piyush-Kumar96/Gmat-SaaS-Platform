/**
 * OpenAI Integration Test Script
 * 
 * This script tests the OpenAI integration by fetching questions from the database
 * and sending them to the OpenAI API for processing. It tests a set number of questions
 * from the database and reports on the results including success rate, processing time,
 * and token usage.
 * 
 * The script is useful for:
 * - Verifying that the OpenAI API integration works correctly
 * - Testing the quality of AI-generated answers and explanations
 * - Measuring performance metrics like processing time and token usage
 * - Identifying any issues with specific question types or formats
 */

import mongoose from 'mongoose';
import { QuestionBag } from '../models/QuestionBag';
import { processQuestion, getTotalTokensUsed } from '../services/openaiService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Tests a single question by sending it to the OpenAI API and processing the response
 * 
 * @param question - The question document from MongoDB to test
 * @returns Result object containing success status, processing time, and response data
 */
const testSingleQuestion = async (question: any) => {
  try {
    console.log('\n----------------------------------------------');
    console.log(`Testing question ${question._id}:`);
    console.log(`Type: ${question.questionType}`);
    console.log(`Text: ${question.questionText.substring(0, 150)}...`);
    console.log(`Options: ${JSON.stringify(question.options.map((o: string) => o.substring(0, 30) + '...'))}`);
    
    const startTime = Date.now();
    
    // Call OpenAI service
    const result = await processQuestion({
      questionText: question.questionText,
      options: question.options,
      questionType: question.questionType
    });
    
    const processingTime = Date.now() - startTime;
    
    console.log('\nResponse:');
    console.log(`Answer: ${result.aiAnswer}`);
    console.log(`Explanation: ${result.aiExplanation}`);
    console.log(`Difficulty: ${result.questionDifficulty}`);
    console.log(`Processing time: ${processingTime}ms`);
    
    return { success: true, processingTime, question, result };
  } catch (error) {
    console.error(`Error processing question: ${question._id}`, error);
    return { success: false, error, question };
  }
};

/**
 * Main test function that retrieves questions from the database and tests them with OpenAI
 * 
 * Connects to MongoDB, fetches a specified number of questions, processes each one,
 * and produces a summary of the test results.
 */
const testOpenAI = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz');
    console.log('Connected to MongoDB');
    
    // Get 20 questions
    const questions = await QuestionBag.find({})
      .limit(20)
      .exec();
    
    console.log(`Found ${questions.length} questions to test`);
    
    // Statistics
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalProcessingTime = 0;
    const results = [];
    
    // Process each question
    for (const question of questions) {
      const result = await testSingleQuestion(question);
      
      if (result.success) {
        totalSuccess++;
        if (result.processingTime !== undefined) {
          totalProcessingTime += result.processingTime;
        }
        results.push({
          id: question._id,
          type: question.questionType,
          aiAnswer: result.result?.aiAnswer || 'No answer',
          aiExplanation: result.result?.aiExplanation || 'No explanation',
          difficulty: result.result?.questionDifficulty || 0
        });
      } else {
        totalFailure++;
        results.push({
          id: question._id,
          type: question.questionType,
          error: 'Failed to process'
        });
      }
    }
    
    // Summary
    console.log('\n======= TEST SUMMARY =======');
    console.log(`Total questions tested: ${totalSuccess + totalFailure}`);
    console.log(`Successfully processed: ${totalSuccess}`);
    console.log(`Failed to process: ${totalFailure}`);
    if (totalSuccess > 0) {
      console.log(`Average processing time: ${Math.round(totalProcessingTime / totalSuccess)}ms`);
    }
    console.log(`Total tokens used: ${getTotalTokensUsed()}`);
    
    // Print results table
    console.log('\n======= RESULTS TABLE =======');
    console.table(results);
    
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error in testOpenAI:', error);
  }
};

// Run the script
testOpenAI(); 