/**
 * AccountInvite — token-based access for joining a Business account.
 *
 * Flow:
 *   1. Owner / admin (or super-admin during business-account creation)
 *      generates an invite by submitting an email + intended accountRole.
 *      The route returns a single-use token + invite link.
 *   2. The invitee opens the link, fills name + password, and posts to
 *      `POST /api/account/invites/:token/accept`. The route consumes the
 *      token, creates a User with that account/role, returns auth cookies.
 *   3. The token is marked `accepted` and bound to the new userId.
 *
 * Tokens expire after 14 days by default. Owners/admins can revoke a
 * pending invite from the members page.
 *
 * Email delivery is OUT OF SCOPE for this iteration — the route returns the
 * invite link in JSON and the inviter pastes it into WhatsApp / email
 * manually. SMTP / SendGrid hookup is a later milestone.
 */
import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface IAccountInvite extends Document {
  accountId: mongoose.Types.ObjectId;
  email: string;
  invitedByUserId: mongoose.Types.ObjectId;
  accountRole: 'admin' | 'member';
  // When true, accepting this invite promotes the new user to account owner
  // and rebinds Account.ownerUserId to them. Used when super-admin creates a
  // business account and hands it off to the real owner via invite.
  becomesOwner?: boolean;
  token: string;
  status: InviteStatus;
  expiresAt: Date;
  acceptedUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const generateInviteToken = (): string =>
  crypto.randomBytes(24).toString('hex');

export const DEFAULT_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const AccountInviteSchema = new Schema<IAccountInvite>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountRole: { type: String, enum: ['admin', 'member'], default: 'member' },
    becomesOwner: { type: Boolean, default: false },
    token: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AccountInviteSchema.index({ accountId: 1, status: 1 });
AccountInviteSchema.index({ email: 1, status: 1 });

export const AccountInvite = mongoose.model<IAccountInvite>('AccountInvite', AccountInviteSchema);
