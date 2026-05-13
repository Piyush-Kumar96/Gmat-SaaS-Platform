import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QuizConfig, GMATSection } from '../types';
import { 
  Select, 
  InputNumber, 
  Button, 
  Radio, 
  Tooltip, 
  Alert,
  Typography,
  Modal
} from 'antd';
import { 
  SettingOutlined, 
  ClockCircleOutlined, 
  OrderedListOutlined, 
  TagsOutlined, 
  BarChartOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  BookOutlined,
  CheckCircleFilled,
  ApartmentOutlined,
  RocketOutlined,
  TrophyOutlined,
  BulbOutlined,
  PieChartOutlined,
  CalculatorOutlined,
  CoffeeOutlined,
  SwapOutlined,
  LockOutlined
} from '@ant-design/icons';
import { analytics } from '../services/analytics';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { useAuth } from '../context/AuthContext';
import FeatureLock from '../components/FeatureLock';
import GMATFocusConfig from '../components/GMATFocusConfig';
import PaymentModal from '../components/PaymentModal';

const { Option } = Select;
const { Text, Title } = Typography;

export const ConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { 
    canAccessFeature, 
    isGuest, 
    isRegistered,
    isPaidUser,
    remainingMockTests, 
    hasReachedMockTestLimit,
    getUpgradeMessage 
  } = useRoleAccess();
  
  const [config, setConfig] = useState<QuizConfig>({
    count: 20,
    timeLimit: 30,
    questionTypeMode: 'balanced',
    difficultyMode: 'mixed',
    categoryMode: 'mixed'
  });
  const [questionTypes, setQuestionTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<GMATSection[]>(['Quantitative Reasoning', 'Verbal Reasoning', 'Data Insights']);
  const [breakAfterSection, setBreakAfterSection] = useState(1);
  const redirectMessage = location.state?.message;

  const availableSections: GMATSection[] = ['Quantitative Reasoning', 'Verbal Reasoning', 'Data Insights'];

  // Helper function to handle upgrade clicks
  const handleUpgradeClick = () => {
    if (isGuest) {
      handleUpgradeClick();
    } else {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    // Refresh the page to update user context
    window.location.reload();
  };

  // Load available question types and categories
  useEffect(() => {
    // Track page view
    analytics.trackPageView({
      page_name: 'config',
      path: '/config'
    });
    
    const loadFilterOptions = async () => {
      try {
        setQuestionTypes([
          'Reading Comprehension',
          'Critical Reasoning',
          'Data Sufficiency',
          'Problem Solving'
        ]);
        
        setCategories([
          'Quantitative Reasoning',
          'Verbal Reasoning',
          'Data Insights'
        ]);
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    };
    
    loadFilterOptions();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user can access quiz configuration
    if (!canAccessFeature('quiz_config')) {
      return;
    }
    
    setLoading(true);
    
    // Navigate to quiz with the selected configuration
    navigate('/quiz', { state: { config } });
  };
  
  const handleMockTest = () => {
    // Check if user can access mock tests
    if (!canAccessFeature('mock_test')) {
      return;
    }
    
    setLoading(true);
    navigate('/quiz', { state: { config: {
      count: 35,
      timeLimit: 65,
      questionTypeMode: 'balanced',
      difficultyMode: 'mixed',
      categoryMode: 'mixed',
      isMockTest: true
    }}});
  };
  
  const handleSectionalTest = (section: string) => {
    // Check if user can access sectional tests
    if (!canAccessFeature('quiz_config')) {
      return;
    }
    
    setLoading(true);
    
    let sectionConfig;
    
    if (section === 'data-insights') {
      sectionConfig = {
        count: 20,
        timeLimit: 45,
        questionTypeMode: 'specific',
        selectedQuestionTypes: ['Data Sufficiency'],
        difficultyMode: 'mixed',
        categoryMode: 'mixed', // Allow all categories for data insights
        isSectionalTest: true,
        sectionName: 'Data Insights'
      };
    } else if (section === 'quant') {
      sectionConfig = {
        count: 21,
        timeLimit: 45,
        questionTypeMode: 'specific',
        selectedQuestionTypes: ['Problem Solving'], // Only Problem Solving for Quant
        difficultyMode: 'mixed',
        categoryMode: 'specific',
        selectedCategories: ['Quantitative Reasoning'],
        isSectionalTest: true,
        sectionName: 'Quantitative Reasoning'
      };
    } else { // verbal
      sectionConfig = {
        count: 23,
        timeLimit: 45,
        questionTypeMode: 'specific',
        selectedQuestionTypes: ['Reading Comprehension', 'Critical Reasoning'],
        difficultyMode: 'mixed',
        categoryMode: 'specific',
        selectedCategories: ['Verbal Reasoning'],
        isSectionalTest: true,
        sectionName: 'Verbal Reasoning'
      };
    }
    
    navigate('/quiz', { state: { config: sectionConfig }});
  };

  const handleDIV3Test = () => {
    // Check if user can access sectional tests
    if (!canAccessFeature('quiz_config')) {
      return;
    }

    setLoading(true);

    // Navigate to DI quiz with V3 config
    navigate('/di-quiz', {
      state: {
        config: {
          count: 20,
          timeLimit: 45,
          questionTypes: ['DI-GT', 'DI-MSR', 'DI-TPA'],
          isSectionalTest: true,
          sectionName: 'Data Insights - Advanced',
          useV3: true
        }
      }
    });
  };

  const handleGMATFocusMockTest = (sectionOrder: GMATSection[], breakAfterSection: number) => {
    // Check if user can access mock tests
    if (!canAccessFeature('mock_test')) {
      return;
    }
    
    setLoading(true);
    
    // Create GMAT Focus configuration
    const gmatFocusConfig = {
      isGmatFocus: true,
      sectionOrder,
      breakAfterSection,
      isMockTest: true,
      // Add basic config properties
      count: 64, // Total questions across all sections
      timeLimit: 135, // Total time in minutes
      questionTypeMode: 'balanced' as const,
      difficultyMode: 'mixed' as const,
      categoryMode: 'mixed' as const
    };
    
    navigate('/gmat-focus-quiz', { state: { config: gmatFocusConfig }});
  };

  // Show feature lock for guests
  if (isGuest) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <FeatureLock
              feature="quiz_config"
              title="Quiz Configuration"
              description="Create an account to access quiz configuration and start practicing for your GMAT!"
              upgradeButtonText="Create Free Account"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          
          {/* Page Header */}
          <div className="text-center mb-12">
            <Title level={1} className="text-4xl font-bold mb-4">
              GMAT Practice Center
            </Title>
            <Text className="text-lg text-gray-600">
              Choose your practice mode and customize your learning experience
            </Text>
          </div>

          {redirectMessage && (
            <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-md">
              <Text className="text-blue-700">{redirectMessage}</Text>
            </div>
          )}
          
          {/* Show mock test limit warning for registered users */}
          {!canAccessFeature('unlimited_mock_tests') && remainingMockTests >= 0 && (
            <div className="bg-gray-100 rounded-lg p-6 mb-8 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                    <TrophyOutlined className="text-xl text-gray-600" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                  </div>
                  <div>
                    <Title level={4} className="mb-1 text-gray-800">
                      Mock Tests Remaining: {remainingMockTests}
                    </Title>
                    <Text className="text-gray-600">
                      {remainingMockTests === 0 
                        ? "You've used all your free mock tests. Upgrade to get unlimited access!"
                        : `You have ${remainingMockTests} mock test${remainingMockTests === 1 ? '' : 's'} remaining. Upgrade for unlimited access!`
                      }
                    </Text>
                  </div>
                </div>
                <Button 
                  type="primary" 
                  onClick={handleUpgradeClick}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 border-none text-white font-semibold px-6 py-2 h-auto rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  Upgrade Now
                </Button>
              </div>
            </div>
          )}

          {/* Practice Exams Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <Title level={2} className="text-2xl font-bold mb-2 flex items-center justify-center">
                <TrophyOutlined className="mr-3 text-yellow-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                Practice Exams
              </Title>
              <Text className="text-gray-600">
                Take full-length mock tests or focus on specific sections
              </Text>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* GMAT Focus Edition Mock Test - Dedicated Card */}
              {canAccessFeature('mock_test') ? (
                <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 border border-purple-200">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <RocketOutlined className="text-3xl text-white" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                    </div>
                    <Title level={2} className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
                      GMAT Focus Edition
                    </Title>
                    <Text className="text-base text-gray-600 mb-3">
                      Official Format 3-section test • 64 questions • 135 minutes total
                    </Text>
                  </div>

                  {/* Show different content based on user type */}
                  {isPaidUser ? (
                    <>
                      {/* Section Order Selection - Compact Design */}
                      <div className="mb-6">
                        <div className="flex items-center mb-4">
                          <SwapOutlined className="mr-2 text-purple-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                          <Text className="font-semibold text-gray-800">Choose section order</Text>
                        </div>
                        
                        <div className="space-y-3">
                          {availableSections.map((section, index) => {
                            const currentPosition = sectionOrder.indexOf(section) + 1;
                            return (
                              <div key={section} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    {section === 'Quantitative Reasoning' && (
                                      <CalculatorOutlined className="text-blue-500 text-lg" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                                    )}
                                    {section === 'Verbal Reasoning' && (
                                      <FileTextOutlined className="text-green-500 text-lg" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                                    )}
                                    {section === 'Data Insights' && (
                                      <BarChartOutlined className="text-orange-500 text-lg" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                                    )}
                                    <div>
                                      <div className="font-semibold text-gray-800 text-sm">{section}</div>
                                      <div className="text-xs text-gray-500">
                                        {section === 'Quantitative Reasoning' && '21 questions • 45 min'}
                                        {section === 'Verbal Reasoning' && '23 questions • 45 min'}
                                        {section === 'Data Insights' && '20 questions • 45 min'}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Clickable Number Circles */}
                                  <div className="flex space-x-2">
                                    {[1, 2, 3].map((position) => (
                                      <button
                                        key={position}
                                        onClick={() => {
                                          const newOrder = [...sectionOrder];
                                          // Find current position of this section
                                          const currentIndex = newOrder.indexOf(section);
                                          // Find what's currently at the target position
                                          const targetSection = newOrder[position - 1];
                                          
                                          // Swap positions
                                          newOrder[currentIndex] = targetSection;
                                          newOrder[position - 1] = section;
                                          setSectionOrder(newOrder);
                                        }}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                                          currentPosition === position
                                            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                      >
                                        {position}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Break Configuration - Compact */}
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 mb-6">
                        <div className="flex items-center mb-4">
                          <CoffeeOutlined className="mr-2 text-orange-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                          <Text className="font-semibold text-gray-800 text-sm">Optional 10-minute break</Text>
                        </div>
                        
                        <div className="flex justify-between items-center space-x-4">
                          {[
                            { value: 1, label: 'After 1st section', icon: <CoffeeOutlined className="text-blue-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /> },
                            { value: 2, label: 'After 2nd section', icon: <CoffeeOutlined className="text-blue-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /> },
                            { value: 0, label: 'No break', icon: <ClockCircleOutlined className="text-gray-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /> }
                          ].map((option) => (
                            <div key={option.value} className="flex flex-col items-center space-y-2 flex-1">
                              <button
                                onClick={() => setBreakAfterSection(option.value)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                                  breakAfterSection === option.value
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                              >
                                ✓
                              </button>
                              <div className="text-center">
                                <div className="flex justify-center mb-1">
                                  {option.icon}
                                </div>
                                <Text className="text-xs text-gray-700">{option.label}</Text>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Start Button for Paid Users */}
                      <div className="text-center">
                        <Button
                          type="primary"
                          size="large"
                          className="bg-gradient-to-r from-purple-600 to-blue-600 border-none text-white font-semibold px-12 py-3 h-auto rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                          onClick={() => handleGMATFocusMockTest(sectionOrder, breakAfterSection)}
                          loading={loading}
                        >
                          Start GMAT Focus Test
                        </Button>
                        <div className="mt-3">
                          <Text className="text-xs text-gray-500">
                            Once you start, section order and break options are locked in.
                          </Text>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Free User Content */
                    <div className="text-center">
                      <div className="mb-6">
                        <Text className="text-gray-600 mb-4 block">
                          Get a taste of the official GMAT Focus Edition format with default settings
                        </Text>
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <div className="font-semibold text-gray-700">1st Section</div>
                              <div className="text-gray-600">Quantitative</div>
                              <div className="text-xs text-gray-500">21 questions</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-gray-700">2nd Section</div>
                              <div className="text-gray-600">Verbal</div>
                              <div className="text-xs text-gray-500">23 questions</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-gray-700">3rd Section</div>
                              <div className="text-gray-600">Data Insights</div>
                              <div className="text-xs text-gray-500">20 questions</div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <Text className="text-xs text-gray-600">
                              ☕ 10-minute break after 1st section • Total time: 135 minutes
                            </Text>
                          </div>
                        </div>
                      </div>

                      {/* Free Test Button */}
                      <Button
                        type="primary"
                        size="large"
                        className={`border-none font-semibold px-8 py-3 h-auto rounded-lg transition-all duration-300 shadow-md hover:shadow-lg mb-4 ${
                          hasReachedMockTestLimit
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600'
                        }`}
                        onClick={() => {
                          if (hasReachedMockTestLimit) {
                            handleUpgradeClick();
                            return;
                          }
                          handleGMATFocusMockTest(['Quantitative Reasoning', 'Verbal Reasoning', 'Data Insights'], 1);
                        }}
                        loading={loading}
                        disabled={hasReachedMockTestLimit}
                        icon={hasReachedMockTestLimit ? <LockOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /> : undefined}
                      >
                        {hasReachedMockTestLimit 
                          ? 'Free GMAT Focus Test Used'
                          : 'Start 1 Free Mock GMAT FE Quiz (64 questions - 135 mins)'
                        }
                      </Button>
                      
                      <div className="mb-4">
                        <Text className={`text-xs font-medium ${
                          hasReachedMockTestLimit ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {hasReachedMockTestLimit 
                            ? '🔒 Upgrade for unlimited GMAT Focus tests'
                            : '✓ 1 Free GMAT Focus Edition test available'
                          }
                        </Text>
                      </div>

                      {/* Upgrade Prompt */}
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <Text className="text-sm text-gray-700 mb-2 block">
                          Want to customize section order and break timing?
                        </Text>
                        <Button
                          type="default"
                          size="small"
                          className="bg-gradient-to-r from-yellow-500 to-orange-500 border-none text-white font-medium px-4 py-1 h-auto rounded-md hover:from-yellow-600 hover:to-orange-600 transition-all duration-300"
                          onClick={handleUpgradeClick}
                        >
                          Upgrade Now
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <FeatureLock
                  feature="mock_test"
                  title="GMAT Focus Edition"
                  description="Access the official GMAT Focus Edition mock test with customizable section order"
                >
                  <div className="bg-white rounded-lg shadow-md p-8 border-t-4 border-gray-300 opacity-60">
                    <div className="text-center">
                      <RocketOutlined className="text-6xl text-gray-400 mb-4" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                      <Title level={3} className="text-gray-500 mb-2">
                        GMAT Focus Edition
                      </Title>
                      <Text className="text-gray-500">
                        Upgrade to access the official GMAT Focus Edition mock test
                      </Text>
                    </div>
                  </div>
                </FeatureLock>
              )}
              
              {/* Sectional Tests */}
              <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-all duration-300 border-t-4 border-blue-500">
                <div className="text-center mb-8">
                  <TrophyOutlined className="text-5xl text-blue-500 mb-4" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                  <Title level={2} className="text-2xl font-semibold text-gray-800 mb-2">
                    Sectional Tests
                  </Title>
                  <Text className="text-gray-600">
                    Practice individual GMAT Focus sections
                  </Text>
                </div>
                
                <div className="space-y-4">
                  
                  {/* Data Insights Section */}
                  <div className={`bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 transition-all duration-300 border border-orange-200 ${
                    isRegistered && !isPaidUser 
                      ? 'opacity-70 cursor-not-allowed' 
                      : 'hover:shadow-md cursor-pointer'
                  }`}
                       onClick={() => {
                         if (isRegistered && !isPaidUser) {
                           handleUpgradeClick();
                           return;
                         }
                         handleSectionalTest('data-insights');
                       }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <PieChartOutlined className="text-2xl text-orange-500 mr-4" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Title level={4} className="text-lg font-semibold text-gray-800 mb-0">
                              Data Insights
                            </Title>
                            {isRegistered && !isPaidUser && (
                              <LockOutlined className="text-yellow-600 text-sm" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            )}
                          </div>
                          <div className="text-sm text-gray-600">20 Questions • 45 Minutes</div>
                          <div className="text-xs text-green-600 font-medium">✓ Data Sufficiency Available</div>
                        </div>
                      </div>
                      <button
                        className={`px-4 py-2 font-medium text-sm rounded-md transition-colors flex items-center gap-2 ${
                          isRegistered && !isPaidUser
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-orange-500 hover:bg-orange-600 text-white'
                        }`}
                        disabled={loading || (isRegistered && !isPaidUser)}
                        onClick={(e) => {
                          if (isRegistered && !isPaidUser) {
                            e.stopPropagation();
                            handleUpgradeClick();
                          }
                        }}
                      >
                        {isRegistered && !isPaidUser ? (
                          <>
                            <LockOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            Locked
                          </>
                        ) : (
                          'Start'
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Quantitative Section */}
                  <div className={`bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 transition-all duration-300 border border-blue-200 ${
                    isRegistered && !isPaidUser 
                      ? 'opacity-70 cursor-not-allowed' 
                      : 'hover:shadow-md cursor-pointer'
                  }`}
                       onClick={() => {
                         if (isRegistered && !isPaidUser) {
                           handleUpgradeClick();
                           return;
                         }
                         handleSectionalTest('quant');
                       }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <BarChartOutlined className="text-2xl text-blue-500 mr-4" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Title level={4} className="text-lg font-semibold text-gray-800 mb-0">
                              Quantitative
                            </Title>
                            {isRegistered && !isPaidUser && (
                              <LockOutlined className="text-yellow-600 text-sm" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            )}
                          </div>
                          <div className="text-sm text-gray-600">21 Questions • 45 Minutes</div>
                          <div className="text-xs text-green-600 font-medium">✓ Problem Solving Only</div>
                        </div>
                      </div>
                      <button
                        className={`px-4 py-2 font-medium text-sm rounded-md transition-colors flex items-center gap-2 ${
                          isRegistered && !isPaidUser
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                        disabled={loading || (isRegistered && !isPaidUser)}
                        onClick={(e) => {
                          if (isRegistered && !isPaidUser) {
                            e.stopPropagation();
                            handleUpgradeClick();
                          }
                        }}
                      >
                        {isRegistered && !isPaidUser ? (
                          <>
                            <LockOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            Locked
                          </>
                        ) : (
                          'Start'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Verbal Section */}
                  <div className={`bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 transition-all duration-300 border border-green-200 ${
                    isRegistered && !isPaidUser
                      ? 'opacity-70 cursor-not-allowed'
                      : 'hover:shadow-md cursor-pointer'
                  }`}
                       onClick={() => {
                         if (isRegistered && !isPaidUser) {
                           handleUpgradeClick();
                           return;
                         }
                         handleSectionalTest('verbal');
                       }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileTextOutlined className="text-2xl text-green-500 mr-4" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Title level={4} className="text-lg font-semibold text-gray-800 mb-0">
                              Verbal Reasoning
                            </Title>
                            {isRegistered && !isPaidUser && (
                              <LockOutlined className="text-yellow-600 text-sm" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            )}
                          </div>
                          <div className="text-sm text-gray-600">23 Questions • 45 Minutes</div>
                          <div className="text-xs text-green-600 font-medium">✓ Reading Comprehension & Critical Reasoning</div>
                        </div>
                      </div>
                      <button
                        className={`px-4 py-2 font-medium text-sm rounded-md transition-colors flex items-center gap-2 ${
                          isRegistered && !isPaidUser
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                        disabled={loading || (isRegistered && !isPaidUser)}
                        onClick={(e) => {
                          if (isRegistered && !isPaidUser) {
                            e.stopPropagation();
                            handleUpgradeClick();
                          }
                        }}
                      >
                        {isRegistered && !isPaidUser ? (
                          <>
                            <LockOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            Locked
                          </>
                        ) : (
                          'Start'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Data Insights - Advanced (GT, MSR, TPA) */}
                  <div className={`bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 transition-all duration-300 border border-purple-200 hover:shadow-md cursor-pointer`}
                       onClick={() => handleDIV3Test()}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <BarChartOutlined className="text-2xl text-purple-500 mr-4" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Title level={4} className="text-lg font-semibold text-gray-800 mb-0">
                              Data Insights - Advanced
                            </Title>
                            <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">NEW</span>
                          </div>
                          <div className="text-sm text-gray-600">20 Questions • 45 Minutes</div>
                          <div className="text-xs text-purple-600 font-medium">✓ Graphs & Tables, Multi-Source Reasoning, Two-Part Analysis</div>
                        </div>
                      </div>
                      <button
                        className="px-4 py-2 font-medium text-sm rounded-md transition-colors bg-purple-500 hover:bg-purple-600 text-white"
                        disabled={loading}
                      >
                        Start
                      </button>
                    </div>
                  </div>

                  {/* Traditional Mix Bag - Lock when free user has used their mock tests */}
                  <div className={`bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 transition-all duration-300 border border-gray-200 ${
                    (isRegistered && !isPaidUser && hasReachedMockTestLimit)
                      ? 'opacity-70 cursor-not-allowed' 
                      : 'hover:shadow-md cursor-pointer'
                  }`}
                       onClick={() => {
                         if (isRegistered && !isPaidUser && hasReachedMockTestLimit) {
                           handleUpgradeClick();
                           return;
                         }
                         handleMockTest();
                       }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <TrophyOutlined className="text-2xl text-gray-500 mr-4" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Title level={4} className="text-lg font-semibold text-gray-800 mb-0">
                              Mix Bag (Traditional)
                            </Title>
                            {isRegistered && !isPaidUser && hasReachedMockTestLimit && (
                              <LockOutlined className="text-yellow-600 text-sm" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            )}
                          </div>
                          <div className="text-sm text-gray-600">35 Questions • 65 Minutes</div>
                          <div className="text-xs text-green-600 font-medium">✓ Balanced mix from all GMAT areas</div>
                        </div>
                      </div>
                      <button
                        className={`px-4 py-2 font-medium text-sm rounded-md transition-colors flex items-center gap-2 ${
                          (isRegistered && !isPaidUser && hasReachedMockTestLimit)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gray-500 hover:bg-gray-600 text-white'
                        }`}
                        disabled={loading || (isRegistered && !isPaidUser && hasReachedMockTestLimit)}
                        onClick={(e) => {
                          if (isRegistered && !isPaidUser && hasReachedMockTestLimit) {
                            e.stopPropagation();
                            handleUpgradeClick();
                          }
                        }}
                      >
                        {(isRegistered && !isPaidUser && hasReachedMockTestLimit) ? (
                          <>
                            <LockOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            Locked
                          </>
                        ) : (
                          'Start'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Quiz Configuration */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <Title level={2} className="text-2xl font-bold mb-2 flex items-center justify-center">
                <SettingOutlined className="mr-3 text-blue-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                Custom Quiz Configuration
              </Title>
              <Text className="text-gray-600">
                Create a personalized quiz tailored to your learning needs
              </Text>
            </div>

            {canAccessFeature('advanced_filters') ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <form onSubmit={handleSubmit} className="space-y-0">
                  
                  {/* Basic Settings */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 border-b border-gray-200">
                    <div className="flex items-center mb-6">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold text-lg">1</span>
                      </div>
                      <Title level={3} className="mb-0 text-gray-800">Basic Configuration</Title>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Quiz Length Selector */}
                      <div>
                        <div className="flex items-center mb-4">
                          <OrderedListOutlined className="text-xl text-blue-500 mr-2" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                          <Title level={5} className="mb-0 text-gray-700">Number of Questions</Title>
                        </div>
                        
                        {/* Custom Number Selector */}
                        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <button
                              type="button"
                              onClick={() => setConfig({...config, count: Math.max(5, config.count - 5)})}
                              className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors"
                            >
                              -
                            </button>
                            <div className="text-center">
                              <div className="text-3xl font-bold text-gray-800">{config.count}</div>
                              <div className="text-sm text-gray-500">questions</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setConfig({...config, count: Math.min(50, config.count + 5)})}
                              className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors"
                            >
                              +
                            </button>
                          </div>
                          
                          {/* Quick Selection */}
                          <div className="grid grid-cols-4 gap-2">
                            {[10, 20, 30, 40].map(num => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setConfig({...config, count: num})}
                                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                  config.count === num
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <Text type="secondary" className="text-sm mt-2 block">
                          💡 Recommended: 20-35 questions for effective practice
                        </Text>
                      </div>
                      
                      {/* Time Limit Selector */}
                      <div>
                        <div className="flex items-center mb-4">
                          <ClockCircleOutlined className="text-xl text-green-500 mr-2" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                          <Title level={5} className="mb-0 text-gray-700">Time Limit</Title>
                        </div>
                        
                        {/* Custom Time Selector */}
                        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <button
                              type="button"
                              onClick={() => setConfig({...config, timeLimit: Math.max(5, config.timeLimit - 5)})}
                              className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors"
                            >
                              -
                            </button>
                            <div className="text-center">
                              <div className="text-3xl font-bold text-gray-800">{config.timeLimit}</div>
                              <div className="text-sm text-gray-500">minutes</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setConfig({...config, timeLimit: Math.min(120, config.timeLimit + 5)})}
                              className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors"
                            >
                              +
                            </button>
                          </div>
                          
                          {/* Quick Selection */}
                          <div className="grid grid-cols-4 gap-2">
                            {[15, 30, 45, 60].map(time => (
                              <button
                                key={time}
                                type="button"
                                onClick={() => setConfig({...config, timeLimit: time})}
                                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                  config.timeLimit === time
                                    ? 'bg-green-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-600'
                                }`}
                              >
                                {time}m
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <Text type="secondary" className="text-sm mt-2 block">
                          ⏱️ GMAT Focus: ~1.8 minutes per question
                        </Text>
                      </div>
                    </div>
                  </div>

                  {/* Question Types */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-8 border-b border-gray-200">
                    <div className="flex items-center mb-6">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold text-lg">2</span>
                      </div>
                      <Title level={3} className="mb-0 text-gray-800">Question Types</Title>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button
                        type="button"
                        onClick={() => setConfig({...config, questionTypeMode: 'balanced'})}
                        className={`p-6 rounded-xl border-2 transition-all text-left ${
                          config.questionTypeMode === 'balanced'
                            ? 'border-purple-500 bg-purple-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                            config.questionTypeMode === 'balanced'
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {config.questionTypeMode === 'balanced' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <Title level={4} className="mb-0 text-gray-800">🎯 Balanced Mix</Title>
                        </div>
                        <Text className="text-gray-600">
                          Automatically balanced distribution across all question types for comprehensive practice
                        </Text>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setConfig({...config, questionTypeMode: 'specific'})}
                        className={`p-6 rounded-xl border-2 transition-all text-left ${
                          config.questionTypeMode === 'specific'
                            ? 'border-purple-500 bg-purple-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                            config.questionTypeMode === 'specific'
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {config.questionTypeMode === 'specific' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <Title level={4} className="mb-0 text-gray-800">🎛️ Custom Selection</Title>
                        </div>
                        <Text className="text-gray-600">
                          Choose exactly which question types to include in your practice session
                        </Text>
                      </button>
                    </div>
                    
                    {/* Question Type Selection */}
                    {config.questionTypeMode === 'specific' && (
                      <div className="mt-6 p-6 bg-white rounded-xl border border-gray-200">
                        <Title level={5} className="mb-4 text-gray-700">Select Question Types:</Title>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {questionTypes.map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const selected = config.selectedQuestionTypes || [];
                                const newSelected = selected.includes(type)
                                  ? selected.filter(t => t !== type)
                                  : [...selected, type];
                                setConfig({...config, selectedQuestionTypes: newSelected});
                              }}
                              className={`p-4 rounded-lg border-2 transition-all text-left ${
                                (config.selectedQuestionTypes || []).includes(type)
                                  ? 'border-purple-500 bg-purple-50 shadow-md'
                                  : 'border-gray-200 bg-white hover:border-purple-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">{type}</span>
                                {(config.selectedQuestionTypes || []).includes(type) && (
                                  <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">✓</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Difficulty Level */}
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 p-8 border-b border-gray-200">
                    <div className="flex items-center mb-6">
                      <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold text-lg">3</span>
                      </div>
                      <Title level={3} className="mb-0 text-gray-800">Difficulty Level</Title>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button
                        type="button"
                        onClick={() => setConfig({...config, difficultyMode: 'mixed'})}
                        className={`p-6 rounded-xl border-2 transition-all text-left ${
                          config.difficultyMode === 'mixed'
                            ? 'border-orange-500 bg-orange-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                            config.difficultyMode === 'mixed'
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-gray-300'
                          }`}>
                            {config.difficultyMode === 'mixed' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <Title level={4} className="mb-0 text-gray-800">🌟 Mixed Difficulty</Title>
                        </div>
                        <Text className="text-gray-600">
                          Questions of varying difficulty levels (recommended for comprehensive practice)
                        </Text>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setConfig({...config, difficultyMode: 'specific'})}
                        className={`p-6 rounded-xl border-2 transition-all text-left ${
                          config.difficultyMode === 'specific'
                            ? 'border-orange-500 bg-orange-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                            config.difficultyMode === 'specific'
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-gray-300'
                          }`}>
                            {config.difficultyMode === 'specific' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <Title level={4} className="mb-0 text-gray-800">🎯 Target Difficulty</Title>
                        </div>
                        <Text className="text-gray-600">
                          Focus on specific difficulty levels for targeted improvement
                        </Text>
                      </button>
                    </div>
                    
                    {/* Difficulty Selection */}
                    {config.difficultyMode === 'specific' && (
                      <div className="mt-6 p-6 bg-white rounded-xl border border-gray-200">
                        <Title level={5} className="mb-4 text-gray-700">Select Difficulty Levels:</Title>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { value: 'easy', label: 'Easy', range: '600-650', color: 'green', emoji: '🟢' },
                            { value: 'medium', label: 'Medium', range: '650-700', color: 'yellow', emoji: '🟡' },
                            { value: 'hard', label: 'Hard', range: '700+', color: 'red', emoji: '🔴' }
                          ].map(difficulty => (
                            <button
                              key={difficulty.value}
                              type="button"
                              onClick={() => {
                                const selected = config.selectedDifficulties || [];
                                const newSelected = selected.includes(difficulty.value)
                                  ? selected.filter(d => d !== difficulty.value)
                                  : [...selected, difficulty.value];
                                setConfig({...config, selectedDifficulties: newSelected});
                              }}
                              className={`p-4 rounded-lg border-2 transition-all text-center ${
                                (config.selectedDifficulties || []).includes(difficulty.value)
                                  ? `border-${difficulty.color}-500 bg-${difficulty.color}-50 shadow-md`
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              <div className="text-2xl mb-2">{difficulty.emoji}</div>
                              <div className="font-medium text-gray-800">{difficulty.label}</div>
                              <div className="text-sm text-gray-600">{difficulty.range} level</div>
                              {(config.selectedDifficulties || []).includes(difficulty.value) && (
                                <div className="mt-2">
                                  <div className={`w-5 h-5 bg-${difficulty.color}-500 rounded-full flex items-center justify-center mx-auto`}>
                                    <span className="text-white text-xs">✓</span>
                                  </div>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Categories */}
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-8 border-b border-gray-200">
                    <div className="flex items-center mb-6">
                      <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold text-lg">4</span>
                      </div>
                      <Title level={3} className="mb-0 text-gray-800">Content Categories</Title>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button
                        type="button"
                        onClick={() => setConfig({...config, categoryMode: 'mixed'})}
                        className={`p-6 rounded-xl border-2 transition-all text-left ${
                          config.categoryMode === 'mixed'
                            ? 'border-indigo-500 bg-indigo-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                            config.categoryMode === 'mixed'
                              ? 'border-indigo-500 bg-indigo-500'
                              : 'border-gray-300'
                          }`}>
                            {config.categoryMode === 'mixed' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <Title level={4} className="mb-0 text-gray-800">🌐 All Categories</Title>
                        </div>
                        <Text className="text-gray-600">
                          Questions from all available GMAT Focus categories for well-rounded practice
                        </Text>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setConfig({...config, categoryMode: 'specific'})}
                        className={`p-6 rounded-xl border-2 transition-all text-left ${
                          config.categoryMode === 'specific'
                            ? 'border-indigo-500 bg-indigo-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                            config.categoryMode === 'specific'
                              ? 'border-indigo-500 bg-indigo-500'
                              : 'border-gray-300'
                          }`}>
                            {config.categoryMode === 'specific' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <Title level={4} className="mb-0 text-gray-800">📚 Specific Sections</Title>
                        </div>
                        <Text className="text-gray-600">
                          Focus on particular GMAT sections for targeted skill development
                        </Text>
                      </button>
                    </div>
                    
                    {/* Category Selection */}
                    {config.categoryMode === 'specific' && (
                      <div className="mt-6 p-6 bg-white rounded-xl border border-gray-200">
                        <Title level={5} className="mb-4 text-gray-700">Select Categories:</Title>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {categories.map(category => (
                            <button
                              key={category}
                              type="button"
                              onClick={() => {
                                const selected = config.selectedCategories || [];
                                const newSelected = selected.includes(category)
                                  ? selected.filter(c => c !== category)
                                  : [...selected, category];
                                setConfig({...config, selectedCategories: newSelected});
                              }}
                              className={`p-4 rounded-lg border-2 transition-all text-center ${
                                (config.selectedCategories || []).includes(category)
                                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                                  : 'border-gray-200 bg-white hover:border-indigo-300'
                              }`}
                            >
                              <div className="font-medium text-gray-800 mb-1">{category}</div>
                              {(config.selectedCategories || []).includes(category) && (
                                <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center mx-auto">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Optional "Ready for Quiz" filter — opt-in.
                      When on, the random pull is restricted to questions an
                      editor has flipped as ready in the question bank. Off by
                      default so the pool stays large. */}
                  <div className="px-8 pb-6">
                    <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 border-gray-200 hover:border-indigo-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!config.onlyReadyForQuiz}
                        onChange={(e) =>
                          setConfig({ ...config, onlyReadyForQuiz: e.target.checked })
                        }
                        className="mt-1 h-4 w-4 text-indigo-600"
                      />
                      <div>
                        <div className="font-medium text-gray-800">
                          Use only editor-vetted questions
                        </div>
                        <div className="text-sm text-gray-500">
                          Restrict to questions an editor has marked "Ready for
                          Quiz". Pool may be smaller; off by default.
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <div className="bg-gradient-to-r from-gray-50 to-white p-8 text-center">
                    <div className="max-w-md mx-auto">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:transform-none flex items-center justify-center space-x-3"
                      >
                        {loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-lg">Creating Your Quiz...</span>
                          </>
                        ) : (
                          <>
                            <PlayCircleOutlined className="text-xl" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                            <span className="text-lg">Start Custom Quiz</span>
                          </>
                        )}
                      </button>
                      
                      <div className="mt-4 flex items-center justify-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span>{config.count} Questions</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          <span>{config.timeLimit} Minutes</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                          <span>Custom Config</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <FeatureLock
                feature="advanced_filters"
                title="Advanced Quiz Configuration"
                description="Customize your practice with advanced filtering options"
              >
                <div className="bg-white rounded-lg shadow-md p-8 border-t-4 border-gray-300 opacity-60">
                  <div className="text-center">
                    <BulbOutlined className="text-6xl text-gray-400 mb-4" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                    <Title level={3} className="text-gray-500 mb-2">
                      Advanced Configuration
                    </Title>
                    <Text className="text-gray-500">
                      Upgrade to access custom quiz configuration with advanced filtering options
                    </Text>
                  </div>
                </div>
              </FeatureLock>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {!isGuest && user && (
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
    </div>
  );
}; 