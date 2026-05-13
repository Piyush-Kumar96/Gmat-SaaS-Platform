/**
 * Client for `/api/my-questions/*` — tenant-scoped CRUD on the user's
 * account questions. See backend/src/routes/myQuestionsRoutes.ts.
 */
import { api } from './api';

export type MyQuestionType = 'PS' | 'DS' | 'CR' | 'RC' | string;
export type MyQuestionVisibility = 'private_to_creator' | 'shared_within_account';

export interface MyQuestion {
  _id: string;
  questionText: string;
  questionType: MyQuestionType;
  category: string;
  difficulty?: string;
  options?: Record<string, string>;
  correctAnswer?: string;
  passageText?: string;
  explanation?: string;
  source?: string;
  tags?: string[];
  visibility?: MyQuestionVisibility;
  createdByUserId?: string;
  accountId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MyQuestionInput {
  questionText: string;
  questionType: MyQuestionType;
  category: string;
  difficulty?: string;
  options?: Record<string, string>;
  correctAnswer?: string;
  passageText?: string;
  explanation?: string;
  source?: string;
  tags?: string[];
  visibility?: MyQuestionVisibility;
}

export interface ListResult {
  items: MyQuestion[];
  total: number;
  limit: number;
  skip: number;
}

export async function listMyQuestions(params?: {
  limit?: number;
  skip?: number;
  questionType?: string;
}): Promise<ListResult> {
  const res = await api.get('/my-questions', { params });
  return {
    items: res.data.items,
    total: res.data.total,
    limit: res.data.limit,
    skip: res.data.skip,
  };
}

export async function createMyQuestion(input: MyQuestionInput): Promise<MyQuestion> {
  const res = await api.post('/my-questions', { ...input, attestation: true });
  return res.data.question;
}

export async function updateMyQuestion(id: string, patch: Partial<MyQuestionInput>): Promise<MyQuestion> {
  const res = await api.put(`/my-questions/${id}`, patch);
  return res.data.question;
}

export async function deleteMyQuestion(id: string): Promise<void> {
  await api.delete(`/my-questions/${id}`);
}
