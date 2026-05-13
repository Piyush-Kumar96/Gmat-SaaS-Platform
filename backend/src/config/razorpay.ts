import Razorpay from 'razorpay';

const razorpayConfig = {
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
};

// Validate that required environment variables are present
const hasValidCredentials = razorpayConfig.key_id && razorpayConfig.key_secret;

if (!hasValidCredentials) {
  console.warn('WARNING: Razorpay credentials not found in environment variables!');
  console.warn('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file');
  console.warn('Payment functionality will be disabled until credentials are provided.');
}

// Initialize Razorpay instance only if credentials are available
export const razorpay = hasValidCredentials 
  ? new Razorpay(razorpayConfig)
  : null;

// Export configuration for use in other modules
export const RAZORPAY_CONFIG = {
  ...razorpayConfig,
  webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  isConfigured: hasValidCredentials,
};

// Plan configurations with amounts in paisa (Razorpay format)
export const SUBSCRIPTION_PLANS = {
  monthly_pack: {
    name: 'Monthly Pack',
    amount: 150000, // ₹1500.00 in paisa
    currency: 'INR',
    period: 'monthly',
    interval: 1,
    description: 'Monthly subscription for unlimited mock tests and analytics',
  },
  quarterly_pack: {
    name: 'Quarterly Pack',
    amount: 350000, // ₹3500.00 in paisa
    currency: 'INR',
    period: 'monthly',
    interval: 3,
    description: 'Quarterly subscription with advanced features and priority support',
  },
  annual_pack: {
    name: 'Annual Pack',
    amount: 600000, // ₹6000.00 in paisa
    currency: 'INR',
    period: 'yearly',
    interval: 1,
    description: 'Annual subscription with premium features and maximum savings',
  },
};

// Utility function to get plan details
export const getPlanDetails = (planType: string) => {
  return SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS];
};
