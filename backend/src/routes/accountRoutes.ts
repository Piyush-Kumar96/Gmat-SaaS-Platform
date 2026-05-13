/**
 * /api/account/* — account management for the caller's tenancy.
 *
 * Available to authenticated users:
 *   GET  /                           — read caller's account
 *   PATCH /                          — update name (owner only)
 *   GET  /members                    — list members (owner / admin)
 *   POST /members/invite             — invite by email (owner / admin)
 *   PATCH /members/:userId/role      — change role (owner only)
 *   DELETE /members/:userId          — remove member (owner only, no self)
 *   GET  /invites                    — list pending invites (owner / admin)
 *   DELETE /invites/:inviteId        — revoke a pending invite (owner / admin)
 *
 * Public:
 *   GET  /invites/preview/:token     — preview an invite (account name + role)
 *   POST /invites/accept/:token      — accept invite, create User, return auth
 *
 * Cross-account access is impossible — every read/write is scoped by
 * `req.user.accountId` from the auth middleware. Super-admin (platform-level
 * `role='admin'`) is intentionally NOT given a "see all accounts" path here;
 * that lives under /api/admin/* in adminRoutes.ts (Phase 4).
 */
import express, { Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/roleAuth';
import { Account } from '../models/Account';
import { User } from '../models/User';
import { AccountInvite, generateInviteToken, DEFAULT_INVITE_TTL_MS } from '../models/AccountInvite';
import { RefreshToken } from '../models/RefreshToken';

const router = express.Router();

const JWT_SECRET: string = process.env.JWT_SECRET || 'development-jwt-secret-do-not-use-in-production';
const JWT_EXPIRY: string = process.env.JWT_EXPIRY || '1h';

// Mirror authRoutes.generateTokens. Kept inline to avoid refactoring the
// auth surface in this iteration; consolidate when we touch authRoutes again.
async function issueTokensFor(userId: string, deviceInfo?: string) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
  const refreshTokenString = crypto.randomBytes(40).toString('hex');
  const refreshExpiry = new Date();
  refreshExpiry.setDate(refreshExpiry.getDate() + 7);
  await RefreshToken.create({
    userId,
    token: refreshTokenString,
    expiresAt: refreshExpiry,
    deviceInfo,
  });
  return { accessToken, refreshToken: refreshTokenString, refreshTokenExpiry: refreshExpiry };
}

const isOwner = (req: AuthRequest) => req.user?.accountRole === 'owner';
const isOwnerOrAdmin = (req: AuthRequest) =>
  req.user?.accountRole === 'owner' || req.user?.accountRole === 'admin';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function buildInviteLink(req: express.Request, token: string): string {
  // Frontend route convention. In dev the API host differs from the SPA host;
  // the public origin is best read from an env var so the link points to the
  // right place (CRA on :3000 in dev, Cloudflare-fronted host in prod).
  const base = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')?.replace(/:\d+$/, ':3000')}`;
  return `${base}/accept-invite?token=${token}`;
}

// ---- Authenticated routes ----------------------------------------------

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user?.accountId) {
    return res.status(404).json({ success: false, message: 'No account on user.' });
  }
  const account = await Account.findById(req.user.accountId).lean();
  if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });
  return res.json({ success: true, account, accountRole: req.user.accountRole });
});

router.patch('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isOwner(req)) {
    return res.status(403).json({ success: false, message: 'Owner only.' });
  }
  const update: any = {};
  if (typeof req.body?.name === 'string' && req.body.name.trim().length >= 2) {
    update.name = req.body.name.trim();
  }
  if (typeof req.body?.billingContactEmail === 'string' && isEmail(req.body.billingContactEmail)) {
    update.billingContactEmail = req.body.billingContactEmail.toLowerCase();
  }
  if (typeof req.body?.gstNumber === 'string') {
    update.gstNumber = req.body.gstNumber.trim();
  }
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ success: false, message: 'Nothing to update.' });
  }
  const account = await Account.findByIdAndUpdate(req.user!.accountId, update, { new: true });
  return res.json({ success: true, account });
});

router.get('/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isOwnerOrAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Owner or admin only.' });
  }
  const members = await User.find(
    { accountId: req.user!.accountId },
    { email: 1, fullName: 1, accountRole: 1, role: 1, createdAt: 1 }
  ).sort({ createdAt: 1 }).lean();
  return res.json({ success: true, members });
});

router.post('/members/invite', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isOwnerOrAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Owner or admin only.' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const accountRole: 'admin' | 'member' = req.body?.accountRole === 'admin' ? 'admin' : 'member';
  if (!email || !isEmail(email)) {
    return res.status(400).json({ success: false, message: 'A valid email is required.' });
  }

  // Block invite if there's already a user in this account with that email.
  const existing = await User.findOne({ email, accountId: req.user!.accountId });
  if (existing) {
    return res.status(409).json({ success: false, message: 'A member with that email is already in this account.' });
  }

  // Reuse a still-pending invite if one exists for the same email + account.
  let invite = await AccountInvite.findOne({
    accountId: req.user!.accountId,
    email,
    status: 'pending',
  });
  if (invite && invite.expiresAt < new Date()) {
    invite.status = 'expired';
    await invite.save();
    invite = null;
  }
  if (!invite) {
    invite = await AccountInvite.create({
      accountId: req.user!.accountId,
      email,
      invitedByUserId: new mongoose.Types.ObjectId(req.user!.userId),
      accountRole,
      token: generateInviteToken(),
      expiresAt: new Date(Date.now() + DEFAULT_INVITE_TTL_MS),
    });
  } else {
    invite.accountRole = accountRole;
    await invite.save();
  }

  return res.status(201).json({
    success: true,
    invite: {
      id: invite._id,
      email: invite.email,
      accountRole: invite.accountRole,
      expiresAt: invite.expiresAt,
      token: invite.token,
      link: buildInviteLink(req, invite.token),
    },
  });
});

