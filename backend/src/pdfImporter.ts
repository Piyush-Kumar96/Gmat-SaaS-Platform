import pdfParse from 'pdf-parse';
import { QuizItem } from './models/QuizItem';

interface ParsedQuizItem {
  chapter?: string;
  questionNumber?: number;
  type: string;
  questionText?: string;
  options?: string[];
  answerText?: string;
  explanationText?: string;
}

export class PDFImporter {
  private static async parseQuestionsOnly(pdfBuffer: Buffer): Promise<ParsedQuizItem[]> {
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    const lines = text.split('\n');
    const items: ParsedQuizItem[] = [];
    let currentItem: Partial<ParsedQuizItem> = {};

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentItem.questionText) {
          items.push(currentItem as ParsedQuizItem);
        }
        currentItem = {
          questionNumber: parseInt(line.match(/^\d+/)?.[0] || '0'),
          type: 'Critical Reasoning', // Default type
          questionText: line.replace(/^\d+\.\s*/, ''),
          options: []
        };
      } else if (currentItem.questionText && line.trim()) {
        if (line.match(/^[A-E]\./)) {
          currentItem.options = currentItem.options || [];
          currentItem.options.push(line.trim());
        } else {
          currentItem.questionText += ' ' + line.trim();
        }
      }
    }

    if (currentItem.questionText) {
      items.push(currentItem as ParsedQuizItem);
    }

    return items;
  }

  private static async parseAnswersOnly(pdfBuffer: Buffer): Promise<ParsedQuizItem[]> {
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    const lines = text.split('\n');
    const items: ParsedQuizItem[] = [];
    let currentItem: Partial<ParsedQuizItem> = {};

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentItem.answerText) {
          items.push(currentItem as ParsedQuizItem);
        }
        currentItem = {
          questionNumber: parseInt(line.match(/^\d+/)?.[0] || '0'),
          type: 'Critical Reasoning',
          answerText: line.replace(/^\d+\.\s*/, '')
        };
      } else if (currentItem.answerText && line.trim()) {
        currentItem.answerText += ' ' + line.trim();
      }
    }

    if (currentItem.answerText) {
      items.push(currentItem as ParsedQuizItem);
    }

    return items;
  }

  private static async parseMixed(pdfBuffer: Buffer): Promise<ParsedQuizItem[]> {
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    const lines = text.split('\n');
    const items: ParsedQuizItem[] = [];
    let currentItem: Partial<ParsedQuizItem> = {};

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentItem.questionText || currentItem.answerText) {
          items.push(currentItem as ParsedQuizItem);
        }
        currentItem = {
          questionNumber: parseInt(line.match(/^\d+/)?.[0] || '0'),
          type: 'Critical Reasoning'
        };
      } else if (line.includes('Answer:')) {
        currentItem.answerText = line.replace('Answer:', '').trim();
      } else if (line.includes('Explanation:')) {
        currentItem.explanationText = line.replace('Explanation:', '').trim();
      } else if (currentItem.questionText === undefined && line.trim()) {
        currentItem.questionText = line.trim();
      } else if (currentItem.questionText && line.match(/^[A-E]\./)) {
        currentItem.options = currentItem.options || [];
        currentItem.options.push(line.trim());
      } else if (currentItem.questionText) {
        currentItem.questionText += ' ' + line.trim();
      }
    }

    if (currentItem.questionText || currentItem.answerText) {
      items.push(currentItem as ParsedQuizItem);
    }

    return items;
  }

  public static async importPDF(pdfBuffer: Buffer, type: 'questions' | 'answers' | 'mixed' = 'mixed'): Promise<number> {
    let items: ParsedQuizItem[];

    switch (type) {
      case 'questions':
        items = await this.parseQuestionsOnly(pdfBuffer);
        break;
      case 'answers':
        items = await this.parseAnswersOnly(pdfBuffer);
        break;
      case 'mixed':
        items = await this.parseMixed(pdfBuffer);
        break;
      default:
        throw new Error('Invalid PDF type');
    }

    // Save items to MongoDB
    await QuizItem.insertMany(items);
    return items.length;
  }
}