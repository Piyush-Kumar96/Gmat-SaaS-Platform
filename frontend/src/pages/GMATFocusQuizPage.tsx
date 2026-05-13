import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Alert, Typography, Progress, Card, Modal } from 'antd';
import {
  ClockCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CoffeeOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { QuizConfig, GMATSection } from '../types';
import { Question } from '../types/quiz';
import { getRandomQuestionsV2, getRandomQuestionsV3, getVerbalQuiz, getDataInsightsQuiz, submitQuiz } from '../services/api';
import { analytics } from '../services/analytics';
import QuestionCard from '../components/QuestionCard';
import { flattenMsrSubQuestions, countAnsweredSubItems } from '../utils/flattenQuiz';

const { Title, Text } = Typography;

interface GMATFocusState {
  currentSection: number;
  sectionsCompleted: boolean[];
  sectionResults: any[];
  isOnBreak: boolean;
  breakTimeLeft: number;
  totalTestTime: number;
}

interface SectionConfig {
  name: GMATSection;
  questionCount: number;
  timeLimit: number;
  questionTypes: string[];
  categories: string[];
  icon: React.ReactNode;
  color: string;
  useV3?: boolean; // Flag to use QuestionBagV3 API
}

const GMATFocusQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = location.state?.config as QuizConfig;

  // GMAT Focus State
  const [gmatState, setGmatState] = useState<GMATFocusState>({
    currentSection: 0,
    sectionsCompleted: [false, false, false],
    sectionResults: [],
    isOnBreak: false,
    breakTimeLeft: 600, // 10 minutes in seconds
    totalTestTime: 0
  });

  // Current Section Quiz State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use ref to store latest callback without causing re-renders
  const handleSectionCompleteRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Section Configurations
  // NOTE: `categories` is intentionally empty. Stored docs use mixed values
  // (e.g. PS rows have `category: 'Quantitative'`, not 'Quantitative Reasoning')
  // and `questionType` is already a sufficient discriminator. Adding a stale
  // category string here filtered every PS question out and made the Quant
  // section come back empty.
  const sectionConfigs: SectionConfig[] = [
    {
      name: 'Quantitative Reasoning',
      questionCount: 21,
      timeLimit: 45,
      questionTypes: ['Problem Solving'],
      categories: [],
      icon: <CalculatorOutlined onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined} />,
      color: '#1890ff'
    },
    {
      name: 'Verbal Reasoning',
      questionCount: 23,
      timeLimit: 45,
      questionTypes: ['Reading Comprehension', 'Critical Reasoning'],
      categories: [],
      icon: <FileTextOutlined onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined} />,
      color: '#52c41a'
    },
    {
      name: 'Data Insights',
      questionCount: 20,
      timeLimit: 45,
      questionTypes: ['DI-DS', 'DI-GT', 'DI-MSR', 'DI-TPA'],
      categories: [],
      icon: <BarChartOutlined onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined} />,
      color: '#722ed1',
      useV3: true // Flag to use QuestionBagV3
    }
  ];

  // Get current section configuration
  const getCurrentSectionConfig = useCallback((): SectionConfig => {
    const sectionName = config?.sectionOrder?.[gmatState.currentSection] || 'Quantitative Reasoning';
    return sectionConfigs.find(s => s.name === sectionName) || sectionConfigs[0];
  }, [config, gmatState.currentSection]);

  // Load current section quiz
  const loadCurrentSection = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const currentSectionConfig = getCurrentSectionConfig();

      // Create section-specific quiz config
      const filters: any = {};

      // Set up filters for the specific section
      if (currentSectionConfig.questionTypes.length > 0) {
        filters.questionTypes = currentSectionConfig.questionTypes;
      }

      if (currentSectionConfig.categories.length > 0) {
        filters.categories = currentSectionConfig.categories;
      }

      // Routing:
      //   - Data Insights → V3 (GT/MSR/TPA) + V2 (Data Sufficiency) — V3
      //     has no DI-DS bank yet, so we splice in V2 DS to keep the GMAT
      //     section composition realistic.
      //   - Verbal → V3-RC if available, else V2-RC fallback + V2-CR
      //     (RC migration is per-passage and incomplete)
      //   - Quant / other → V2
      let quiz;
      if (currentSectionConfig.name === 'Data Insights') {
        quiz = await getDataInsightsQuiz(
          currentSectionConfig.questionCount,
          currentSectionConfig.timeLimit
        );
      } else if (currentSectionConfig.useV3) {
        quiz = await getRandomQuestionsV3(
          currentSectionConfig.questionCount,
          currentSectionConfig.timeLimit,
          filters
        );
      } else if (currentSectionConfig.name === 'Verbal Reasoning') {
        quiz = await getVerbalQuiz(
          currentSectionConfig.questionCount,
          currentSectionConfig.timeLimit
        );
      } else {
        quiz = await getRandomQuestionsV2(
          currentSectionConfig.questionCount,
          currentSectionConfig.timeLimit,
          filters
        );
      }

      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        throw new Error(`No questions available for ${currentSectionConfig.name}`);
      }

      setQuizId(quiz.quizId);
      // Flatten MSR stems so each sub-question is its own pager step.
      setQuestions(flattenMsrSubQuestions(quiz.questions));
      setCurrentQuestionIndex(0);
      setAnswers({});
      setFlaggedQuestions([]);
      setTimeLeft(currentSectionConfig.timeLimit * 60); // Convert minutes to seconds
      setTotalTimeSpent(0);
      setIsPaused(false);

      // Track section started
      analytics.trackQuizStarted({
        quizId: quiz.quizId,
        count: currentSectionConfig.questionCount,
        timeLimit: currentSectionConfig.timeLimit
      });

    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to load ${getCurrentSectionConfig().name}: ${err.message}`
          : `Failed to load ${getCurrentSectionConfig().name}. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  }, [gmatState.currentSection, config, getCurrentSectionConfig]);

  // Handle section completion
  const handleSectionComplete = useCallback(async () => {
    if (!quizId) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit current section
      const submission = await submitQuiz(quizId, answers, totalTimeSpent, {
        mode: 'gmat-focus',
      });

      const currentSectionConfig = getCurrentSectionConfig();
      const sectionResult = {
        sectionIndex: gmatState.currentSection,
        sectionName: currentSectionConfig.name,
        submission: submission,
        timeSpent: totalTimeSpent,
        questionCount: questions.length,
        answers: answers
      };

      // Update GMAT state
      const newSectionsCompleted = [...gmatState.sectionsCompleted];
      newSectionsCompleted[gmatState.currentSection] = true;

      const newSectionResults = [...gmatState.sectionResults, sectionResult];
      const newTotalTime = gmatState.totalTestTime + totalTimeSpent;

      // Check if all sections are complete
      const nextSectionIndex = gmatState.currentSection + 1;

      if (nextSectionIndex >= 3) {
        // All sections complete - go to results
        navigate('/results', {
          state: {
            isGmatFocus: true,
            gmatResults: {
              sectionResults: newSectionResults,
              totalTime: newTotalTime,
              sectionOrder: config.sectionOrder
            }
          }
        });
        return;
      }

      // Check if break should be offered
      if (config.breakAfterSection && config.breakAfterSection === nextSectionIndex) {
        setGmatState(prev => ({
          ...prev,
          sectionsCompleted: newSectionsCompleted,
          sectionResults: newSectionResults,
          totalTestTime: newTotalTime,
          isOnBreak: true,
          breakTimeLeft: 600 // Reset to 10 minutes
        }));
      } else {
        // Move to next section immediately
        setGmatState(prev => ({
          ...prev,
          sectionsCompleted: newSectionsCompleted,
          sectionResults: newSectionResults,
          totalTestTime: newTotalTime,
          currentSection: nextSectionIndex
        }));
      }

    } catch (err) {
      setError('Failed to complete section. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    quizId,
    answers,
    totalTimeSpent,
    gmatState.currentSection,
    gmatState.sectionsCompleted,
    gmatState.sectionResults,
    gmatState.totalTestTime,
    getCurrentSectionConfig,
    questions.length,
    config.sectionOrder,
    config.breakAfterSection,
    navigate
  ]);

  // Store the latest handleSectionComplete in ref
  useEffect(() => {
    handleSectionCompleteRef.current = handleSectionComplete;
  }, [handleSectionComplete]);

  // Initialize quiz when component mounts or verify config
  useEffect(() => {
    if (!config || !config.isGmatFocus) {
      navigate('/config');
      return;
    }
  }, [config, navigate]);

  // Load section when currentSection changes and not on break
  useEffect(() => {
    if (!config || !config.isGmatFocus) return;

    if (!gmatState.isOnBreak) {
      loadCurrentSection();
    }
  }, [gmatState.currentSection, gmatState.isOnBreak, config, loadCurrentSection]);

  // Timer effect for current section
  useEffect(() => {
    if (loading || isPaused || gmatState.isOnBreak) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up for this section
          if (handleSectionCompleteRef.current) {
            handleSectionCompleteRef.current();
          }
          return 0;
        }
        return prev - 1;
      });

      setTotalTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isPaused, gmatState.isOnBreak]);

  // Break timer effect
  useEffect(() => {
    if (!gmatState.isOnBreak) return;

    const timer = setInterval(() => {
      setGmatState(prev => {
        const newTimeLeft = Math.max(0, prev.breakTimeLeft - 1);

        // Auto-end break when timer reaches 0
        if (newTimeLeft === 0) {
          return {
            ...prev,
            isOnBreak: false,
            currentSection: prev.currentSection + 1,
            breakTimeLeft: 0
          };
        }

        return {
          ...prev,
          breakTimeLeft: newTimeLeft
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gmatState.isOnBreak]);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle answer selection
  const handleAnswerSelect = (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setAnswers(prev => ({
      ...prev,
      [currentQuestion._id]: answer
    }));
  };

  // Navigate to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  // Navigate to previous question
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // Toggle question flag
  const toggleFlag = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setFlaggedQuestions(prev =>
      prev.includes(currentQuestion._id)
        ? prev.filter(id => id !== currentQuestion._id)
        : [...prev, currentQuestion._id]
    );
  };

  // End break early
  const endBreakEarly = () => {
    setGmatState(prev => ({
      ...prev,
      isOnBreak: false,
      currentSection: prev.currentSection + 1
    }));
  };

  // Render break screen
  if (gmatState.isOnBreak) {
    const nextSectionConfig = sectionConfigs.find(s =>
      s.name === config.sectionOrder?.[gmatState.currentSection + 1]
    );

    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        fontFamily: 'Arial, Helvetica, sans-serif'
      }}>
        <div style={{
          maxWidth: '600px',
          width: '100%',
          padding: '48px',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <CoffeeOutlined
            style={{ fontSize: '64px', color: '#007396', marginBottom: '24px' }}
            onPointerEnterCapture={undefined}
            onPointerLeaveCapture={undefined}
          />

          <h2 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#333333',
            margin: '0 0 16px 0'
          }}>
            Optional Break
          </h2>

          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: '0 0 32px 0',
            lineHeight: '1.6'
          }}>
            You've completed Section {gmatState.currentSection + 1}. You may take a break or continue to the next section.
          </p>

          <div style={{
            backgroundColor: '#F0F9FF',
            border: '2px solid #007396',
            borderRadius: '8px',
            padding: '32px',
            marginBottom: '32px'
          }}>
            <div style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#007396',
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              {formatTime(gmatState.breakTimeLeft)}
            </div>
            <div style={{
              fontSize: '14px',
              color: '#6B7280',
              fontWeight: 500
            }}>
              Break time remaining
            </div>
          </div>

          {nextSectionConfig && (
            <div style={{
              backgroundColor: '#F9FAFB',
              borderRadius: '6px',
              padding: '20px',
              marginBottom: '32px',
              border: '1px solid #E5E7EB'
            }}>
              <div style={{
                fontSize: '13px',
                color: '#6B7280',
                marginBottom: '12px',
                fontWeight: 500
              }}>
                NEXT SECTION
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#333333',
                marginBottom: '8px'
              }}>
                {nextSectionConfig.name}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#6B7280'
              }}>
                {nextSectionConfig.questionCount} questions • {nextSectionConfig.timeLimit} minutes
              </div>
            </div>
          )}

          <button
            onClick={endBreakEarly}
            style={{
              padding: '14px 32px',
              backgroundColor: '#007396',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              color: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(0,115,150,0.3)',
              width: '100%'
            }}
          >
            Continue to Next Section
          </button>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading) {
    const currentSectionConfig = getCurrentSectionConfig();
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        fontFamily: 'Arial, Helvetica, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          padding: '48px',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '48px',
            color: '#007396',
            marginBottom: '24px'
          }}>
            {currentSectionConfig.icon}
          </div>

          <h3 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#333333',
            margin: '0 0 16px 0'
          }}>
            Loading {currentSectionConfig.name}
          </h3>

          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #E5E7EB',
            borderTop: '4px solid #007396',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px auto'
          }}></div>

          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: 0
          }}>
            Preparing {currentSectionConfig.questionCount} questions...
          </p>

          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        fontFamily: 'Arial, Helvetica, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          padding: '48px',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#FEE2E2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto'
          }}>
            <ExclamationCircleOutlined
              style={{ fontSize: '32px', color: '#DC2626' }}
              onPointerEnterCapture={undefined}
              onPointerLeaveCapture={undefined}
            />
          </div>

          <h3 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#333333',
            margin: '0 0 16px 0'
          }}>
            Error Loading Section
          </h3>

          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: '0 0 32px 0',
            lineHeight: '1.6'
          }}>
            {error}
          </p>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => {
                setError(null);
                loadCurrentSection();
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#333333'
              }}
            >
              Retry Loading
            </button>
            <button
              onClick={() => navigate('/config')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#007396',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                boxShadow: '0 2px 4px rgba(0,115,150,0.3)'
              }}
            >
              Return to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render main quiz interface
  const currentQuestion = questions[currentQuestionIndex];
  const currentSectionConfig = getCurrentSectionConfig();
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const overallProgress = ((gmatState.currentSection * 100) + (progress / 3)) / 3;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#FFFFFF',
      fontFamily: 'Arial, Helvetica, sans-serif'
    }}>
      {/* Official GMAT Header */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #D1D5DB',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Left: Section Name */}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#333333'
          }}>
            {currentSectionConfig.name}
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '13px',
            color: '#6B7280'
          }}>
            Section {gmatState.currentSection + 1} of 3
          </p>
        </div>

        {/* Right: Question Number & Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ fontSize: '15px', color: '#333333', fontWeight: 500 }}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: timeLeft < 300 ? '#DC2626' : '#333333'
            }}>
              <ClockCircleOutlined
                style={{ fontSize: '16px' }}
                onPointerEnterCapture={undefined}
                onPointerLeaveCapture={undefined}
              />
              <span style={{
                fontFamily: 'monospace',
                fontSize: '16px',
                fontWeight: 600
              }}>
                {formatTime(timeLeft)}
              </span>
            </div>

            <button
              onClick={() => setIsPaused(!isPaused)}
              disabled={isSubmitting}
              style={{
                padding: '6px 16px',
                backgroundColor: '#F3F4F6',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333333',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isPaused ? (
                <PlayCircleOutlined
                  onPointerEnterCapture={undefined}
                  onPointerLeaveCapture={undefined}
                />
              ) : (
                <PauseCircleOutlined
                  onPointerEnterCapture={undefined}
                  onPointerLeaveCapture={undefined}
                />
              )}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '40px 80px 120px 80px',
        maxWidth: '1000px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Question Content — delegated to QuestionCard so CR/RC passages,
            DS layout, and DI cards all render correctly. */}
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion as any}
            selectedOption={answers[currentQuestion._id]}
            onChange={(_qid, option) => handleAnswerSelect(option)}
            relatedQuestions={questions as any}
            answeredMap={answers}
            // No jump callback in the quiz: GMAT doesn't let users hop
            // between RC siblings or MSR sub-questions.
            hidePassagePills
          />
        )}
      </div>

      {/* Official GMAT Footer Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F3F4F6',
        borderTop: '1px solid #D1D5DB',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
        zIndex: 30
      }}>
        {/* Left: Help & Tools */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            style={{
              padding: '8px 20px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              color: '#333333'
            }}
          >
            Help
          </button>
          {currentSectionConfig.name === 'Quantitative Reasoning' && (
            <button
              style={{
                padding: '8px 20px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333333',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CalculatorOutlined
                onPointerEnterCapture={undefined}
                onPointerLeaveCapture={undefined}
              />
              Calculator
            </button>
          )}
        </div>

        {/* Center: Progress Info */}
        <div style={{
          fontSize: '14px',
          color: '#6B7280',
          fontWeight: 500
        }}>
          {countAnsweredSubItems(questions, answers)} of {questions.length} answered
        </div>

        {/* Right: Navigation Buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={prevQuestion}
            disabled={currentQuestionIndex === 0}
            style={{
              padding: '10px 24px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              color: currentQuestionIndex === 0 ? '#9CA3AF' : '#333333',
              opacity: currentQuestionIndex === 0 ? 0.5 : 1
            }}
          >
            Previous
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={handleSectionComplete}
              disabled={isSubmitting}
              style={{
                padding: '10px 32px',
                backgroundColor: '#007396',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                boxShadow: '0 2px 4px rgba(0,115,150,0.3)'
              }}
            >
              {isSubmitting ? 'Submitting...' : 'End Section'}
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              style={{
                padding: '10px 32px',
                backgroundColor: '#007396',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                boxShadow: '0 2px 4px rgba(0,115,150,0.3)'
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GMATFocusQuizPage;
