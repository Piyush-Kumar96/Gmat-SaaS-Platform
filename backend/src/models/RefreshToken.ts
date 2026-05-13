import mongoose from 'mongoose';

export interface IRefreshToken extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  replacedByToken?: string;
  deviceInfo?: string;
}

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  revoked: {
    type: Boolean,
    default: false,
  },
  revokedAt: {
    type: Date,
  },
  replacedByToken: {
    type: String,
  },
  deviceInfo: {
    type: String,
  },
});

// Add index for quick expiry checks
refreshTokenSchema.index({ expiresAt: 1 });

// Add index for user lookup
refreshTokenSchema.index({ userId: 1 });

// Set TTL index for automatic deletion after expiry
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema); 