router.patch('/members/:userId/role', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isOwner(req)) {
    return res.status(403).json({ success: false, message: 'Owner only.' });
  }
  const target = await User.findOne({ _id: req.params.userId, accountId: req.user!.accountId });
  if (!target) return res.status(404).json({ success: false, message: 'Member not found in your account.' });
  if (target._id.toString() === req.user!.userId) {
    return res.status(400).json({ success: false, message: 'Cannot change your own role.' });
  }
  const newRole = req.body?.accountRole;
  if (newRole !== 'admin' && newRole !== 'member') {
    return res.status(400).json({ success: false, message: 'accountRole must be admin or member.' });
  }
  target.accountRole = newRole;
  await target.save();
  return res.json({ success: true });
});

router.delete('/members/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isOwner(req)) {
    return res.status(403).json({ success: false, message: 'Owner only.' });
  }
  if (req.params.userId === req.user!.userId) {
    return res.status(400).json({ success: false, message: 'Cannot remove yourself. Transfer ownership first.' });
  }
  const target = await User.findOne({ _id: req.params.userId, accountId: req.user!.accountId });
  if (!target) return res.status(404).json({ success: false, message: 'Member not found.' });
  // Soft-detach by deleting the user. Their question creations remain in the
  // account (createdByUserId stays as a tombstone reference).
  await target.deleteOne();
  return res.json({ success: true });
});

router.get('/invites', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isOwnerOrAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Owner or admin only.' });
  }
  const invites = await AccountInvite.find({
    accountId: req.user!.accountId,
    status: 'pending',
  }).sort({ createdAt: -1 }).lean();
  return res.json({ success: true, invites });
});

router.delete('/invites/:inviteId', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isOwnerOrAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Owner or admin only.' });
  }
  const inv = await AccountInvite.findOne({
    _id: req.params.inviteId,
    accountId: req.user!.accountId,
  });
  if (!inv) return res.status(404).json({ success: false, message: 'Invite not found.' });
  if (inv.status !== 'pending') {
    return res.status(400).json({ success: false, message: `Invite is already ${inv.status}.` });
  }
  inv.status = 'revoked';
  await inv.save();
  return res.json({ success: true });
});

// ---- Public invite-acceptance routes -----------------------------------

router.get('/invites/preview/:token', async (req, res) => {
  const inv = await AccountInvite.findOne({ token: req.params.token }).lean();
  if (!inv) return res.status(404).json({ success: false, message: 'Invite not found.' });
  if (inv.status !== 'pending') {
    return res.status(410).json({ success: false, message: `Invite is ${inv.status}.` });
  }
  if (inv.expiresAt < new Date()) {
    return res.status(410).json({ success: false, message: 'Invite has expired.' });
  }
  const account = await Account.findById(inv.accountId, { name: 1, type: 1 }).lean();
  return res.json({
    success: true,
    invite: {
      email: inv.email,
      accountRole: inv.accountRole,
      account: account ? { name: account.name, type: account.type } : null,
    },
  });
});

router.post('/invites/accept/:token', async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const password = String(req.body?.password || '');
  if (fullName.length < 2) {
    return res.status(400).json({ success: false, message: 'Full name is required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  const inv = await AccountInvite.findOne({ token: req.params.token });
  if (!inv) return res.status(404).json({ success: false, message: 'Invite not found.' });
  if (inv.status !== 'pending') {
    return res.status(410).json({ success: false, message: `Invite is ${inv.status}.` });
  }
  if (inv.expiresAt < new Date()) {
    inv.status = 'expired';
    await inv.save();
    return res.status(410).json({ success: false, message: 'Invite has expired.' });
  }

  // Email collision check — invite-accept can't take over an existing user.
  const dup = await User.findOne({ email: inv.email });
  if (dup) {
    return res.status(409).json({
      success: false,
      message: 'A user with this email already exists. Please sign in instead and ask the inviter to switch your account.',
    });
  }

  const user = await User.create({
    email: inv.email,
    password, // hashed by User pre-save hook
    fullName,
    role: 'registered',
    subscriptionPlan: 'free_mock',
    accountId: inv.accountId,
    accountRole: inv.becomesOwner ? 'owner' : inv.accountRole,
    legacyAccessEnabled: false,
  });

  // If this invite was a business-owner handoff (super-admin created the
  // account with a placeholder ownerUserId), rebind Account.ownerUserId
  // to the new user now that they exist.
  if (inv.becomesOwner) {
    await Account.findByIdAndUpdate(inv.accountId, { ownerUserId: user._id });
  }

  inv.status = 'accepted';
  inv.acceptedUserId = user._id;
  await inv.save();

  const deviceInfo = req.headers['user-agent'] || '';
  const { accessToken, refreshToken, refreshTokenExpiry } = await issueTokensFor(user._id.toString(), deviceInfo);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: refreshTokenExpiry,
  });

  return res.status(201).json({
    success: true,
    token: accessToken,
    user: {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      accountId: user.accountId,
      accountRole: user.accountRole,
    },
  });
});

export default router;
