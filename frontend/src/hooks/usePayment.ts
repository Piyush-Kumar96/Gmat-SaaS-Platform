import { useState, useCallback } from 'react';
import { message } from 'antd';
import { createPaymentOrder, verifyPayment, getSubscriptionPlans } from '../services/api';
import { SubscriptionPlan, PaymentOrder, RazorpayResponse, RazorpayOptions } from '../types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await getSubscriptionPlans();
      setPlans(response.plans);
      return response.plans;
    } catch (error) {
      console.error('Error fetching plans:', error);
      message.error('Failed to fetch subscription plans');
      return [];
    }
  }, []);

  const initiatePayment = useCallback(async (
    planId: string,
    userDetails: { name: string; email: string },
    onSuccess?: (response: RazorpayResponse) => void,
    onFailure?: (error: any) => void
  ) => {
    try {
      setLoading(true);

      // Load Razorpay script if not already loaded
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay SDK');
      }

      // Create payment order
      const orderResponse = await createPaymentOrder(planId);
      const { order, plan } = orderResponse;

      // Configure Razorpay options
      const options: RazorpayOptions = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID || '',
        amount: order.amount,
        currency: order.currency,
        name: 'GMAT Quiz Platform',
        description: `${plan.displayName} Subscription`,
        order_id: order.id,
        handler: async (response: RazorpayResponse) => {
          try {
            // Verify payment on backend
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            message.success('Payment successful! Your subscription is now active.');
            onSuccess?.(response);
          } catch (verifyError) {
            console.error('Payment verification failed:', verifyError);
            message.error('Payment verification failed. Please contact support.');
            onFailure?.(verifyError);
          }
        },
        prefill: {
          name: userDetails.name,
          email: userDetails.email,
        },
        theme: {
          color: '#1890ff',
        },
        modal: {
          ondismiss: () => {
            message.info('Payment cancelled');
            onFailure?.(new Error('Payment cancelled by user'));
          },
        },
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Payment initiation failed:', error);
      message.error('Failed to initiate payment. Please try again.');
      onFailure?.(error);
    } finally {
      setLoading(false);
    }
  }, [loadRazorpayScript]);

  return {
    loading,
    plans,
    fetchPlans,
    initiatePayment,
  };
}; 