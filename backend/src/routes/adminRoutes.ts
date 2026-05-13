import express from 'express';
import mongoose from 'mongoose';
import { User, IUser } from '../models/User';
import { Payment } from '../models/Payment';
import { UserQuiz } from '../models/UserQuiz';
import { AskedQuestion } from '../models/AskedQuestion';
import { Account } from '../models/Account';
import { AccountInvite, generateInviteToken, DEFAULT_INVITE_TTL_MS } from '../models/AccountInvite';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/roleAuth';
import { resetUserRepeats } from '../services/repeatLedger';
import { clearLegacyAccountCache } from '../services/tenancy';
import { LeadRequest } from '../models/LeadRequest';
import { SupportRequest, SUPPORT_CATEGORY_VALUES } from '../models/SupportRequest';
import { generateMediumPassword } from '../utils/passwordGenerator';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Helper to sanitize regex input
const sanitizeRegex = (input: string): string => {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Get all users with pagination and filters
router.get('/users', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    // Build filter query
    const filter: Record<string, unknown> = {};

    // Filter by role/plan
    if (req.query.role && typeof req.query.role === 'string') {
      const roles = req.query.role.split(',');
      filter.role = { $in: roles };
    }

    // Filter by date range
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        (filter.createdAt as Record<string, Date>).$gte = new Date(req.query.dateFrom as string);
      }
      if (req.query.dateTo) {
        (filter.createdAt as Record<string, Date>).$lte = new Date(req.query.dateTo as string);
      }
    }

    // Filter by search query (email, name, or phone)
    if (req.query.search && typeof req.query.search === 'string') {
      const searchTerm = sanitizeRegex(req.query.search);
      filter.$or = [
        { email: { $regex: searchTerm, $options: 'i' } },
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { phoneNumber: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password -refreshTokens')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Search users by email
router.get('/users/search', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email query parameter is required'
      });
    }

    const sanitizedEmail = sanitizeRegex(email as string);
    const users = await User.find({
      email: { $regex: sanitizedEmail, $options: 'i' }
    })
    .select('-password -refreshTokens')
    .limit(20)
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
});

// Upgrade user plan
router.post('/users/:userId/upgrade', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { plan } = req.body;

    if (!plan || !['monthly_pack', 'quarterly_pack', 'annual_pack'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Valid plan (monthly_pack, quarterly_pack, annual_pack) is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate plan end date
    let planEndDate = new Date();
    switch (plan) {
      case 'monthly_pack':
        planEndDate.setMonth(planEndDate.getMonth() + 1);
        break;
      case 'quarterly_pack':
        planEndDate.setMonth(planEndDate.getMonth() + 3);
        break;
      case 'annual_pack':
        planEndDate.setFullYear(planEndDate.getFullYear() + 1);
        break;
    }

    // Update user
    user.role = plan;
    user.subscriptionPlan = plan;
    user.planInfo = {
      plan,
      startDate: new Date(),
      endDate: planEndDate,
      isActive: true
    };
    user.mockTestLimit = -1; // Unlimited for paid plans
    user.mockTestsUsed = 0; // Reset usage count

    await user.save();

    console.log(`Admin ${req.user?.email} upgraded user ${user.email} to ${plan}`);

    res.json({
      success: true,
      message: `User upgraded to ${plan} successfully`,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          subscriptionPlan: user.subscriptionPlan,
          planInfo: user.planInfo,
          mockTestsUsed: user.mockTestsUsed,
          mockTestLimit: user.mockTestLimit
        }
      }
    });
  } catch (error) {
    console.error('Error upgrading user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upgrade user' 
    });
  }
});

