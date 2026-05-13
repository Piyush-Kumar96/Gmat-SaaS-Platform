import mongoose from 'mongoose';

export type SubscriptionStatus = 'created' | 'authenticated' | 'active' | 'paused' | 'halted' | 'cancelled' | 'completed' | 'expired';
export type SubscriptionPlan = 'monthly_pack' | 'quarterly_pack' | 'annual_pack';

export interface ISubscription extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  razorpaySubscriptionId?: string;
  razorpayPlanId?: string;
  razorpayCustomerId?: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate?: Date;
  amount: number; // Amount in paisa
  currency: string;
  totalCount?: number; // Total billing cycles
  paidCount: number; // Completed billing cycles
  remainingCount?: number; // Remaining billing cycles
  shortUrl?: string; // Razorpay payment link
  isActive: boolean;
  cancelledAt?: Date;
  cancelReason?: string;
  notes?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  razorpaySubscriptionId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
  },
  razorpayPlanId: {
    type: String,
  },
  razorpayCustomerId: {
    type: String,
  },
  plan: {
    type: String,
    enum: ['monthly_pack', 'quarterly_pack', 'annual_pack'],
    required: true,
  },
  status: {
    type: String,
    enum: ['created', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired'],
    default: 'created',
  },
  currentPeriodStart: {
    type: Date,
    required: true,
  },
  currentPeriodEnd: {
    type: Date,
    required: true,
  },
  nextBillingDate: {
    type: Date,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
    default: 'INR',
  },
  totalCount: {
    type: Number,
    min: 1,
  },
  paidCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  remainingCount: {
    type: Number,
    min: 0,
  },
  shortUrl: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  cancelledAt: {
    type: Date,
  },
  cancelReason: {
    type: String,
  },
  notes: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ razorpaySubscriptionId: 1 });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });

// Method to check if subscription is currently active
subscriptionSchema.methods.isCurrentlyActive = function(): boolean {
  const now = new Date();
  return this.isActive && 
         this.status === 'active' && 
         this.currentPeriodStart <= now && 
         this.currentPeriodEnd >= now;
};

// Method to check if subscription is expired
subscriptionSchema.methods.isExpired = function(): boolean {
  const now = new Date();
  return this.currentPeriodEnd < now;
};

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema); 