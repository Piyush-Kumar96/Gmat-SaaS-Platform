import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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

export interface IUser extends mongoose.Document {
  email: string;
  password: string;
  fullName: string;
  targetScore?: number;
  phoneNumber?: string;
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  planInfo: PlanInfo;
  mockTestsUsed: number;
  mockTestLimit: number;
  resetInfo: ResetInfo;
  razorpayCustomerId?: string; // Razorpay customer ID for subscription management

  // ---- Tenancy (Phase 1) ----
  // FK to Account. Nullable until the migration backfills every user, after
  // which all writes go through code paths that always set it. Treat as
  // required everywhere except the migration script.
  accountId?: mongoose.Types.ObjectId;
  // Role within the user's own account. Distinct from `role` (platform-level).
  // Individual users are 'owner' of their personal account by default.
  accountRole: AccountRole;
  // Per-user toggle controlled from the super-admin user-management page.
  // When true, quiz queries union the legacy / super-admin question pool
  // into this user's tenant-scoped pool. Default false.
  legacyAccessEnabled: boolean;
  // Hard per-user override for question visibility. When true, every quiz
  // query is forced to the caller's accountId regardless of the global
  // QUESTION_SOURCE_MODE flag — useful for friends-testing where the host
  // wants to see how the platform feels with only their own uploads.
  // Default false (caller sees the full platform pool, matching legacy
  // behaviour). Toggled from the admin user drawer.
  restrictedToOwnQuestions: boolean;

  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  targetScore: {
    type: Number,
    min: 200,
    max: 800,
    default: 700,
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  role: {
    type: String,
    enum: ['guest', 'registered', 'monthly_pack', 'quarterly_pack', 'annual_pack', 'admin'],
    default: 'registered',
  },
  subscriptionPlan: {
    type: String,
    enum: ['free_mock', 'monthly_pack', 'quarterly_pack', 'annual_pack'],
    default: 'free_mock',
  },
  planInfo: {
    plan: {
      type: String,
      enum: ['free_mock', 'monthly_pack', 'quarterly_pack', 'annual_pack'],
      default: 'free_mock',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  mockTestsUsed: {
    type: Number,
    default: 0,
  },
  mockTestLimit: {
    type: Number,
    default: 2, // Default limit for registered users
  },
  resetInfo: {
    hasUsedReset: {
      type: Boolean,
      default: false,
    },
    resetDate: {
      type: Date,
    },
    resetCount: {
      type: Number,
      default: 0,
    },
  },
  razorpayCustomerId: {
    type: String,
    sparse: true, // Allows multiple null values but ensures uniqueness for non-null values
  },

  // ---- Tenancy (Phase 1) ----
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    index: true,
    // Optional during the rollout — migration backfills every user. All
    // post-migration writes set it explicitly via the auth/registration flow.
  },
  accountRole: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'owner',
  },
  legacyAccessEnabled: {
    type: Boolean,
    default: false,
  },
  restrictedToOwnQuestions: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Custom hook to hash password on findOneAndUpdate
userSchema.pre('findOneAndUpdate', async function(next) {
  const update: any = this.getUpdate();
  
  // Only proceed if password field is being updated
  if (update && update.$set && update.$set.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      update.$set.password = await bcrypt.hash(update.$set.password, salt);
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

export const User = mongoose.model<IUser>('User', userSchema); 