// Downgrade user plan
router.post('/users/:userId/downgrade', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Downgrade to registered user
    user.role = 'registered';
    user.subscriptionPlan = 'free_mock';
    user.planInfo = {
      plan: 'free_mock',
      startDate: new Date(),
      endDate: undefined,
      isActive: true
    };
    user.mockTestLimit = 2; // Reset to free limit
    user.mockTestsUsed = 0; // Reset usage count

    await user.save();

    console.log(`Admin ${req.user?.email} downgraded user ${user.email} to free plan`);

    res.json({
      success: true,
      message: 'User downgraded to free plan successfully',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          subscriptionPlan: user.subscriptionPlan,
          planInfo: user.planInfo,
          mockTestsUsed: user.mockTestsUsed,
          mockTestLimit: user.mockTestLimit
        }
      }
    });
  } catch (error) {
    console.error('Error downgrading user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to downgrade user'
    });
  }
});

// Create new user (admin only)
router.post('/users', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, password, fullName, phoneNumber, role, subscriptionPlan } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and full name are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Determine plan settings based on role
    const userRole = role || 'registered';
    const userPlan = subscriptionPlan || 'free_mock';
    let mockTestLimit = 2;
    let planEndDate: Date | undefined;

    if (['monthly_pack', 'quarterly_pack', 'annual_pack'].includes(userRole)) {
      mockTestLimit = -1;
      planEndDate = new Date();
      switch (userRole) {
        case 'monthly_pack':
          planEndDate.setMonth(planEndDate.getMonth() + 1);
          break;
        case 'quarterly_pack':
          planEndDate.setMonth(planEndDate.getMonth() + 3);
          break;
        case 'annual_pack':
          planEndDate.setFullYear(planEndDate.getFullYear() + 1);
          break;
      }
    }

    // Create new user
    const newUser = new User({
      email: email.toLowerCase().trim(),
      password,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber?.trim(),
      role: userRole,
      subscriptionPlan: userPlan,
      planInfo: {
        plan: userPlan,
        startDate: new Date(),
        endDate: planEndDate,
        isActive: true
      },
      mockTestLimit,
      mockTestsUsed: 0
    });

    await newUser.save();

    console.log(`Admin ${req.user?.email} created user ${newUser.email}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          _id: newUser._id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          subscriptionPlan: newUser.subscriptionPlan,
          createdAt: newUser.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// Get single user details with quiz and payment history
router.get('/users/:userId', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password -refreshTokens');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's quiz history
    const quizHistory = await UserQuiz.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Get user's payment history
    const paymentHistory = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Calculate quiz statistics
    const quizStats = {
      totalQuizzes: quizHistory.length,
      averageScore: quizHistory.length > 0
        ? Math.round(quizHistory.reduce((acc, q) => acc + (q.score || 0), 0) / quizHistory.length)
        : 0,
      totalQuestionsAnswered: quizHistory.reduce((acc, q) => acc + (q.totalQuestions || 0), 0),
      totalCorrect: quizHistory.reduce((acc, q) => acc + (q.correctAnswers || 0), 0),
      averageTimePerQuiz: quizHistory.length > 0
        ? Math.round(quizHistory.reduce((acc, q) => acc + (q.timeSpent || 0), 0) / quizHistory.length)
        : 0
    };

    // Calculate payment statistics
    const paymentStats = {
      totalPayments: paymentHistory.length,
      totalAmount: paymentHistory.reduce((acc, p) => acc + (p.amount || 0), 0),
      successfulPayments: paymentHistory.filter(p => p.status === 'paid').length
    };

    res.json({
      success: true,
      data: {
        user,
        quizHistory,
        paymentHistory,
        quizStats,
        paymentStats
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details'
    });
  }
});

// Update user details
router.put('/users/:userId', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { fullName, phoneNumber, targetScore, mockTestLimit, mockTestsUsed } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    if (fullName !== undefined) user.fullName = fullName.trim();
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber?.trim();
    if (targetScore !== undefined) user.targetScore = targetScore;
    if (mockTestLimit !== undefined) user.mockTestLimit = mockTestLimit;
    if (mockTestsUsed !== undefined) user.mockTestsUsed = mockTestsUsed;

    await user.save();

    console.log(`Admin ${req.user?.email} updated user ${user.email}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          targetScore: user.targetScore,
          mockTestLimit: user.mockTestLimit,
          mockTestsUsed: user.mockTestsUsed
        }
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// Export users to CSV
router.get('/export/users', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Build filter from query params (same as /users endpoint)
    const filter: Record<string, unknown> = {};

    if (req.query.role && typeof req.query.role === 'string') {
      const roles = req.query.role.split(',');
      filter.role = { $in: roles };
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        (filter.createdAt as Record<string, Date>).$gte = new Date(req.query.dateFrom as string);
      }
      if (req.query.dateTo) {
        (filter.createdAt as Record<string, Date>).$lte = new Date(req.query.dateTo as string);
      }
    }

    const users = await User.find(filter)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .lean();

    // Generate CSV
    const headers = ['ID', 'Email', 'Full Name', 'Phone', 'Role', 'Plan', 'Mock Tests Used', 'Mock Test Limit', 'Plan Start Date', 'Plan End Date', 'Created At'];
    const csvRows = [headers.join(',')];

    for (const user of users) {
      const row = [
        user._id,
        `"${user.email}"`,
        `"${user.fullName || ''}"`,
        `"${user.phoneNumber || ''}"`,
        user.role,
        user.subscriptionPlan,
        user.mockTestsUsed || 0,
        user.mockTestLimit === -1 ? 'Unlimited' : user.mockTestLimit,
        user.planInfo?.startDate ? new Date(user.planInfo.startDate).toISOString().split('T')[0] : '',
        user.planInfo?.endDate ? new Date(user.planInfo.endDate).toISOString().split('T')[0] : '',
        new Date(user.createdAt).toISOString().split('T')[0]
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export users'
    });
  }
});

