import React, { useState } from 'react';
import { Typography } from 'antd';
import { LockOutlined, CrownOutlined, RocketOutlined, StarFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { useAuth } from '../context/AuthContext';
import PaymentModal from './PaymentModal';

const { Title, Text } = Typography;

interface FeatureLockProps {
  feature: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  showUpgradeButton?: boolean;
  upgradeButtonText?: string;
  icon?: React.ReactNode;
}

/**
 * Component to display locked features with upgrade prompts
 */
export const FeatureLock: React.FC<FeatureLockProps> = ({
  feature,
  title,
  description,
  children,
  showUpgradeButton = true,
  upgradeButtonText = 'Upgrade Now',
  icon
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccessFeature, getUpgradeMessage, isGuest } = useRoleAccess();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // If user can access the feature, render children
  if (canAccessFeature(feature)) {
    return <>{children}</>;
  }
  
  // Determine the appropriate icon and styling based on user type
  const isGuestUser = isGuest;
  const lockIcon = icon || (
    isGuestUser ? (
      <LockOutlined className="text-6xl text-blue-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
    ) : (
      <CrownOutlined className="text-6xl text-yellow-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
    )
  );
  
  // Handle upgrade button click
  const handleUpgrade = () => {
    if (isGuestUser) {
      navigate('/register');
    } else {
      // Show payment modal for registered users
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    // Refresh the page or update user context
    window.location.reload();
  };
  
  const upgradeMessage = getUpgradeMessage(feature);
  
  return (
    <>
      <div className="relative overflow-hidden bg-white rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full transform translate-x-16 -translate-y-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-400 to-yellow-400 rounded-full transform -translate-x-12 translate-y-12"></div>
        </div>
        
        {/* Content */}
        <div className="relative p-8 text-center">
          {/* Icon Section */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4 shadow-inner">
              {lockIcon}
            </div>
            
            {/* Premium Badge for paid features */}
            {!isGuestUser && (
              <div className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold rounded-full shadow-lg">
                <StarFilled className="mr-1" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                PREMIUM FEATURE
              </div>
            )}
          </div>
          
          {/* Title Section */}
          <div className="mb-6">
            <Title level={2} className="text-2xl font-bold text-gray-800 mb-3">
              {title}
            </Title>
            
            {description && (
              <Text className="text-lg text-gray-600 leading-relaxed block">
                {description}
              </Text>
            )}
          </div>
          
          {/* Message Section */}
          <div className="mb-8">
            <div className={`p-4 rounded-lg border-l-4 ${
              isGuestUser 
                ? 'bg-blue-50 border-blue-400' 
                : 'bg-yellow-50 border-yellow-400'
            }`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 ${
                  isGuestUser ? 'text-blue-500' : 'text-yellow-500'
                }`}>
                  {isGuestUser ? (
                    <LockOutlined className="text-xl mt-0.5" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                  ) : (
                    <CrownOutlined className="text-xl mt-0.5" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                  )}
                </div>
                <div className="ml-3 text-left">
                  <Text className={`font-medium ${
                    isGuestUser ? 'text-blue-800' : 'text-yellow-800'
                  }`}>
                    {isGuestUser ? 'Account Required' : 'Premium Feature'}
                  </Text>
                  <Text className={`block text-sm mt-1 ${
                    isGuestUser ? 'text-blue-700' : 'text-yellow-700'
                  }`}>
                    {upgradeMessage}
                  </Text>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Button */}
          {showUpgradeButton && (
            <div className="space-y-3">
              <button
                onClick={handleUpgrade}
                className={`w-full px-8 py-4 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
                  isGuestUser
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:ring-blue-300'
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 focus:ring-yellow-300'
                }`}
              >
                <div className="flex items-center justify-center">
                  <RocketOutlined className="mr-2 text-lg" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                  <span className="text-lg">
                    {isGuestUser ? 'Create Free Account' : upgradeButtonText}
                  </span>
                </div>
              </button>
              
              {/* Additional info */}
              <Text type="secondary" className="text-sm block">
                {isGuestUser 
                  ? '✨ Start with 2 free mock tests • No credit card required'
                  : '🚀 Unlock unlimited access • Cancel anytime'
                }
              </Text>
            </div>
          )}
          
          {/* Features preview for guests */}
          {isGuestUser && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <Text className="text-sm font-medium text-gray-700 block mb-4 text-center">
                What you'll get with a free account:
              </Text>
              <div className="flex justify-center gap-3 flex-wrap">
                <div className="flex items-center px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-700 font-semibold">2 Free Mock Tests</span>
                </div>
                <div className="flex items-center px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-700 font-semibold">Basic Analytics</span>
                </div>
                <div className="flex items-center px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-700 font-semibold">Question Explanations</span>
                </div>
                <div className="flex items-center px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-700 font-semibold">Progress Tracking</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {!isGuestUser && user && (
        <PaymentModal
          visible={showPaymentModal}
          onCancel={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
          userDetails={{
            name: user.fullName,
            email: user.email
          }}
        />
      )}
    </>
  );
};

export default FeatureLock; 