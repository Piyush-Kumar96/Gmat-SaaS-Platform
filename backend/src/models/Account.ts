/**
 * Account model — tenancy boundary.
 *
 * Every User belongs to exactly one Account. Questions, quizzes, and ledger
 * entries are scoped by `accountId` so that:
 *   - An individual's data is private to their personal account.
 *   - A business's data is shared across that business's members and
 *     isolated from every other business and from individuals.
 *   - The legacy OG pool is held by the platform super-admin's account and
 *     exposed to other users only via the per-user `legacyAccessEnabled`
 *     toggle on the User model.
 *
 * See `LAUNCH_BUILD_PLAN.md` (Phase 1) for the full design.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export type AccountType = 'individual' | 'business';
export type BusinessStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

export interface IAccount extends Document {
  type: AccountType;
  name: string;
  ownerUserId: Types.ObjectId;

  // Business-only fields. Left undefined for individual accounts.
  businessStatus?: BusinessStatus;
  maxMembers?: number;
  billingContactEmail?: string;
  gstNumber?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    type: {
      type: String,
      enum: ['individual', 'business'],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    businessStatus: {
      type: String,
      enum: ['trial', 'active', 'suspended', 'cancelled'],
    },
    maxMembers: { type: Number },
    billingContactEmail: { type: String, trim: true, lowercase: true },
    gstNumber: { type: String, trim: true },
  },
  { timestamps: true }
);

AccountSchema.index({ ownerUserId: 1 });
AccountSchema.index({ type: 1 });

export const Account = mongoose.model<IAccount>('Account', AccountSchema);
