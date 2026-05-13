/**
 * Client for super-admin account management endpoints under /api/admin/*.
 * See backend/src/routes/adminRoutes.ts.
 */
import { api } from './api';

export interface AdminAccountListItem {
  _id: string;
  type: 'individual' | 'business';
  name: string;
  ownerUserId: string;
  businessStatus?: string;
  maxMembers?: number;
  memberCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessAccountInput {
  name: string;
  ownerEmail: string;
  maxMembers?: number;
}

export interface CreateBusinessAccountResult {
  account: AdminAccountListItem;
  invite: {
    id: string;
    email: string;
    token: string;
    link: string;
    expiresAt: string;
  };
}

export async function listAdminAccounts(): Promise<AdminAccountListItem[]> {
  const res = await api.get('/admin/accounts');
  return res.data.accounts;
}

export async function createBusinessAccount(input: CreateBusinessAccountInput): Promise<CreateBusinessAccountResult> {
  const res = await api.post('/admin/accounts', input);
  return { account: res.data.account, invite: res.data.invite };
}

export async function setUserLegacyAccess(userId: string, enabled: boolean): Promise<void> {
  await api.patch(`/admin/users/${userId}/legacy-access`, { enabled });
}
