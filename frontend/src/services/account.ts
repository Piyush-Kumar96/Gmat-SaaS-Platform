/**
 * Client for /api/account/* — see backend/src/routes/accountRoutes.ts.
 */
import { api } from './api';
import { AccountRole } from '../types/auth';

export type AccountType = 'individual' | 'business';

export interface AccountInfo {
  _id: string;
  type: AccountType;
  name: string;
  ownerUserId: string;
  businessStatus?: string;
  maxMembers?: number;
  billingContactEmail?: string;
  gstNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountMember {
  _id: string;
  email: string;
  fullName: string;
  accountRole: AccountRole;
  role: string; // platform role
  createdAt: string;
}

export interface AccountInvite {
  _id: string;
  email: string;
  accountRole: 'admin' | 'member';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  token: string;
  link: string;
  createdAt?: string;
}

export interface InvitePreview {
  email: string;
  accountRole: 'admin' | 'member';
  account: { name: string; type: AccountType } | null;
}

export async function getAccount(): Promise<{ account: AccountInfo; accountRole: AccountRole }> {
  const res = await api.get('/account');
  return { account: res.data.account, accountRole: res.data.accountRole };
}

export async function updateAccount(patch: Partial<{ name: string; billingContactEmail: string; gstNumber: string }>): Promise<AccountInfo> {
  const res = await api.patch('/account', patch);
  return res.data.account;
}

export async function listMembers(): Promise<AccountMember[]> {
  const res = await api.get('/account/members');
  return res.data.members;
}

export async function inviteMember(input: { email: string; accountRole: 'admin' | 'member' }): Promise<AccountInvite> {
  const res = await api.post('/account/members/invite', input);
  return res.data.invite;
}

export async function changeMemberRole(userId: string, accountRole: 'admin' | 'member'): Promise<void> {
  await api.patch(`/account/members/${userId}/role`, { accountRole });
}

export async function removeMember(userId: string): Promise<void> {
  await api.delete(`/account/members/${userId}`);
}

export async function listInvites(): Promise<AccountInvite[]> {
  const res = await api.get('/account/invites');
  // The list endpoint returns DB rows without `link`; rebuild client-side.
  return res.data.invites.map((i: any) => ({
    ...i,
    link: buildInviteLink(i.token),
  }));
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await api.delete(`/account/invites/${inviteId}`);
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const res = await api.get(`/account/invites/preview/${token}`);
  return res.data.invite;
}

export async function acceptInvite(token: string, input: { fullName: string; password: string }): Promise<{ token: string; user: any }> {
  const res = await api.post(`/account/invites/accept/${token}`, input);
  return { token: res.data.token, user: res.data.user };
}

export function buildInviteLink(token: string): string {
  return `${window.location.origin}/accept-invite?token=${token}`;
}
