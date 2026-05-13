import mongoose from 'mongoose';

export interface IUserQuiz extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  quizId: mongoose.Types.ObjectId;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number; // in seconds
  questionTypes: {
    type: string;
    total: number;
    correct: number;
  }[];
  questions: {
    questionId: mongoose.Types.ObjectId;
    userAnswer: string;
    isCorrect: boolean;
    timeSpent: number; // in seconds
  }[];
  createdAt: Date;
}

const userQuizSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  correctAnswers: {
    type: Number,
    required: true,
  },
  timeSpent: {
    type: Number,
    required: true,
  },
  questionTypes: [{
    type: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    correct: {
      type: Number,
      required: true,
    },
  }],
  questions: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionBag',
      required: true,
    },
    userAnswer: {
      type: String,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    timeSpent: {
      type: Number,
      required: true,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const UserQuiz = mongoose.model<IUserQuiz>('UserQuiz', userQuizSchema);