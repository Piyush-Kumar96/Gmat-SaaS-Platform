import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { QuestionBagV2 } from '../models/QuestionBagV2';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Files to import (first 5 only for test)
const FILES_TO_IMPORT = [
  'processed_1.json',
  'processed_2.json',
  'processed_3.json',
  'processed_4.json',
  'processed_5.json'
];

// Folder to read from
const FOLDER_NAME = 'quant_exampacks_mistral7b';
const EXPORTS_DIR = path.join(__dirname, '../../exports');

// Stats tracking
let totalFiles = 0;
let successfulImports = 0;
let skippedFiles = 0;
let errorCount = 0;

/**
 * Main function
 */
async function main() {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI environment variable is not set.');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Delete all existing Quant questions first
    try {
      console.log('Deleting all existing Quantitative questions...');
      const deleteResult = await QuestionBagV2.deleteMany({ category: 'Quantitative' });
      console.log(`Deleted ${deleteResult.deletedCount} existing Quantitative questions`);
    } catch (deleteError) {
      console.error(`Error deleting existing questions: ${deleteError}`);
    }
    
    const folderPath = path.join(EXPORTS_DIR, FOLDER_NAME);
    
    // Process each file
    for (const file of FILES_TO_IMPORT) {
      totalFiles++;
      
      try {
        const filePath = path.join(folderPath, file);
        console.log(`Processing ${file}...`);
        
        // Read and parse the file
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileContent);
        
        // Extract question data
        const questionNumber = parseInt(file.match(/processed_(\d+)\.json/)?.[1] || '0');
        
        // Simple question data mapping
        const questionData = {
          questionText: jsonData.analysis?.question || '',
          questionType: jsonData.metadata?.type === 'DS' ? 'Data Sufficiency' : 'Problem Solving',
          options: jsonData.analysis?.options || {},
          correctAnswer: jsonData.analysis?.correct_answer || 'Unknown',
          explanation: jsonData.analysis?.explanation || '',
          difficulty: jsonData.metadata?.difficulty_level || 'Medium',
          source: 'Exam Packs',
          sourceDetails: {
            url: jsonData.source_url || ''
          },
          category: 'Quantitative',
          tags: [jsonData.metadata?.topic || '', jsonData.metadata?.type || ''].filter(Boolean),
          questionNumber: questionNumber
        };
        
        // Skip if questionText is empty
        if (!questionData.questionText || questionData.questionText.trim() === '') {
          console.warn(`Skipping question ${questionNumber} due to missing question text`);
          skippedFiles++;
          continue;
        }
        
        // Import the question
        await QuestionBagV2.create(questionData);
        console.log(`Successfully imported question ${questionNumber}`);
        successfulImports++;
      } catch (error) {
        console.error(`Error processing file ${file}: ${error}`);
        errorCount++;
      }
    }
    
    // Print summary
    console.log('\n----- Import Summary -----');
    console.log(`Total files processed: ${totalFiles}`);
    console.log(`Successfully imported: ${successfulImports}`);
    console.log(`Skipped files: ${skippedFiles}`);
    console.log(`Errors: ${errorCount}`);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    console.log('\nTest import complete!');
  } catch (error) {
    console.error(`Error in main function: ${error}`);
    process.exit(1);
  }
}

// Run the script
main(); 