/**
 * LeadRequest — public access-request capture.
 *
 * Public signup is disabled. Visitors fill the "Request Access" form on the
 * /register page; the form posts to `POST /api/leads` and creates a row in
 * this collection. The super-admin reviews leads in the CRM and manually
 * provisions a real User account when ready.
 *
 * See `LAUNCH_BUILD_PLAN.md` Phase 1b.
 */
import mongoose, { Document, Schema } from 'mongoose';

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'rejected';
export type LeadSource = 'login_page' | 'whatsapp' | 'referral' | 'other';

export interface ILeadRequest extends Document {
  name: string;
  email: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  notes?: string;
  // Set when status flips to 'converted' so the CRM can link lead → user.
  convertedUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadRequestSchema = new Schema<ILeadRequest>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    source: {
      type: String,
      enum: ['login_page', 'whatsapp', 'referral', 'other'],
      default: 'login_page',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'rejected'],
      default: 'new',
    },
    notes: { type: String, trim: true },
    convertedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

LeadRequestSchema.index({ email: 1 });
LeadRequestSchema.index({ status: 1, createdAt: -1 });

export const LeadRequest = mongoose.model<ILeadRequest>('LeadRequest', LeadRequestSchema);