// Get dashboard analytics
router.get('/analytics', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // User statistics
    const totalUsers = await User.countDocuments();
    const paidUsers = await User.countDocuments({
      role: { $in: ['monthly_pack', 'quarterly_pack', 'annual_pack'] }
    });
    const freeUsers = await User.countDocuments({ role: 'registered' });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const newUsersThisWeek = await User.countDocuments({
      createdAt: { $gte: startOfWeek }
    });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // User breakdown by plan
    const usersByPlan = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Payment statistics
    const paymentsThisMonth = await Payment.find({
      createdAt: { $gte: startOfMonth },
      status: 'paid'
    });
    const revenueThisMonth = paymentsThisMonth.reduce((acc, p) => acc + (p.amount || 0), 0);
    const totalPayments = await Payment.countDocuments({ status: 'paid' });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Quiz statistics
    const totalQuizzes = await UserQuiz.countDocuments();
    const quizzesThisWeek = await UserQuiz.countDocuments({
      createdAt: { $gte: startOfWeek }
    });

    // Active users (users who took a quiz in the last 7 days)
    const activeUsers = await UserQuiz.distinct('userId', {
      createdAt: { $gte: startOfWeek }
    });

    // Revenue by month (last 6 months)
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const revenueByMonth = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Signups by month (last 6 months)
    const signupsByMonth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          paid: paidUsers,
          free: freeUsers,
          admin: adminUsers,
          newThisWeek: newUsersThisWeek,
          newThisMonth: newUsersThisMonth,
          activeThisWeek: activeUsers.length,
          byPlan: usersByPlan.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>)
        },
        payments: {
          totalPayments,
          totalRevenue: totalRevenue[0]?.total || 0,
          revenueThisMonth,
          paymentsThisMonth: paymentsThisMonth.length
        },
        quizzes: {
          total: totalQuizzes,
          thisWeek: quizzesThisWeek
        },
        charts: {
          revenueByMonth: revenueByMonth.map(item => ({
            month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            revenue: item.revenue,
            count: item.count
          })),
          signupsByMonth: signupsByMonth.map(item => ({
            month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            count: item.count
          }))
        },
        conversionRate: totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

