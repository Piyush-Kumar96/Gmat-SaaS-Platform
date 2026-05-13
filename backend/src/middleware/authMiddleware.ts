import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { downgradeIfExpired } from './planExpiry';

// Get JWT secret from env or use default for development.
// Must match the fallback in routes/authRoutes.ts so signed tokens verify
// even if .env fails to load (otherwise every authenticated request 401s).
const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-do-not-use-in-production';

// JWT payload interface
interface JwtPayload {
  userId: string;
  email: string;
}

// AuthRequest is now just an alias for Request since we extended Express.Request globally in types.d.ts
export type AuthRequest = Request;

/**
 * Authentication middleware - verifies JWT token and adds user to request
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token format'
      });
      return;
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

      // Get full user data from database
      let user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Auto-downgrade expired paid plans on every authenticated request.
      user = await downgradeIfExpired(user);

      // Add user info to request with all required fields
      req.user = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        mockTestsUsed: user.mockTestsUsed,
        mockTestLimit: user.mockTestLimit,
        // Tenancy. accountId may be undefined for users that pre-date the
        // 001 migration; tenant-scoped helpers throw a clear error in that
        // case rather than silently leaking data.
        accountId: user.accountId ? user.accountId.toString() : undefined,
        accountRole: user.accountRole || 'owner',
        legacyAccessEnabled: !!user.legacyAccessEnabled,
        restrictedToOwnQuestions: !!user.restrictedToOwnQuestions,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          message: 'Token expired',
          expired: true
        });
        return;
      }

      res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Optional authentication middleware - checks token if present but doesn't require it
 */
export const optionalAuthMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

      // Get full user data from database
      let user = await User.findById(decoded.userId).select('-password');

      if (user) {
        user = await downgradeIfExpired(user);
        req.user = {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          subscriptionPlan: user.subscriptionPlan,
          mockTestsUsed: user.mockTestsUsed,
          mockTestLimit: user.mockTestLimit,
          accountId: user.accountId ? user.accountId.toString() : undefined,
          accountRole: user.accountRole || 'owner',
          legacyAccessEnabled: !!user.legacyAccessEnabled,
          restrictedToOwnQuestions: !!user.restrictedToOwnQuestions,
        };
      }
    } catch {
      // Continue without setting user if token is invalid
    }

    next();
  } catch {
    // Continue without setting user if any error occurs
    next();
  }
};
