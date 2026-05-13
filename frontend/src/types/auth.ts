export type UserRole = 'guest' | 'registered' | 'monthly_pack' | 'quarterly_pack' | 'annual_pack' | 'admin';
export type SubscriptionPlan = 'free_mock' | 'monthly_pack' | 'quarterly_pack' | 'annual_pack';
export type AccountRole = 'owner' | 'admin' | 'member';

export interface ResetInfo {
  hasUsedReset: boolean;
  resetDate?: Date;
  resetCount: number;
}

export interface PlanInfo {
  plan: SubscriptionPlan;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
}

export interface User {
  _id: string;
  email: string;
  fullName: string;
  targetScore: number;
  createdAt: string;
  phoneNumber?: string;
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  planInfo: PlanInfo;
  mockTestsUsed: number;
  mockTestLimit: number;
  resetInfo: ResetInfo;
  // Tenancy. Populated for users created post-migration; older users may
  // have these undefined until they re-login after a profile fetch.
  accountId?: string;
  accountRole?: AccountRole;
  legacyAccessEnabled?: boolean;
  restrictedToOwnQuestions?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  fullName: string;
  targetScore: number;
  phoneNumber?: string;
  subscriptionPlan?: SubscriptionPlan;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn?: string;
}

export interface UserStats {
  totalQuizzes: number;
  averageScore: number;
  questionTypeStats?: Array<{
    type: string;
    total: number;
    correct: number;
    percentage: number;
  }>;
}

export interface UserProfile {
  user: User;
  stats: UserStats;
}