// Bulk operations on users
router.post('/users/bulk', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userIds, action, plan } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    if (!action || !['upgrade', 'downgrade', 'delete'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Valid action (upgrade, downgrade, delete) is required'
      });
    }

    let affectedCount = 0;
    const adminEmail = req.user?.email;

    switch (action) {
      case 'upgrade':
        if (!plan || !['monthly_pack', 'quarterly_pack', 'annual_pack'].includes(plan)) {
          return res.status(400).json({
            success: false,
            message: 'Valid plan is required for upgrade'
          });
        }

        let planEndDate = new Date();
        switch (plan) {
          case 'monthly_pack':
            planEndDate.setMonth(planEndDate.getMonth() + 1);
            break;
          case 'quarterly_pack':
            planEndDate.setMonth(planEndDate.getMonth() + 3);
            break;
          case 'annual_pack':
            planEndDate.setFullYear(planEndDate.getFullYear() + 1);
            break;
        }

        const upgradeResult = await User.updateMany(
          { _id: { $in: userIds }, role: { $ne: 'admin' } },
          {
            $set: {
              role: plan,
              subscriptionPlan: plan,
              'planInfo.plan': plan,
              'planInfo.startDate': new Date(),
              'planInfo.endDate': planEndDate,
              'planInfo.isActive': true,
              mockTestLimit: -1,
              mockTestsUsed: 0
            }
          }
        );
        affectedCount = upgradeResult.modifiedCount;
        console.log(`Admin ${adminEmail} bulk upgraded ${affectedCount} users to ${plan}`);
        break;

      case 'downgrade':
        const downgradeResult = await User.updateMany(
          { _id: { $in: userIds }, role: { $ne: 'admin' } },
          {
            $set: {
              role: 'registered',
              subscriptionPlan: 'free_mock',
              'planInfo.plan': 'free_mock',
              'planInfo.startDate': new Date(),
              'planInfo.isActive': true,
              mockTestLimit: 2,
              mockTestsUsed: 0
            },
            $unset: { 'planInfo.endDate': '' }
          }
        );
        affectedCount = downgradeResult.modifiedCount;
        console.log(`Admin ${adminEmail} bulk downgraded ${affectedCount} users`);
        break;

      case 'delete':
        // Don't allow deleting admin users
        const deleteResult = await User.deleteMany({
          _id: { $in: userIds },
          role: { $ne: 'admin' }
        });
        affectedCount = deleteResult.deletedCount;
        console.log(`Admin ${adminEmail} bulk deleted ${affectedCount} users`);
        break;
    }

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      data: {
        affected: affectedCount
      }
    });
  } catch (error) {
    console.error('Error in bulk operation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk operation'
    });
  }
});

