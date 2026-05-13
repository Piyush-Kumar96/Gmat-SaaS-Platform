import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz';

const createTestUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'test@example.com' });
    
    if (existingUser) {
      console.log('Test user already exists. Updating password...');
      
      // Update user with proper findOneAndUpdate to trigger password hashing
      await User.findOneAndUpdate(
        { email: 'test@example.com' },
        { 
          $set: { 
            password: 'password123',
            fullName: 'Test User',
            targetScore: 700
          } 
        },
        { new: true } // Return updated document
      );
      
      console.log('Test user updated successfully');
    } else {
      // Create test user
      const testUser = new User({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        targetScore: 700
      });
      
      await testUser.save();
      console.log('Test user created successfully');
    }

    // Display test user credentials
    console.log('Test User Credentials:');
    console.log('Email: test@example.com');
    console.log('Password: password123');

    // Get all users for verification
    const users = await User.find({}).select('email fullName');
    console.log('All users:', users);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
};

// Execute the function
createTestUser(); 