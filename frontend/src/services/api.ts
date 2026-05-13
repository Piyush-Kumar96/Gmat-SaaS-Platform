import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { QuizItem, QuizConfig, QuizSubmission } from '../types';

// Use localhost:5006 as the fallback
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5006/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Required so the httpOnly refreshToken cookie set at /auth/login travels
  // back to /auth/refresh-token. Without this, axios drops cross-origin cookies.
  withCredentials: true,
});

// Add auth token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Silent access-token refresh ---------------------------------------
// Single in-flight refresh promise + queue of waiters so 10 concurrent 401s
// from a page like My Quizzes only fire ONE /auth/refresh-token call.
let refreshInFlight: Promise<string | null> | null = null;

const performRefresh = async (): Promise<string | null> => {
  try {
    // Bare axios call — using `api` would trip its own response interceptor.
    const res = await axios.post(
      `${API_URL}/auth/refresh-token`,
      {},
      { withCredentials: true }
    );
    const newToken: string | undefined = res.data?.token;
    if (!newToken) return null;
    localStorage.setItem('token', newToken);
    return newToken;
  } catch {
    return null;
  }
};

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const forceLogout = () => {
  localStorage.removeItem('token');
  const here = window.location.pathname + window.location.search;
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign(`/login?next=${encodeURIComponent(here)}`);
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url || '';

    // Don't try to refresh on the auth endpoints themselves — the user is
    // either logging in (wrong password) or refresh just failed.
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh-token');

    if (status === 401 && original && !isAuthEndpoint) {
      // First 401 on this request → try a silent refresh + retry once.
      if (!original._retried) {
        original._retried = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          original.headers = original.headers ?? {};
          (original.headers as any)['Authorization'] = `Bearer ${newToken}`;
          return api.request(original);
        }
        // Refresh failed → genuine session expiry. Bounce to login.
        if (localStorage.getItem('token')) forceLogout();
      } else {
        // Retry itself 401'd. The new access token is valid (refresh
        // returned 200) but `authMiddleware` still rejected it — usually
        // because the userId in the token no longer maps to a User in
        // the current DB (e.g. user deleted, DB swapped, or the legacy
        // string-_id seed user hits the ObjectId cast mismatch). Treat
        // the session as dead so the UI doesn't sit on a broken loop.
        if (localStorage.getItem('token')) forceLogout();
      }
    }
    return Promise.reject(error);
  }
);

export { api };

export const getQuiz = async (config: QuizConfig) => {
  const response = await api.get('/quiz/quizzes', {
    params: config
  });
  return response.data;
};

export interface SubmitQuizExtras {
  // Quiz mode discriminator. Drives analytics + later "retry with same config".
  mode?: 'custom' | 'gmat-focus' | 'di-sectional';
  filtersUsed?: Record<string, any>;
  // Per-question metadata. Optional today — old call sites pass `undefined`
  // and the backend falls back to averaged time. New flows that track
  // per-question time should populate this.
  itemMeta?: Record<string, {
    timeSpentMs?: number;
    flaggedForReview?: boolean;
    answeredAt?: string;
  }>;
}

export const submitQuiz = async (
  quizId: string,
  answers: Record<string, any>,
  timeSpent: number,
  extras: SubmitQuizExtras = {}
): Promise<QuizSubmission> => {
  try {
    const response = await api.post(`/quiz/quizzes/submit`, {
      quizId,
      answers,
      timeSpent,
      ...extras,
    });

    // Validate that the response contains the required fields
    const data = response.data;
    if (!data || typeof data.score !== 'number' || !Array.isArray(data.results)) {
      throw new Error('Invalid response format from server');
    }

    return data;
  } catch (error) {
    console.error('Error in submitQuiz:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to submit quiz');
    }
  }
};