// Update user details
router.put('/users/:userId', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { fullName, email, phoneNumber, targetScore } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user fields
    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (targetScore !== undefined) user.targetScore = targetScore;

    await user.save();

    console.log(`Admin ${req.user?.email} updated user ${user.email}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          targetScore: user.targetScore,
          role: user.role,
          subscriptionPlan: user.subscriptionPlan
        }
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

/**
 * Admin reset of a user's repeat-question ledger.
 *
 * No cooldown for admin resets (used for support / manual unlocks). Body:
 *   `{ scope?: { questionType?: string } }`
 * Without `scope.questionType`, the user's full ledger is wiped.
 */
router.post('/users/:userId/repeats/reset', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const target = await User.findById(userId).select('email role');
    if (!target) return res.status(404).json({ message: 'User not found' });

    const scope: { questionType?: string } = {};
    if (typeof req.body?.scope?.questionType === 'string' && req.body.scope.questionType.trim()) {
      scope.questionType = req.body.scope.questionType.trim();
    }

    const result = await resetUserRepeats(userId, scope);
    console.log(`[admin] ${req.user?.email} reset repeat ledger for ${target.email}: -${result.deletedCount} rows`);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Admin reset error:', error);
    return res.status(500).json({ message: 'Failed to reset repeat ledger' });
  }
});

/**
 * Inspect a user's ledger size by type. Drives the admin user-detail UI so
 * the support agent can see what they're about to reset.
 */
router.get('/users/:userId/repeats', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const total = await AskedQuestion.countDocuments({ userId });
    const byType = await AskedQuestion.aggregate([
      { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
      { $group: { _id: '$questionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return res.json({ total, byType });
  } catch (error) {
    console.error('Admin ledger inspect error:', error);
    return res.status(500).json({ message: 'Failed to fetch ledger stats' });
  }
});

// ---- Per-user legacy access toggle (super-admin) -----------------------
//
// Critical CRM control per Open Question #4: only when this flag is on does
// a user see questions from the legacy / OG pool. Defaults false. The
// super-admin manages it from the user editor in AdminPanel.

router.patch('/users/:userId/legacy-access', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const enabled = !!req.body?.enabled;
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    target.legacyAccessEnabled = enabled;
    await target.save();
    // If we just promoted/demoted an admin, the cached set of "legacy-pool
    // owner" account ids may also be stale. Cheap to clear.
    clearLegacyAccountCache();
    return res.json({ success: true, userId: target._id, legacyAccessEnabled: enabled });
  } catch (err) {
    console.error('Admin legacy-access toggle error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update legacy access.' });
  }
});

// "All platform questions vs only the user's own uploads" — per-user hard
// override that works regardless of QUESTION_SOURCE_MODE. ON (=allow all)
// is the default; flipping OFF restricts the user to questions in their own
// account only. Used to give friends a sandboxed view of the platform.
router.patch('/users/:userId/restricted-to-own', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const restricted = !!req.body?.restricted;
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    if (restricted && !target.accountId) {
      return res.status(409).json({
        success: false,
        message: 'Cannot restrict — user has no accountId. Run the tenancy migration first.',
      });
    }
    target.restrictedToOwnQuestions = restricted;
    await target.save();
    return res.json({ success: true, userId: target._id, restrictedToOwnQuestions: restricted });
  } catch (err) {
    console.error('Admin restricted-to-own toggle error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update access mode.' });
  }
});

// ---- Account management (super-admin) ----------------------------------
//
// Super-admin creates a Business Account and an initial owner invite. The
// invitee accepts at /api/account/invites/accept/:token and becomes the
// real owner. Until accepted, the account's `ownerUserId` points at the
// super-admin themselves so FK integrity holds.

router.post('/accounts', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const ownerEmail = String(req.body?.ownerEmail || '').trim().toLowerCase();
    const maxMembers = Number(req.body?.maxMembers) || undefined;

    if (name.length < 2) {
      return res.status(400).json({ success: false, message: 'Account name is required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      return res.status(400).json({ success: false, message: 'A valid owner email is required.' });
    }

    // Block creation if the email is already a user (they need to be moved
    // manually rather than implicitly bound to a new account).
    const existing = await User.findOne({ email: ownerEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with that email already exists. Move them or pick a different owner.',
      });
    }

    const account = await Account.create({
      type: 'business',
      name,
      // Placeholder until the owner accepts. Survives FK validation; the
      // accept-invite flow updates it.
      ownerUserId: new mongoose.Types.ObjectId(req.user!.userId),
      businessStatus: 'trial',
      maxMembers,
    });

    const invite = await AccountInvite.create({
      accountId: account._id,
      email: ownerEmail,
      invitedByUserId: new mongoose.Types.ObjectId(req.user!.userId),
      accountRole: 'admin', // promoted to 'owner' on accept via becomesOwner
      becomesOwner: true,
      token: generateInviteToken(),
      expiresAt: new Date(Date.now() + DEFAULT_INVITE_TTL_MS),
    });

    const base = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')?.replace(/:\d+$/, ':3000')}`;
    return res.status(201).json({
      success: true,
      account,
      invite: {
        id: invite._id,
        email: invite.email,
        token: invite.token,
        link: `${base}/accept-invite?token=${invite.token}&owner=1`,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (err) {
    console.error('Admin business-account creation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create account.' });
  }
});

// List all accounts (super-admin CRM list view; full Phase 4 CRM lands later).
router.get('/accounts', authenticateToken, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const accounts = await Account.find().sort({ createdAt: -1 }).lean();
    // Aggregate member + question counts in parallel. Cheap for the early-stage
    // user counts; revisit if the account list ever grows past a few hundred.
    const [memberCounts, questionCounts] = await Promise.all([
      User.aggregate([
        { $match: { accountId: { $in: accounts.map((a: any) => a._id) } } },
        { $group: { _id: '$accountId', count: { $sum: 1 } } },
      ]),
      // QuestionBagV3 only — V2 is the legacy pool and not tenant-active.
      mongoose.connection.collection('questionbagv3').aggregate([
        { $match: { accountId: { $in: accounts.map((a: any) => a._id) } } },
        { $group: { _id: '$accountId', count: { $sum: 1 } } },
      ]).toArray(),
    ]);
    const memberMap = new Map(memberCounts.map((m: any) => [String(m._id), m.count]));
    const questionMap = new Map(questionCounts.map((q: any) => [String(q._id), q.count]));
    const enriched = accounts.map((a: any) => ({
      ...a,
      memberCount: memberMap.get(String(a._id)) || 0,
      questionCount: questionMap.get(String(a._id)) || 0,
    }));
    return res.json({ success: true, accounts: enriched });
  } catch (err) {
    console.error('Admin account-list error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list accounts.' });
  }
});

