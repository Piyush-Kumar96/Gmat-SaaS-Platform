import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { UserRole } from '../types/auth';

export interface RoleAccessControl {
  // Check if user has access to mock tests
  canAccessMockTest: boolean;
  
  // Check if user has reached their mock test limit
  hasReachedMockTestLimit: boolean;
  
  // Check if user can access premium features
  canAccessPremiumFeatures: boolean;
  
  // Check if user has admin privileges
  isAdmin: boolean;
  
  // Check if user has paid subscription
  isPaidUser: boolean;
  
  // Check if user is a guest
  isGuest: boolean;
  
  // Check if user is registered (free account)
  isRegistered: boolean;
  
  // Get user's remaining mock tests
  remainingMockTests: number;
  
  // Check if specific feature is accessible
  canAccessFeature: (feature: string) => boolean;
  
  // Get upgrade message for locked features
  getUpgradeMessage: (feature?: string) => string;
}

/**
 * Hook to manage role-based access control
 */
export const useRoleAccess = (): RoleAccessControl => {
  const { user } = useContext(AuthContext);
  
  // If no user is logged in, treat as guest
  const userRole: UserRole = user?.role || 'guest';
  const mockTestsUsed = user?.mockTestsUsed || 0;
  const mockTestLimit = user?.mockTestLimit || 0;
  
  // Define role hierarchies and permissions
  const paidRoles: UserRole[] = ['monthly_pack', 'quarterly_pack', 'annual_pack', 'admin'];
  const isPaidUser = paidRoles.includes(userRole);
  const isAdmin = userRole === 'admin';
  const isGuest = userRole === 'guest';
  const isRegistered = userRole === 'registered';
  
  // Mock test access logic
  const canAccessMockTest = !isGuest; // Guests cannot access mock tests
  const hasReachedMockTestLimit = mockTestLimit !== -1 && mockTestsUsed >= mockTestLimit;
  
  // Calculate remaining mock tests
  const remainingMockTests = mockTestLimit === -1 ? -1 : Math.max(0, mockTestLimit - mockTestsUsed);
  
  // Premium features access (paid users only)
  const canAccessPremiumFeatures = isPaidUser;
  
  /**
   * Check if user can access a specific feature
   */
  const canAccessFeature = (feature: string): boolean => {
    switch (feature) {
      case 'mock_test':
        return canAccessMockTest && !hasReachedMockTestLimit;
      
      case 'quiz_config':
        return !isGuest; // Guests cannot configure quizzes
      
      case 'question_history':
        return isPaidUser; // Only paid users can see question history
      
      case 'reset_questions':
        return isPaidUser; // Only paid users can reset questions
      
      case 'analytics':
        return isPaidUser; // Only paid users get detailed analytics
      
      case 'admin_dashboard':
        return isAdmin; // Only admins can access admin features
      
      case 'unlimited_mock_tests':
        return isPaidUser; // Only paid users get unlimited tests
      
      case 'priority_support':
        return userRole === 'quarterly_pack' || userRole === 'annual_pack' || isAdmin;
      
      case 'advanced_filters':
        return isPaidUser; // Only paid users can use advanced filtering
      
      default:
        return true; // Default to allowing access
    }
  };
  
  /**
   * Get appropriate upgrade message for locked features
   */
  const getUpgradeMessage = (feature?: string): string => {
    if (isGuest) {
      return 'Please create an account to access this feature.';
    }
    
    if (isRegistered) {
      if (feature === 'mock_test' && hasReachedMockTestLimit) {
        return `You've used all ${mockTestLimit} of your free mock tests. Upgrade to get unlimited access!`;
      }
      return 'Upgrade to a paid plan to unlock this premium feature.';
    }
    
    // For paid users who might hit specific limits
    switch (feature) {
      case 'priority_support':
        if (userRole === 'monthly_pack') {
          return 'Upgrade to Quarterly or Annual pack for priority support.';
        }
        break;
      
      default:
        return 'This feature requires a higher subscription tier.';
    }
    
    return 'Upgrade your plan to access this feature.';
  };
  
  return {
    canAccessMockTest,
    hasReachedMockTestLimit,
    canAccessPremiumFeatures,
    isAdmin,
    isPaidUser,
    isGuest,
    isRegistered,
    remainingMockTests,
    canAccessFeature,
    getUpgradeMessage,
  };
}; 