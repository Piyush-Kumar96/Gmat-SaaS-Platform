/**
 * SupportRequest — contact / help requests from any visitor or user.
 *
 * Submitted via the floating "Contact Support" widget rendered site-wide
 * (`POST /api/support`). No auth required so non-registered visitors can
 * raise queries (e.g. "issue requesting an account"). When the caller is
 * authenticated the user id, email and name are captured automatically.
 *
 * Admins triage in the Admin Panel → Support tab.
 */
import mongoose, { Document, Schema } from 'mongoose';

export type SupportCategory =
  | 'account_request'
  | 'quiz_issue'
  | 'question_issue'
  | 'billing'
  | 'other';

export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface ISupportRequest extends Document {
  name: string;
  email: string;
  userId?: mongoose.Types.ObjectId;
  category: SupportCategory;
  message: string;
  status: SupportStatus;
  adminNotes?: string;
  // User-agent / page captured at submit time so we can debug "issue with quiz"
  // without playing detective.
  pageUrl?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SUPPORT_CATEGORIES: SupportCategory[] = [
  'account_request',
  'quiz_issue',
  'question_issue',
  'billing',
  'other',
];

const SupportRequestSchema = new Schema<ISupportRequest>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    category: {
      type: String,
      enum: SUPPORT_CATEGORIES,
      default: 'other',
    },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    adminNotes: { type: String, trim: true, maxlength: 4000 },
    pageUrl: { type: String, trim: true, maxlength: 500 },
    userAgent: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

SupportRequestSchema.index({ status: 1, createdAt: -1 });
SupportRequestSchema.index({ email: 1 });

export const SUPPORT_CATEGORY_VALUES = SUPPORT_CATEGORIES;

export const SupportRequest = mongoose.model<ISupportRequest>(
  'SupportRequest',
  SupportRequestSchema
);
