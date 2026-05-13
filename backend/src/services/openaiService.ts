/**
 * OpenAI Integration Service
 * 
 * This service provides integration with OpenAI's API to process GMAT questions.
 * It handles single and batch processing of questions, manages token usage tracking,
 * and implements caching to optimize API calls.
 */

// Using require instead of import to avoid TypeScript errors
const dotenv = require('dotenv');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

// Define OpenAI client interface to avoid direct dependency
interface OpenAIClient {
  chat: {
    completions: {
      create: (params: any) => Promise<any>;
    };
  };
}

// Initialize OpenAI client if API key is available
let openai: OpenAIClient | null = null;

try {
  if (process.env.OPENAI_API_KEY) {
    // Only attempt to use OpenAI if API key is available
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } else {
    console.warn('OPENAI_API_KEY not found in environment variables. OpenAI features will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

/**
 * Cache to store responses for identical questions to reduce API calls and costs
 * Using a Map for in-memory caching with question content hash as the key
 */
const responseCache: Map<string, any> = new Map();

// Token usage tracking for monitoring API consumption
let totalTokensUsed = 0;

/**
 * Generates a cache key based on question content
 * Uses MD5 hash of combined question text and options for efficient lookup
 * 
 * @param questionText - The main text of the question
 * @param options - Array of answer options
 * @returns A unique string hash representing the question
 */
const generateCacheKey = (questionText: string, options: string[]): string => {
  const content = `${questionText}${options.join('')}`;
  return crypto.createHash('md5').update(content).digest('hex');
};

/**
 * Question data structure for processing by OpenAI
 */
export interface QuestionData {
  questionText: string;
  options: string[];
  correctAnswer: string;
  questionType?: string;
  explanation?: string;
  passageText?: string;
  metadata?: {
    statement1?: string;
    statement2?: string;
  };
  responseFormat?: {
    type: string;
  };
}

/**
 * Structure for AI-generated response
 */
interface AIResponse {
  aiAnswer: string;
  aiExplanation: string;
  questionDifficulty: number;
}

/**
 * Statistics for tracking the processing of questions
 */
export interface ProcessingStats {
  totalProcessed: number;
  totalFailed: number;
  totalCached: number;
  totalTokensUsed: number;
}

/**
 * Gets the total tokens used across all API calls
 * Used for monitoring API usage and costs
 * 
 * @returns The total number of tokens consumed
 */
export const getTotalTokensUsed = (): number => {
  return totalTokensUsed;
};

/**
 * Process a single question through OpenAI API
 * Sends the question to OpenAI GPT-4 model and gets back the answer, explanation, and difficulty
 * Implements caching to avoid duplicate API calls for the same question
 * Handles errors with fallback responses when appropriate
 * 
 * @param question - The question data to process
 * @returns Promise with AI-generated answer, explanation, and difficulty rating
 */
export const processQuestion = async (question: QuestionData): Promise<AIResponse> => {
  try {
    // Generate cache key
    const cacheKey = generateCacheKey(question.questionText, question.options);
    
    // Check if we have a cached response
    if (responseCache.has(cacheKey)) {
      console.log('Using cached response');
      return responseCache.get(cacheKey);
    }
    
    // Check if OpenAI client is available
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    // Create prompt for OpenAI
    const prompt = createPrompt(question);
    console.log('Sending prompt to OpenAI:', prompt);
    
    // Call OpenAI API
    console.log('Calling OpenAI API with model gpt-4o-mini...');
    
    const requestParams: any = {
      model: 'gpt-4o-mini',  // Using gpt-4o-mini model
      messages: [
        {
          role: 'system',
          content: 'You are a GMAT test expert who analyzes questions and provides accurate answers with brief explanations. Always respond in JSON format with answer, explanation, and difficulty fields.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500
    };
    
    // Add response format if specified
    if (question.responseFormat) {
      requestParams.response_format = question.responseFormat;
    }
    
    const response = await openai.chat.completions.create(requestParams);
    
    // Track token usage
    if (response.usage) {
      totalTokensUsed += response.usage.total_tokens;
      console.log(`Token usage: ${response.usage.total_tokens} (${response.usage.prompt_tokens} prompt, ${response.usage.completion_tokens} completion)`);
    }
    
    // Parse the response content
    const content = response.choices[0]?.message?.content || '';
    console.log('OpenAI response summary: Content received', 'Model:', response.model, 'Tokens:', response.usage?.total_tokens);
    
    // Create AI response
    const aiResponse: AIResponse = {
      aiAnswer: content,
      aiExplanation: '',
      questionDifficulty: 0
    };
    
    // Try to parse JSON response if expected
    if (!question.responseFormat) {
      try {
        const parsedResponse = JSON.parse(content);
        aiResponse.aiAnswer = parsedResponse.answer || content;
        aiResponse.aiExplanation = parsedResponse.explanation || '';
        aiResponse.questionDifficulty = parsedResponse.difficulty || 0;
      } catch (error) {
        console.error('Failed to parse JSON response:', content);
        // Use raw content as answer if parsing fails
      }
    }
    
    // Cache the response
    responseCache.set(cacheKey, aiResponse);
    
    return aiResponse;
  } catch (error) {
    console.error('Error processing question with OpenAI:', error);
    throw error;
  }
};

/**
 * Process a batch of questions in a single OpenAI request to save on API calls
 * More efficient than processing individual questions when handling multiple items
 * Includes fallback to individual processing if batch processing fails
 * 
 * @param questions - Array of questions to process
 * @returns Promise with array of AI-generated responses for each question
 */
export const processBatchQuestions = async (questions: QuestionData[]): Promise<AIResponse[]> => {
  try {
    // Check if OpenAI client is available
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    // Create batch prompt
    const prompt = createBatchPrompt(questions);
    console.log(`Processing batch of ${questions.length} questions...`);
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a GMAT test expert who analyzes questions and provides accurate answers with brief explanations. Always respond in JSON format with an array of answers, each containing answer, explanation, and difficulty fields.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500
    });
    
    // Track token usage
    if (response.usage) {
      totalTokensUsed += response.usage.total_tokens;
      console.log(`Batch token usage: ${response.usage.total_tokens} (${response.usage.prompt_tokens} prompt, ${response.usage.completion_tokens} completion)`);
    }
    
    // Parse the response content
    const content = response.choices[0]?.message?.content || '';
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse JSON batch response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }
    
    // Validate response structure
    if (!parsedResponse.answers || !Array.isArray(parsedResponse.answers)) {
      console.error('Unexpected response format, missing answers array');
      throw new Error('Unexpected response format from OpenAI');
    }
    
    // Format each question response
    const results: AIResponse[] = [];
    
    for (let i = 0; i < questions.length; i++) {
      const questionResponse = parsedResponse.answers[i];
      if (!questionResponse) {
        console.warn(`Missing response for question ${i+1}`);
        continue;
      }
      
      const result = {
        aiAnswer: questionResponse.answer,
        aiExplanation: questionResponse.explanation,
        questionDifficulty: questionResponse.difficulty,
      };
      
      // Cache individual question responses
      const cacheKey = generateCacheKey(questions[i].questionText, questions[i].options);
      responseCache.set(cacheKey, result);
      
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error('Error processing batch questions:', error);
    
    // If batch processing fails, fall back to individual processing
    console.log('Falling back to individual question processing...');
    const results: AIResponse[] = [];
    
    for (const question of questions) {
      try {
        const result = await processQuestion(question);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process question individually: ${question.questionText.substring(0, 50)}...`);
        
        // Add a placeholder result
        results.push({
          aiAnswer: '',
          aiExplanation: 'Failed to generate explanation',
          questionDifficulty: 5, // Default middle difficulty
        });
      }
    }
    
    return results;
  }
};

/**
 * Create a prompt for a single question
 * Formats the question and options for the OpenAI API in a structured way
 * 
 * @param question - The question data to format
 * @returns A formatted prompt string
 */
const createPrompt = (question: QuestionData): string => {
  const options = question.options.map((option, index) => 
    `${String.fromCharCode(65 + index)}. ${option}`
  ).join('\n');
  
  return `
Analyze this GMAT ${question.questionType || ''} question and provide:
1. The letter of the correct answer (A, B, C, D, or E)
2. A brief explanation (max 80 words) of why that answer is correct and why other answers are incorrect
3. A difficulty rating from 1.0 to 10.0 (higher means harder)

Question: ${question.questionText}

Options:
${options}

Format your response as a JSON object with the following keys:
- answer: The letter of the correct answer
- explanation: Brief explanation of why that answer is correct and why other answers are incorrect
- difficulty: A number from 1.0 to 10.0 rating the difficulty
`;
};

/**
 * Create a prompt for a batch of questions
 * Formats multiple questions for processing in a single API call
 * 
 * @param questions - Array of questions to format
 * @returns A formatted batch prompt string
 */
const createBatchPrompt = (questions: QuestionData[]): string => {
  const questionsText = questions.map((question, questionIndex) => {
    const options = question.options.map((option, index) => 
      `${String.fromCharCode(65 + index)}. ${option}`
    ).join('\n');
    
    return `
Question ${questionIndex + 1}: ${question.questionText}

Options:
${options}
`;
  }).join('\n----------------\n');
  
  return `
Analyze each of these GMAT questions and for EACH question provide:
1. The letter of the correct answer (A, B, C, D, or E)
2. A brief explanation (max 80 words) of why that answer is correct and why other answers are incorrect
3. A difficulty rating from 1.0 to 10.0 (higher means harder)

${questionsText}

Format your response as a JSON object with the following structure:
{
  "answers": [
    {
      "answer": "letter",
      "explanation": "explanation for question 1",
      "difficulty": number
    },
    // ...more answers
  ]
}
`;
};

export default {
  processQuestion,
  processBatchQuestions,
  getTotalTokensUsed
};