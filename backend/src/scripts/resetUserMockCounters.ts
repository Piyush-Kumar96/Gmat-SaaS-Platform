import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz';

const resetUserMockCounters = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find and update the user
    const userEmail = 'registered@test.com';
    const user = await User.findOneAndUpdate(
      { email: userEmail },
      {
        $set: {
          mockTestsUsed: 0,
          mockTestLimit: 2 // Set to 2 to allow 1 Traditional + 1 GMAT Focus
        }
      },
      { new: true }
    );

    if (user) {
      console.log(`✅ Successfully reset mock counters for ${userEmail}`);
      console.log(`Mock tests used: ${user.mockTestsUsed}`);
      console.log(`Mock test limit: ${user.mockTestLimit}`);
      console.log(`Role: ${user.role}`);
      console.log(`Full name: ${user.fullName}`);
    } else {
      console.log(`❌ User with email ${userEmail} not found`);
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting user mock counters:', error);
    process.exit(1);
  }
};

// Execute the function
resetUserMockCounters();
