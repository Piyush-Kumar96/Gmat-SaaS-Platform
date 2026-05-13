import { Schema, model } from 'mongoose';

export interface IQuizItem {
  chapter?: string;
  questionNumber?: number;
  type: string;
  questionType?: string;
  category?: string;
  difficulty?: number;
  tags?: string[];
  questionText?: string;
  options?: string[];
  answerText?: string;
  correctAnswer?: string;
  explanation?: string;
  explanationText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuizItemSchema = new Schema<IQuizItem>({
  chapter: String,
  questionNumber: Number,
  type: { type: String, required: true },
  questionType: String,
  category: String,
  difficulty: Number,
  tags: [String],
  questionText: String,
  options: [String],
  answerText: { type: String, alias: 'correctAnswer' },
  explanationText: { type: String, alias: 'explanation' }
}, { timestamps: true });

export const QuizItem = model<IQuizItem>('QuizItem', QuizItemSchema);