// ---- Access requests / lead provisioning -------------------------------
//
// Public signup is disabled — visitors fill the "Request Access" form on
// /register, which writes a LeadRequest. Admin reviews here and either
// generates credentials (creates a real User and emails them out-of-band)
// or rejects/deletes.

router.get('/leads', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const filter: Record<string, unknown> = {};
    if (status && ['new', 'contacted', 'converted', 'rejected'].includes(status)) {
      filter.status = status;
    }
    if (search) {
      const safe = sanitizeRegex(search);
      filter.$or = [
        { email: { $regex: safe, $options: 'i' } },
        { name: { $regex: safe, $options: 'i' } },
        { phone: { $regex: safe, $options: 'i' } },
      ];
    }
    const leads = await LeadRequest.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ success: true, data: { leads } });
  } catch (err) {
    console.error('Admin list-leads error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch leads.' });
  }
});

// Convert a lead → real user. Generates a medium-complex password, creates
// the User record, marks the lead converted and returns the password to
// the admin **once** so they can pass it on to the user out-of-band.
router.post('/leads/:id/convert', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const lead = await LeadRequest.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

    if (lead.status === 'converted' && lead.convertedUserId) {
      return res.status(409).json({
        success: false,
        message: 'Lead has already been converted.',
        userId: lead.convertedUserId,
      });
    }

    // Reuse existing user if email collides (idempotency for the admin who
    // accidentally double-clicks). They'll need to reset password separately.
    const existing = await User.findOne({ email: lead.email });
    if (existing) {
      lead.status = 'converted';
      lead.convertedUserId = existing._id;
      await lead.save();
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists. Marked lead as converted; use "Reset password" on the user if needed.',
        userId: existing._id,
      });
    }

    const role = typeof req.body?.role === 'string' && ['registered', 'monthly_pack', 'quarterly_pack', 'annual_pack'].includes(req.body.role)
      ? req.body.role
      : 'registered';

    let mockTestLimit = 2;
    let planEndDate: Date | undefined;
    let plan: string = 'free_mock';
    if (['monthly_pack', 'quarterly_pack', 'annual_pack'].includes(role)) {
      plan = role;
      mockTestLimit = -1;
      planEndDate = new Date();
      if (role === 'monthly_pack') planEndDate.setMonth(planEndDate.getMonth() + 1);
      if (role === 'quarterly_pack') planEndDate.setMonth(planEndDate.getMonth() + 3);
      if (role === 'annual_pack') planEndDate.setFullYear(planEndDate.getFullYear() + 1);
    }

    const generatedPassword = generateMediumPassword();

    const newUser = await User.create({
      email: lead.email,
      password: generatedPassword, // pre-save hook hashes it
      fullName: lead.name,
      phoneNumber: lead.phone,
      role,
      subscriptionPlan: plan,
      planInfo: { plan, startDate: new Date(), endDate: planEndDate, isActive: true },
      mockTestLimit,
      mockTestsUsed: 0,
    });

    lead.status = 'converted';
    lead.convertedUserId = newUser._id;
    await lead.save();

    console.log(`Admin ${req.user?.email} converted lead ${lead.email} → user ${newUser._id}`);

    return res.status(201).json({
      success: true,
      message: 'User created. Share the credentials with the requester.',
      data: {
        userId: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        password: generatedPassword, // shown to admin once; never stored.
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error('Admin convert-lead error:', err);
    return res.status(500).json({ success: false, message: 'Failed to convert lead.' });
  }
});

