import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { QuestionBag } from '../models/QuestionBag';

interface ParsedQuestion {
  questionNumber: number;
  questionText: string;
  options: string[];
}

interface ParsedAnswer {
  questionNumber: number;
  correctAnswer: string;
  explanation: string;
}

export class PDFProcessor {
  private static async readPDF(filePath: string): Promise<Buffer> {
    try {
      return await fs.promises.readFile(filePath);
    } catch (error: any) {
      throw new Error(`Failed to read PDF file: ${error.message}`);
    }
  }

  private static async parseQuestionsPDF(pdfBuffer: Buffer): Promise<ParsedQuestion[]> {
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    const lines = text.split('\n');
    const questions: ParsedQuestion[] = [];
    let currentQuestion: Partial<ParsedQuestion> = {};

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentQuestion.questionText) {
          questions.push(currentQuestion as ParsedQuestion);
        }
        currentQuestion = {
          questionNumber: parseInt(line.match(/^\d+/)?.[0] || '0'),
          questionText: line.replace(/^\d+\.\s*/, ''),
          options: []
        };
      } else if (currentQuestion.questionText && line.trim()) {
        if (line.match(/^[A-E]\./)) {
          currentQuestion.options = currentQuestion.options || [];
          currentQuestion.options.push(line.trim());
        } else {
          currentQuestion.questionText += ' ' + line.trim();
        }
      }
    }

    if (currentQuestion.questionText) {
      questions.push(currentQuestion as ParsedQuestion);
    }

    return questions;
  }

  private static async parseAnswersPDF(pdfBuffer: Buffer): Promise<ParsedAnswer[]> {
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    const lines = text.split('\n');
    const answers: ParsedAnswer[] = [];
    let currentAnswer: Partial<ParsedAnswer> = {};

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentAnswer.explanation) {
          answers.push(currentAnswer as ParsedAnswer);
        }
        currentAnswer = {
          questionNumber: parseInt(line.match(/^\d+/)?.[0] || '0'),
          correctAnswer: '',
          explanation: ''
        };
      } else if (currentAnswer.questionNumber) {
        if (line.includes('Answer:')) {
          currentAnswer.correctAnswer = line.replace('Answer:', '').trim();
        } else if (line.includes('Explanation:')) {
          currentAnswer.explanation = line.replace('Explanation:', '').trim();
        } else if (currentAnswer.explanation) {
          currentAnswer.explanation += ' ' + line.trim();
        }
      }
    }

    if (currentAnswer.explanation) {
      answers.push(currentAnswer as ParsedAnswer);
    }

    return answers;
  }

  private static determineQuestionType(questionText: string): string {
    if (questionText.includes('Which of the following')) {
      return 'Multiple Choice';
    } else if (questionText.includes('True/False')) {
      return 'True/False';
    } else if (questionText.includes('Critical Reasoning')) {
      return 'Critical Reasoning';
    }
    return 'Multiple Choice'; // Default type
  }

  private static determineSubType(questionText: string): string | undefined {
    if (questionText.includes('weaken')) return 'Weakening the Argument';
    if (questionText.includes('strengthen')) return 'Strengthening the Argument';
    if (questionText.includes('assumption')) return 'Finding the Assumption';
    if (questionText.includes('evaluate')) return 'Evaluating the Conclusion';
    if (questionText.includes('conclusion')) return 'Identifying the Conclusion';
    if (questionText.includes('premise')) return 'Identifying the Premise';
    if (questionText.includes('paradox')) return 'Resolving the Paradox';
    if (questionText.includes('infer')) return 'Inference';
    if (questionText.includes('method')) return 'Method of Argument';
    if (questionText.includes('flaw')) return 'Flaw in the Argument';
    return undefined;
  }

  private static determineDifficulty(questionText: string): number {
    // Simple heuristic based on question length and complexity
    const length = questionText.length;
    if (length < 100) return 1;
    if (length < 200) return 2;
    if (length < 300) return 3;
    if (length < 400) return 4;
    return 5;
  }

  private static determineCategory(questionText: string): string {
    if (questionText.includes('Critical Reasoning')) return 'Verbal';
    if (questionText.includes('Reading Comprehension')) return 'Verbal';
    if (questionText.includes('Sentence Correction')) return 'Verbal';
    if (questionText.includes('Problem Solving')) return 'Quantitative';
    if (questionText.includes('Data Sufficiency')) return 'Quantitative';
    return 'Verbal'; // Default category
  }

  private static generateTags(questionText: string): string[] {
    const tags: string[] = [];
    if (questionText.includes('Critical Reasoning')) tags.push('critical-reasoning');
    if (questionText.includes('Reading Comprehension')) tags.push('reading-comprehension');
    if (questionText.includes('Sentence Correction')) tags.push('sentence-correction');
    if (questionText.includes('Problem Solving')) tags.push('problem-solving');
    if (questionText.includes('Data Sufficiency')) tags.push('data-sufficiency');
    return tags;
  }

  public static async importChapterPDF(
    chapter: number,
    questionPdfPath: string,
    answerPdfPath?: string
  ): Promise<number> {
    try {
      // Read and parse questions PDF
      const questionsBuffer = await this.readPDF(questionPdfPath);
      const questions = await this.parseQuestionsPDF(questionsBuffer);

      // Read and parse answers PDF if provided
      let answers: ParsedAnswer[] = [];
      if (answerPdfPath) {
        const answersBuffer = await this.readPDF(answerPdfPath);
        answers = await this.parseAnswersPDF(answersBuffer);
      }

      // Match questions with answers and create QuestionBag entries
      const questionBagEntries = questions.map(question => {
        const answer = answers.find(a => a.questionNumber === question.questionNumber);
        const questionType = this.determineQuestionType(question.questionText);
        
        return {
          questionText: question.questionText,
          questionType,
          subType: questionType === 'Critical Reasoning' ? this.determineSubType(question.questionText) : undefined,
          options: questionType === 'Multiple Choice' ? question.options : [],
          correctAnswer: answer?.correctAnswer || 'Unknown',
          explanation: answer?.explanation || 'No explanation provided',
          difficulty: this.determineDifficulty(question.questionText),
          category: this.determineCategory(question.questionText),
          tags: this.generateTags(question.questionText)
        };
      });

      // Save to MongoDB
      await QuestionBag.insertMany(questionBagEntries);
      return questionBagEntries.length;
    } catch (error: any) {
      throw new Error(`Failed to import chapter PDFs: ${error.message}`);
    }
  }
} 