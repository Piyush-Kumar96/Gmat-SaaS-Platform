import { razorpay, getPlanDetails, RAZORPAY_CONFIG } from '../config/razorpay';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import crypto from 'crypto';

export interface CreateOrderRequest {
  userId: string;
  planType: 'monthly_pack' | 'quarterly_pack' | 'annual_pack';
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  userId: string;
}

/**
 * Create a Razorpay order for payment
 */
export const createPaymentOrder = async (request: CreateOrderRequest) => {
  try {
    // Check if Razorpay is configured
    if (!razorpay || !RAZORPAY_CONFIG.isConfigured) {
      throw new Error('Payment system is not configured. Please contact support.');
    }

    const { userId, planType } = request;
    
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get plan details
    const planDetails = getPlanDetails(planType);
    if (!planDetails) {
      throw new Error('Invalid plan type');
    }

    // Generate unique receipt ID
    const receipt = `receipt_${userId}_${Date.now()}`;

    // Create Razorpay order
    const orderOptions = {
      amount: planDetails.amount,
      currency: planDetails.currency,
      receipt: receipt,
      notes: {
        userId: userId,
        planType: planType,
        userEmail: user.email,
        userName: user.fullName,
      },
    };

    const razorpayOrder = await razorpay.orders.create(orderOptions);

    // Save payment record in database
    const payment = new Payment({
      userId: userId,
      razorpayOrderId: razorpayOrder.id,
      amount: planDetails.amount,
      currency: planDetails.currency,
      status: 'created',
      description: planDetails.description,
      subscriptionPlan: planType,
      receipt: receipt,
      notes: orderOptions.notes,
    });

    await payment.save();

    return {
      success: true,
      orderId: razorpayOrder.id,
      amount: planDetails.amount,
      currency: planDetails.currency,
      receipt: receipt,
      planDetails: planDetails,
    };
  } catch (error: any) {
    console.error('Error creating payment order:', error);
    throw new Error(`Failed to create payment order: ${error.message}`);
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  try {
    if (!RAZORPAY_CONFIG.isConfigured) {
      console.error('Cannot verify payment signature: Razorpay not configured');
      return false;
    }

    const webhookSecret = RAZORPAY_CONFIG.key_secret;
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    return false;
  }
};

/**
 * Process successful payment and update user subscription
 */
export const processSuccessfulPayment = async (request: VerifyPaymentRequest) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = request;

    // Check if Razorpay is configured
    if (!RAZORPAY_CONFIG.isConfigured) {
      throw new Error('Payment system is not configured. Please contact support.');
    }

    // Verify signature
    const isValidSignature = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      throw new Error('Invalid payment signature');
    }

    // Find payment record
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      throw new Error('Payment record not found');
    }

    // Update payment record
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'paid';
    await payment.save();

    // Update user subscription
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Calculate subscription dates
    const startDate = new Date();
    let endDate = new Date();
    let newRole = payment.subscriptionPlan;

    switch (payment.subscriptionPlan) {
      case 'monthly_pack':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly_pack':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'annual_pack':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    // Update user
    user.role = newRole as any;
    user.subscriptionPlan = payment.subscriptionPlan as any;
    user.planInfo = {
      plan: payment.subscriptionPlan as any,
      startDate: startDate,
      endDate: endDate,
      isActive: true,
    };
    user.mockTestLimit = -1; // Unlimited for paid users

    await user.save();

    return {
      success: true,
      message: 'Payment processed successfully',
      subscription: {
        plan: payment.subscriptionPlan,
        startDate: startDate,
        endDate: endDate,
        isActive: true,
      },
    };
  } catch (error: any) {
    console.error('Error processing payment:', error);
    
    // Update payment status to failed if payment record exists
    try {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: request.razorpay_order_id },
        { 
          status: 'failed',
          failureReason: error.message,
        }
      );
    } catch (updateError) {
      console.error('Error updating payment status:', updateError);
    }

    throw new Error(`Payment processing failed: ${error.message}`);
  }
};

/**
 * Get user payment history
 */
export const getUserPaymentHistory = async (userId: string) => {
  try {
    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    return {
      success: true,
      payments: payments.map(payment => ({
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        description: payment.description,
        subscriptionPlan: payment.subscriptionPlan,
        createdAt: payment.createdAt,
        razorpayPaymentId: payment.razorpayPaymentId,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching payment history:', error);
    throw new Error(`Failed to fetch payment history: ${error.message}`);
  }
};
