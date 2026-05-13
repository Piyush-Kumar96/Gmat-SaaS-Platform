import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/roleAuth';
import {
  createPaymentOrder,
  processSuccessfulPayment,
  getUserPaymentHistory,
} from '../services/paymentService';
import { SUBSCRIPTION_PLANS } from '../config/razorpay';

const router = express.Router();

/**
 * POST /api/payments/create-order
 * Create a new payment order
 */
router.post('/create-order', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { plan } = req.body; // Changed from planType to plan
    const userId = req.user!.userId;

    if (!plan || !['monthly_pack', 'quarterly_pack', 'annual_pack'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type. Must be monthly_pack, quarterly_pack, or annual_pack',
      });
    }

    const result = await createPaymentOrder({ userId, planType: plan }); // Pass as planType to service

    res.json({
      success: true,
      message: 'Payment order created successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order',
    });
  }
});

/**
 * POST /api/payments/verify
 * Verify and process payment
 */
router.post('/verify', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user!.userId;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters',
      });
    }

    const result = await processSuccessfulPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
    });

    res.json({
      success: true,
      message: 'Payment verified and processed successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Payment verification failed',
    });
  }
});

/**
 * GET /api/payments/history
 * Get user payment history
 */
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const result = await getUserPaymentHistory(userId);

    res.json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Payment history error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve payment history',
    });
  }
});

/**
 * GET /api/payments/plans
 * Get available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      displayName: plan.name, // Add displayName field
      price: plan.amount / 100, // Convert paisa to rupees for price field
      amount: plan.amount, // Keep original amount for backend compatibility
      currency: plan.currency,
      duration: plan.period === 'monthly' ? (plan.interval === 1 ? 'month' : `${plan.interval} months`) : 'year',
      period: plan.period, // Keep original period for backend compatibility
      interval: plan.interval,
      description: plan.description,
      displayAmount: `₹${(plan.amount / 100).toFixed(2)}`, // Convert paisa to rupees
      features: getFeaturesByPlan(key), // Add features based on plan
      popular: key === 'quarterly_pack' // Mark quarterly as popular
    }));

    res.json({
      success: true,
      message: 'Subscription plans retrieved successfully',
      data: { plans },
    });
  } catch (error: any) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve subscription plans',
    });
  }
});

// Helper function to get features by plan
const getFeaturesByPlan = (planKey: string): string[] => {
  const baseFeatures = [
    'Unlimited Mock Tests',
    'Detailed Performance Analytics',
    'Question Review & Explanations',
    'Progress Tracking'
  ];

  switch (planKey) {
    case 'monthly_pack':
      return [
        ...baseFeatures,
        '1 Question Reset',
        'Email Support'
      ];
    case 'quarterly_pack':
      return [
        ...baseFeatures,
        '3 Question Resets',
        'Priority Support',
        'Study Plan Recommendations'
      ];
    case 'annual_pack':
      return [
        ...baseFeatures,
        'Unlimited Question Resets',
        'Priority Support',
        'Study Plan Recommendations',
        'Advanced Analytics',
        'Performance Insights'
      ];
    default:
      return baseFeatures;
  }
};

export default router;
