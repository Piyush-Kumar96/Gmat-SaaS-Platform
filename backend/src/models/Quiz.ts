import mongoose from 'mongoose';

export interface IQuiz extends mongoose.Document {
  title: string;
  description: string;
  totalQuestions: number;
  timeLimit: number; // in minutes
  difficulty: number;
  category: string;
  questions: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: 1,
  },
  timeLimit: {
    type: Number,
    required: true,
    min: 1,
  },
  difficulty: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    default: 3,
  },
  category: {
    type: String,
    required: true,
    enum: ['Quantitative', 'Verbal', 'Integrated Reasoning', 'Analytical Writing', 'Mixed'],
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestionBag',
    required: true,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
quizSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Quiz = mongoose.model<IQuiz>('Quiz', quizSchema); 