export const importPDF = async (file: File, type: 'questions' | 'answers' | 'mixed' = 'mixed') => {
  const formData = new FormData();
  formData.append('pdf', file);
  formData.append('type', type);

  const response = await api.post('/quiz/import-pdf', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getQuizItems = async (page: number, limit: number) => {
  const response = await api.get('/quiz-items', {
    params: { page, limit }
  });
  return response.data;
};

export const deleteQuizItem = async (id: string) => {
  const response = await api.delete(`/quiz-items/${id}`);
  return response.data;
};

export const deleteQuestionBagItem = async (id: string) => {
  try {
    const response = await api.delete(`/question-bag-v2/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting question from question bag:', error);
    throw error;
  }
};

/**
 * Create a new question in QuestionBagV2
 * @param questionData Question data to create
 */
export const createQuestionBagItem = async (questionData: any) => {
  try {
    const response = await api.post('/question-bag-v2', {
      ...questionData,
      // Add a field to indicate this question was added from the platform
      source: questionData.source || 'Added on the Platform',
      sourceDetails: {
        ...(questionData.sourceDetails || {}),
        addedFromPlatform: true,
        addedDate: new Date().toISOString()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error creating question in question bag:', error);
    throw error;
  }
};

interface QuestionBagFilters {
  page?: number;
  limit?: number;
  category?: string;
  questionType?: string;
  difficulty?: number;
  tags?: string[];

  // Add multi-select filter fields
  categories?: string[];
  questionTypes?: string[];
  difficulties?: number[];

  // Opt-in: when true, the random pull is restricted to docs the editor
  // marked `readyForQuiz`. Off by default — see go-live plan §2A item 1.
  onlyReadyForQuiz?: boolean;
}

export const getQuestionBag = async (filters: QuestionBagFilters = {}) => {
  const response = await api.get('/quiz-items/question-bag', {
    params: {
      page: filters.page || 1,
      limit: filters.limit || 10,
      category: filters.category,
      questionType: filters.questionType,
      difficulty: filters.difficulty,
      tags: filters.tags?.join(',')
    }
  });
  return response.data;
};

export const getUserProfile = async () => {
  // Use the shared axios `api` instance so the silent refresh-token
  // interceptor applies here too (was previously a bare fetch, which
  // bypassed refresh and forced a logout on access-token expiry).
  const response = await api.get('/auth/profile');
  return response.data;
};

/**
 * Self-reset of the repeat-question ledger. Server enforces plan + cooldown
 * gates; UI should only call this when `repeatLedger.eligibility.allowed`.
 * `questionType` scopes the reset to a single type (e.g. "Critical Reasoning").
 */
export const resetRepeatLedger = async (questionType?: string) => {
  const response = await api.post('/auth/profile/repeats/reset', questionType ? { questionType } : {});
  return response.data as {
    success: boolean;
    deletedCount: number;
    scope: { questionType?: string };
    resetAt: string;
  };
};

export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  const { token, user } = response.data;
  
  // Store token in localStorage
  localStorage.setItem('token', token);
  
  return user;
};

export const register = async (userData: { email: string; password: string; fullName: string; }) => {
  const response = await api.post('/auth/register', userData);
  const { token, user } = response.data;
  
  // Store token in localStorage
  localStorage.setItem('token', token);
  
  return user;
};

export const logout = () => {
  localStorage.removeItem('token');
};

/**
 * Get random questions from QuestionBag for a quiz
 * @param count Number of questions to fetch (default: 20)
 * @param timeLimit Time limit in minutes (default: 30)
 * @param filters Optional filters (category, questionType, difficulty)
 */
export const getRandomQuestions = async (count = 20, timeLimit = 30, filters: Partial<QuestionBagFilters> = {}) => {
  const response = await api.get('/quiz-items/random-questions', {
    params: {
      count,
      timeLimit,
      ...filters
    }
  });
  return response.data;
};

/**
 * Get random questions from QuestionBagV2 for a quiz
 * @param count Number of questions to fetch (default: 20)
 * @param timeLimit Time limit in minutes (default: 30)
 * @param filters Optional filters (category, questionType, difficulty)
 */
export const getRandomQuestionsV2 = async (count = 20, timeLimit = 30, filters: Partial<QuestionBagFilters> = {}) => {
  const response = await api.post('/question-bag-v2/random', {
    count,
    timeLimit,
    filters
  });
  return response.data;
};

/**
 * Get questions from QuestionBagV2 with pagination and filtering
 * @param filters Optional filters and pagination parameters
 */
export const getQuestionBagV2 = async (
  filters: QuestionBagFilters & { search?: string; readyForQuiz?: 'all' | 'ready' | 'notReady' } = {}
) => {
  const response = await api.get('/question-bag-v2', {
    params: {
      page: filters.page || 1,
      limit: filters.limit || 10,
      category: filters.category,
      questionType: filters.questionType,
      difficulty: filters.difficulty,
      tags: filters.tags?.join(','),
      search: filters.search,
      // Server only acts on 'ready' / 'notReady'; 'all' / undefined → no filter.
      readyForQuiz: filters.readyForQuiz && filters.readyForQuiz !== 'all' ? filters.readyForQuiz : undefined,
    }
  });
  return response.data;
};

/**
 * Update a question in QuestionBagV2
 * @param id Question ID
 * @param questionData Updated question data
 */
export const updateQuestionBagV2 = async (id: string, questionData: any) => {
  const response = await api.put(`/question-bag-v2/${id}`, questionData);
  return response.data;
};

/**
 * Get available question types
 * Note: Currently returns hardcoded values, should be replaced with API call when available
 */
export const getQuestionTypes = async () => {
  // In a real implementation, this would be an API call
  // For now, return common GMAT Focus Edition question types
  return [
    'Reading Comprehension',
    'Critical Reasoning',
    'Data Sufficiency',
    'Problem Solving'
  ];
};

/**
 * Get available categories
 * Note: Currently returns hardcoded values, should be replaced with API call when available
 */
export const getCategories = async () => {
  try {
    const response = await api.get('/quiz-items/categories');
    return response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

// Payment API functions
export const createPaymentOrder = async (plan: string) => {
  const response = await api.post('/payments/create-order', { plan });
  return response.data;
};

export const verifyPayment = async (paymentData: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) => {
  const response = await api.post('/payments/verify', paymentData);
  return response.data;
};

export const getPaymentHistory = async () => {
  const response = await api.get('/payments/history');
  return response.data;
};

export const getSubscriptionPlans = async () => {
  const response = await api.get('/payments/plans');
  return response.data.data; // Return the nested data object that contains plans
};

// ============ QuestionBagV3 (Data Insights) API Functions ============

/**
 * Get random Data Insights questions from QuestionBagV3 for a quiz
 * @param count Number of questions to fetch (default: 20)
 * @param timeLimit Time limit in minutes (default: 45)
 * @param filters Optional filters (questionTypes, difficulty)
 */
export const getRandomQuestionsV3 = async (count = 20, timeLimit = 45, filters: Partial<QuestionBagFilters> = {}) => {
  const response = await api.post('/question-bag-v3/random', {
    count,
    timeLimit,
    filters
  });
  return response.data;
};

/**
 * GMAT Focus Verbal section. RC is migrating to V3 but the backfill is
 * incomplete — until V3 carries real RC content we fall back to V2 so the
 * quiz isn't empty. Order: [RC passages...] then [CR questions...] so a
 * passage's sub-questions stay contiguous.
 */
export const getVerbalQuiz = async (
  count = 23,
  timeLimit = 45,
  rcShare = 0.5,
) => {
  const rcCount = Math.max(1, Math.round(count * rcShare));
  const crCount = Math.max(0, count - rcCount);

  const [rcQuiz, crQuiz] = await Promise.all([
    getRcQuiz(rcCount, timeLimit),
    getRandomQuestionsV2(crCount, timeLimit, { questionTypes: ['Critical Reasoning'] as any }),
  ]);

  return {
    quizId: crQuiz.quizId,                                    // single quizId for grading bookkeeping
    questions: [...(rcQuiz.questions || []), ...(crQuiz.questions || [])],
    timeLimit,
    rcSourcedFrom: rcQuiz.source,
    rcCount: (rcQuiz.questions || []).length,
    crCount: (crQuiz.questions || []).length,
  };
};

/**
 * Data Insights quiz: V3 holds DI-GT, DI-MSR, DI-TPA today but the DI-DS
 * bank is sparse (legacy DS lives in V2 as `Data Sufficiency`). To honour
 * the GMAT Focus DI section composition we pull the V3 types + a slice of
 * V2 Data Sufficiency in parallel and merge.
 *
 * Default DS share: ~25% (5 of 20). The remaining count comes from V3 with
 * MSR sub-questions weighted server-side as multiple scored items.
 */
export const getDataInsightsQuiz = async (
  count = 20,
  timeLimit = 45,
  dsShare = 0.25,
) => {
  const dsCount = Math.max(1, Math.round(count * dsShare));
  const otherCount = Math.max(0, count - dsCount);

  const [v3Quiz, dsQuiz] = await Promise.all([
    getRandomQuestionsV3(otherCount, timeLimit, {
      questionTypes: ['DI-GT', 'DI-MSR', 'DI-TPA'] as any,
    }).catch(() => ({ questions: [] as any[] })),
    getRandomQuestionsV2(dsCount, timeLimit, {
      questionTypes: ['Data Sufficiency'] as any,
    }).catch(() => ({ questions: [] as any[] })),
  ]);

  return {
    quizId: v3Quiz.quizId,
    questions: [...(v3Quiz.questions || []), ...(dsQuiz.questions || [])],
    timeLimit,
    diSourcedFromV3: (v3Quiz.questions || []).length,
    dsSourcedFromV2: (dsQuiz.questions || []).length,
  };
};

/**
 * RC quiz with V3-first / V2-fallback. V3 returns 404 when empty (no RC
 * extracted yet), so we transparently fall back to V2 — passage-grouped via
 * `getRandomQuestionsV2` which honours `questionTypes: ['Reading Comprehension']`.
 */
export const getRcQuiz = async (count: number, timeLimit: number) => {
  try {
    const v3 = await getRandomQuestionsV3(count, timeLimit, { questionTypes: ['RC'] as any });
    if ((v3.questions || []).length > 0) {
      return { questions: v3.questions, quizId: v3.quizId, timeLimit: v3.timeLimit, source: 'v3' as const };
    }
  } catch (err) {
    // V3 returns 404 when the RC bank is empty — fall through to V2.
  }
  const v2 = await getRandomQuestionsV2(count, timeLimit, {
    questionTypes: ['Reading Comprehension'] as any,
  });
  return { questions: v2.questions, quizId: v2.quizId, timeLimit: v2.timeLimit, source: 'v2' as const };
};

/**
 * Get questions from QuestionBagV3 with pagination and filtering
 * @param filters Optional filters and pagination parameters
 */
export const getQuestionBagV3 = async (
  filters: QuestionBagFilters & { search?: string; readyForQuiz?: 'all' | 'ready' | 'notReady' } = {}
) => {
  const response = await api.get('/question-bag-v3', {
    params: {
      page: filters.page || 1,
      limit: filters.limit || 10,
      category: filters.category,
      questionType: filters.questionType,
      difficulty: filters.difficulty,
      search: filters.search,
      readyForQuiz: filters.readyForQuiz && filters.readyForQuiz !== 'all' ? filters.readyForQuiz : undefined,
    }
  });
  return response.data;
};

/**
 * Update a question in QuestionBagV3
 */
export const updateQuestionBagV3 = async (id: string, data: any) => {
  const response = await api.put(`/question-bag-v3/${id}`, data);
  return response.data;
};

/**
 * Create a new question in QuestionBagV3 (Question Forge — manual entry).
 * The backend forces entryMethod='manual' and validationStatus='perfect'.
 */
export const createQuestionBagV3 = async (data: any) => {
  const response = await api.post('/question-bag-v3', data);
  return response.data;
};

/**
 * Get a single V3 question by id (used by Forge edit mode).
 */
export const getQuestionBagV3ById = async (id: string) => {
  const response = await api.get(`/question-bag-v3/${id}`);
  return response.data;
};

/**
 * Delete a question from QuestionBagV3
 */
export const deleteQuestionBagV3 = async (id: string) => {
  const response = await api.delete(`/question-bag-v3/${id}`);
  return response.data;
};

/**
 * Get V3 question type statistics
 */
export const getV3QuestionStats = async () => {
  const response = await api.get('/question-bag-v3/stats/types');
  return response.data;
};

// Quiz history (current user). Backed by UserQuizV2 (preferred) + UserQuiz (legacy).
export interface QuizHistoryItem {
  id: string;
  quizId: string;
  // 'v2' rows carry mode + skippedCount; 'legacy' rows have neither.
  schema?: 'v2' | 'legacy';
  mode?: 'custom' | 'gmat-focus' | 'di-sectional';
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  skippedCount?: number;
  percentage: number;
  timeSpent: number;
  questionTypes: Array<{ type: string; total: number; correct: number }>;
  createdAt: string;
}

export const getMyQuizHistory = async (
  page = 1,
  limit = 50
): Promise<{ items: QuizHistoryItem[]; total: number; page: number; limit: number }> => {
  const response = await api.get('/quiz/history', { params: { page, limit } });
  return response.data;
};

export const getMyQuizAttempt = async (id: string): Promise<QuizSubmission & { createdAt: string }> => {
  const response = await api.get(`/quiz/history/${id}`);
  return response.data;
};