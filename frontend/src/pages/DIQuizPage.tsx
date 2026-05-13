import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ClockCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { Question } from '../types/quiz';
import { getRandomQuestionsV3, submitQuiz } from '../services/api';
import { analytics } from '../services/analytics';
import QuestionCard from '../components/QuestionCard';

interface DIQuizConfig {
  count: number;
  timeLimit: number;
  questionTypes: string[];
  isSectionalTest?: boolean;
  sectionName?: string;
  useV3?: boolean;
  onlyReadyForQuiz?: boolean;
}

const DIQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = location.state?.config as DIQuizConfig;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Redirect if no config
  useEffect(() => {
    if (!config) {
      navigate('/config');
    }
  }, [config, navigate]);

  // Load questions on mount
  const loadQuestions = useCallback(async () => {
    if (!config) return;

    setLoading(true);
    setError(null);

    try {
      const filters: any = {};
      if (config.questionTypes && config.questionTypes.length > 0) {
        filters.questionTypes = config.questionTypes;
      }
      if (config.onlyReadyForQuiz) {
        filters.onlyReadyForQuiz = true;
      }

      const quiz = await getRandomQuestionsV3(
        config.count || 20,
        config.timeLimit || 45,
        filters
      );

      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        throw new Error('No Data Insights questions available. Please ensure questions have been added to the database.');
      }

      setQuizId(quiz.quizId);
      setQuestions(quiz.questions);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setTimeLeft((config.timeLimit || 45) * 60);
      setTotalTimeSpent(0);
      setIsPaused(false);

      analytics.trackQuizStarted({
        quizId: quiz.quizId,
        count: quiz.questions.length,
        timeLimit: config.timeLimit || 45
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load Data Insights questions. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (config) {
      loadQuestions();
    }
  }, [config, loadQuestions]);

  // Submit quiz
  const handleSubmit = useCallback(async () => {
    if (!quizId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const submission = await submitQuiz(quizId, answers, totalTimeSpent, {
        mode: 'di-sectional',
        filtersUsed: config || {},
      });

      analytics.trackQuizCompleted({
        quizId,
        totalCorrect: 0,
        totalTime: totalTimeSpent,
        totalQuestions: questions.length,
        score: Object.keys(answers).length
      });

      navigate('/results', {
        state: {
          submission,
          sectionData: {
            sectionName: config?.sectionName || 'Data Insights - Advanced'
          }
        }
      });
    } catch (err) {
      setError('Failed to submit quiz. Please try again.');
      setIsSubmitting(false);
    }
  }, [quizId, answers, totalTimeSpent, questions.length, config, navigate, isSubmitting]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Timer
  useEffect(() => {
    if (loading || isPaused || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (handleSubmitRef.current) {
            handleSubmitRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
      setTotalTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isPaused, questions.length]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // Get question type label for badge
  const getQuestionTypeLabel = (type: string): string => {
    switch (type) {
      case 'DI-GT': return 'Graphs & Tables';
      case 'DI-MSR': return 'Multi-Source Reasoning';
      case 'DI-TPA': return 'Two-Part Analysis';
      case 'DI-DS': return 'Data Sufficiency';
      default: return type;
    }
  };

  const getQuestionTypeColor = (type: string): string => {
    switch (type) {
      case 'DI-GT': return '#0D9488';
      case 'DI-MSR': return '#7C3AED';
      case 'DI-TPA': return '#EA580C';
      case 'DI-DS': return '#2563EB';
      default: return '#6B7280';
    }
  };

  // Loading state
  if (loading) {
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
          <BarChartOutlined
            style={{ fontSize: '48px', color: '#722ed1', marginBottom: '24px' }}
            onPointerEnterCapture={undefined}
            onPointerLeaveCapture={undefined}
          />
          <h3 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#333333',
            margin: '0 0 16px 0'
          }}>
            Loading Data Insights
          </h3>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #E5E7EB',
            borderTop: '4px solid #722ed1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px auto'
          }}></div>
          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: 0
          }}>
            Preparing {config?.count || 20} questions...
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

  // Error state
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
            Error Loading Quiz
          </h3>
          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: '0 0 32px 0',
            lineHeight: '1.6'
          }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setError(null);
                loadQuestions();
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
              Retry
            </button>
            <button
              onClick={() => navigate('/config')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#722ed1',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                boxShadow: '0 2px 4px rgba(114,46,209,0.3)'
              }}
            >
              Return to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pause overlay
  if (isPaused) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        fontFamily: 'Arial, Helvetica, sans-serif',
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          padding: '48px',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          textAlign: 'center'
        }}>
          <PauseCircleOutlined
            style={{ fontSize: '48px', color: '#722ed1', marginBottom: '24px' }}
            onPointerEnterCapture={undefined}
            onPointerLeaveCapture={undefined}
          />
          <h2 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#333333',
            margin: '0 0 16px 0'
          }}>
            Quiz Paused
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: '0 0 32px 0'
          }}>
            Your timer has been paused. Resume when you're ready.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => setIsPaused(false)}
              style={{
                padding: '14px 32px',
                backgroundColor: '#722ed1',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(114,46,209,0.3)',
                width: '100%'
              }}
            >
              Resume Quiz
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: '14px 32px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #DC2626',
                borderRadius: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                color: '#DC2626',
                width: '100%'
              }}
            >
              {isSubmitting ? 'Submitting...' : 'End Quiz'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#FFFFFF',
      fontFamily: 'Arial, Helvetica, sans-serif'
    }}>
      {/* Header */}
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
        {/* Left: Section name + question type badge */}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#333333'
          }}>
            {config?.sectionName || 'Data Insights - Advanced'}
          </h1>
          {currentQuestion && (
            <span style={{
              display: 'inline-block',
              marginTop: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: getQuestionTypeColor(currentQuestion.questionType),
              borderRadius: '4px'
            }}>
              {getQuestionTypeLabel(currentQuestion.questionType)}
            </span>
          )}
        </div>

        {/* Right: Question counter + Timer + Pause */}
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
              onClick={() => setIsPaused(true)}
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
              <PauseCircleOutlined
                onPointerEnterCapture={undefined}
                onPointerLeaveCapture={undefined}
              />
              Pause
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px 40px 140px 40px',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto'
      }}>
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            selectedOption={answers[currentQuestion._id]}
            onChange={handleAnswerSelect}
          />
        )}
      </div>

      {/* Question status grid + Footer navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F3F4F6',
        borderTop: '1px solid #D1D5DB',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
        zIndex: 30
      }}>
        {/* Question status pills */}
        <div style={{
          padding: '8px 32px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
          flexWrap: 'wrap'
        }}>
          {questions.map((q, idx) => {
            const isAnswered = answers[q._id] !== undefined;
            const isCurrent = idx === currentQuestionIndex;

            return (
              <div
                key={q._id}
                onClick={() => setCurrentQuestionIndex(idx)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: isCurrent
                    ? '#722ed1'
                    : isAnswered
                    ? '#10B981'
                    : '#E5E7EB',
                  color: isCurrent || isAnswered ? '#FFFFFF' : '#6B7280',
                  border: isCurrent ? '2px solid #5B21B6' : '1px solid transparent'
                }}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>

        {/* Navigation buttons */}
        <div style={{
          padding: '12px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Left */}
          <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
            {Object.keys(answers).length} of {questions.length} answered
          </div>

          {/* Right: Navigation */}
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
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  padding: '10px 32px',
                  backgroundColor: '#722ed1',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  boxShadow: '0 2px 4px rgba(114,46,209,0.3)'
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                style={{
                  padding: '10px 32px',
                  backgroundColor: '#722ed1',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  boxShadow: '0 2px 4px rgba(114,46,209,0.3)'
                }}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DIQuizPage;
