import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JwtPayload {
  userId: string;
}

// Note: Express.Request is extended globally in types.d.ts

export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // Check if no token
  if (!token) {
    res.status(401).json({ message: 'No token, authorization denied' });
    return;
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Get full user data from database
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    // Add user from payload with full info
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
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
}; 