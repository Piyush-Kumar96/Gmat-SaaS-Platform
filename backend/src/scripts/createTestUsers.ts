import mongoose from 'mongoose';
import { User } from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz';

const testUsers = [
  {
    email: 'guest@test.com',
    password: 'password123',
    fullName: 'Guest User',
    targetScore: 650,
    role: 'guest',
    subscriptionPlan: 'free_mock',
    planInfo: {
      plan: 'free_mock',
      startDate: new Date(),
      isActive: true,
    },
    mockTestsUsed: 0,
    mockTestLimit: 0, // Guests have no mock test access
    resetInfo: {
      hasUsedReset: false,
      resetCount: 0,
    },
  },
  {
    email: 'registered@test.com',
    password: 'password123',
    fullName: 'Registered User',
    targetScore: 700,
    role: 'registered',
    subscriptionPlan: 'free_mock',
    planInfo: {
      plan: 'free_mock',
      startDate: new Date(),
      isActive: true,
    },
    mockTestsUsed: 0,
    mockTestLimit: 2, // 2 free mock tests
    resetInfo: {
      hasUsedReset: false,
      resetCount: 0,
    },
  },
  {
    email: 'monthly@test.com',
    password: 'password123',
    fullName: 'Monthly Subscriber',
    targetScore: 720,
    role: 'monthly_pack',
    subscriptionPlan: 'monthly_pack',
    planInfo: {
      plan: 'monthly_pack',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isActive: true,
    },
    mockTestsUsed: 5,
    mockTestLimit: -1, // Unlimited
    resetInfo: {
      hasUsedReset: false,
      resetCount: 0,
    },
  },
  {
    email: 'quarterly@test.com',
    password: 'password123',
    fullName: 'Quarterly Subscriber',
    targetScore: 750,
    role: 'quarterly_pack',
    subscriptionPlan: 'quarterly_pack',
    planInfo: {
      plan: 'quarterly_pack',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      isActive: true,
    },
    mockTestsUsed: 12,
    mockTestLimit: -1, // Unlimited
    resetInfo: {
      hasUsedReset: false,
      resetCount: 0,
    },
  },
  {
    email: 'annual@test.com',
    password: 'password123',
    fullName: 'Annual Subscriber',
    targetScore: 780,
    role: 'annual_pack',
    subscriptionPlan: 'annual_pack',
    planInfo: {
      plan: 'annual_pack',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 365 days from now
      isActive: true,
    },
    mockTestsUsed: 25,
    mockTestLimit: -1, // Unlimited
    resetInfo: {
      hasUsedReset: false,
      resetCount: 0,
    },
  },
  {
    email: 'admin@test.com',
    password: 'password123',
    fullName: 'Admin User',
    targetScore: 800,
    role: 'admin',
    subscriptionPlan: 'annual_pack',
    planInfo: {
      plan: 'annual_pack',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 365 days from now
      isActive: true,
    },
    mockTestsUsed: 50,
    mockTestLimit: -1, // Unlimited
    resetInfo: {
      hasUsedReset: false,
      resetCount: 0,
    },
  },
  // Additional test users with different usage scenarios
  {
    email: 'registered-limit@test.com',
    password: 'password123',
    fullName: 'Registered User (At Limit)',
    targetScore: 680,
    role: 'registered',
    subscriptionPlan: 'free_mock',
    planInfo: {
      plan: 'free_mock',
      startDate: new Date(),
      isActive: true,
    },
    mockTestsUsed: 2, // Already used both free tests
    mockTestLimit: 2,
    resetInfo: {
      hasUsedReset: false,
      resetCount: 0,
    },
  },
  {
    email: 'monthly-reset@test.com',
    password: 'password123',
    fullName: 'Monthly User (Used Reset)',
    targetScore: 730,
    role: 'monthly_pack',
    subscriptionPlan: 'monthly_pack',
    planInfo: {
      plan: 'monthly_pack',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    mockTestsUsed: 8,
    mockTestLimit: -1,
    resetInfo: {
      hasUsedReset: true,
      resetDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      resetCount: 1,
    },
  },
];

async function createTestUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Clearing existing test users...');
    // Remove existing test users
    await User.deleteMany({ 
      email: { 
        $in: testUsers.map(user => user.email) 
      } 
    });

    console.log('Creating test users...');
    for (const userData of testUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`✓ Created user: ${userData.email} (${userData.role})`);
    }

    console.log('\n🎉 Test users created successfully!');
    console.log('\n📋 Test User Credentials:');
    console.log('==========================');
    
    testUsers.forEach(user => {
      console.log(`${user.role.toUpperCase().padEnd(12)} | ${user.email.padEnd(25)} | password123`);
    });

    console.log('\n📝 User Role Descriptions:');
    console.log('==========================');
    console.log('GUEST        | No mock test access, upgrade prompts');
    console.log('REGISTERED   | 2 free mock tests, basic features');
    console.log('MONTHLY_PACK | Unlimited tests, 1 reset allowed');
    console.log('QUARTERLY    | Unlimited tests, 1 reset, priority support');
    console.log('ANNUAL_PACK  | Unlimited tests, unlimited resets');
    console.log('ADMIN        | All features + admin dashboard');

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script if called directly
if (require.main === module) {
  createTestUsers();
}

export { createTestUsers }; 