router.patch('/leads/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const lead = await LeadRequest.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    if (typeof req.body?.status === 'string' && ['new', 'contacted', 'converted', 'rejected'].includes(req.body.status)) {
      lead.status = req.body.status;
    }
    if (typeof req.body?.notes === 'string') {
      lead.notes = req.body.notes.trim().slice(0, 4000);
    }
    await lead.save();
    return res.json({ success: true, data: { lead } });
  } catch (err) {
    console.error('Admin patch-lead error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update lead.' });
  }
});

router.delete('/leads/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const result = await LeadRequest.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Lead not found.' });
    return res.json({ success: true, message: 'Lead deleted.' });
  } catch (err) {
    console.error('Admin delete-lead error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete lead.' });
  }
});

// ---- Admin password reset ---------------------------------------------
//
// Generates a fresh medium-complex password for an existing user and
// returns it to the admin once. Used both for newly converted leads and
// for "lost-password" support requests until a self-serve reset flow ships.

router.post('/users/:userId/reset-password', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'admin' && user._id.toString() !== req.user?.userId) {
      // Don't let an admin silently reset another admin's password from the panel.
      return res.status(403).json({ success: false, message: 'Cannot reset another admin\'s password from the panel.' });
    }
    const newPassword = generateMediumPassword();
    user.password = newPassword; // pre-save hook hashes it
    await user.save();
    console.log(`Admin ${req.user?.email} reset password for user ${user.email}`);
    return res.json({
      success: true,
      message: 'Password reset. Share the new password with the user.',
      data: { userId: user._id, email: user.email, password: newPassword },
    });
  } catch (err) {
    console.error('Admin reset-password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// ---- Support requests --------------------------------------------------

router.get('/support', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const filter: Record<string, unknown> = {};
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      filter.status = status;
    }
    if (category && (SUPPORT_CATEGORY_VALUES as string[]).includes(category)) {
      filter.category = category;
    }
    if (search) {
      const safe = sanitizeRegex(search);
      filter.$or = [
        { email: { $regex: safe, $options: 'i' } },
        { name: { $regex: safe, $options: 'i' } },
        { message: { $regex: safe, $options: 'i' } },
      ];
    }
    const requests = await SupportRequest.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ success: true, data: { requests } });
  } catch (err) {
    console.error('Admin list-support error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch support requests.' });
  }
});

router.patch('/support/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const ticket = await SupportRequest.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found.' });
    if (typeof req.body?.status === 'string' && ['open', 'in_progress', 'resolved', 'closed'].includes(req.body.status)) {
      ticket.status = req.body.status;
    }
    if (typeof req.body?.adminNotes === 'string') {
      ticket.adminNotes = req.body.adminNotes.trim().slice(0, 4000);
    }
    await ticket.save();
    return res.json({ success: true, data: { request: ticket } });
  } catch (err) {
    console.error('Admin patch-support error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update support request.' });
  }
});

router.delete('/support/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const result = await SupportRequest.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Support request not found.' });
    return res.json({ success: true, message: 'Support request deleted.' });
  } catch (err) {
    console.error('Admin delete-support error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete support request.' });
  }
});

export default router;