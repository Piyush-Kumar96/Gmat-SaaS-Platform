import mongoose from 'mongoose';

export type PaymentStatus = 'created' | 'attempted' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type PaymentMethod = 'card' | 'netbanking' | 'wallet' | 'upi' | 'emi' | 'paylater';

export interface IPayment extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number; // Amount in paisa (Razorpay format)
  currency: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  description: string;
  subscriptionPlan: string;
  receipt: string;
  notes?: Record<string, any>;
  failureReason?: string;
  refundId?: string;
  refundAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true,
  },
  razorpayPaymentId: {
    type: String,
    sparse: true, // Allows multiple null values but ensures uniqueness for non-null values
  },
  razorpaySignature: {
    type: String,
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
  status: {
    type: String,
    enum: ['created', 'attempted', 'paid', 'failed', 'cancelled', 'refunded'],
    default: 'created',
  },
  method: {
    type: String,
    enum: ['card', 'netbanking', 'wallet', 'upi', 'emi', 'paylater'],
  },
  description: {
    type: String,
    required: true,
  },
  subscriptionPlan: {
    type: String,
    enum: ['monthly_pack', 'quarterly_pack', 'annual_pack'],
    required: true,
  },
  receipt: {
    type: String,
    required: true,
  },
  notes: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  failureReason: {
    type: String,
  },
  refundId: {
    type: String,
  },
  refundAmount: {
    type: Number,
    min: 0,
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
});

// Indexes for better query performance
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ status: 1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema); 