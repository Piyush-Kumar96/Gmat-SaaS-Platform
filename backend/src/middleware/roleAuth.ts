import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../models/User';
import { downgradeIfExpired } from './planExpiry';

const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-do-not-use-in-production';

// AuthRequest is now just an alias for Request since we extended Express.Request globally
export type AuthRequest = Request;

/**
 * Enhanced authentication middleware that includes user role and subscription info
 */
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'No authentication token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid authentication token format' 
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Get full user data from database
    let user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Auto-downgrade expired paid plans on every authenticated request.
    user = await downgradeIfExpired(user);

    // Add user info to request with role and subscription details
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
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired',
        expired: true
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: 'Invalid authentication token'
    });
  }
};

/**
 * Middleware to require specific user roles
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }
    
    next();
  };
};

/**
 * Middleware to require paid subscription (any paid plan)
 */
export const requirePaidUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }
  
  const paidRoles: UserRole[] = ['monthly_pack', 'quarterly_pack', 'annual_pack', 'admin'];
  
  if (!paidRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      message: 'Paid subscription required',
      upgradeRequired: true,
      userRole: req.user.role
    });
  }
  
  next();
};

/**
 * Middleware to require admin access
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false,
      message: 'Admin access required',
      userRole: req.user.role
    });
  }
  
  next();
};

/**
 * Middleware to check mock test limits
 */
export const checkMockTestLimit = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }
  
  // Guest users have no access to mock tests
  if (req.user.role === 'guest') {
    return res.status(403).json({ 
      success: false,
      message: 'Mock test access not available for guest users',
      upgradeRequired: true,
      userRole: req.user.role
    });
  }
  
  // Paid users have unlimited access (-1 means unlimited)
  if (req.user.mockTestLimit === -1) {
    return next();
  }
  
  // Check if user has exceeded their limit
  if (req.user.mockTestsUsed >= req.user.mockTestLimit) {
    return res.status(403).json({ 
      success: false,
      message: 'Mock test limit exceeded',
      upgradeRequired: true,
      mockTestsUsed: req.user.mockTestsUsed,
      mockTestLimit: req.user.mockTestLimit,
      userRole: req.user.role
    });
  }
  
  next();
}; 