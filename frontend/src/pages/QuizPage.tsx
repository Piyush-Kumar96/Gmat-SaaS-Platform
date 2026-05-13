import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getQuiz, submitQuiz, getRandomQuestionsV2, getRandomQuestionsV3, getVerbalQuiz, getRcQuiz } from '../services/api';
import { QuizItem, QuizConfig, QuizSubmission } from '../types';
import { Button, Card, Progress, Space, Modal, Alert, Badge, Typography } from 'antd';
import { 
  ArrowRightOutlined, 
  FlagOutlined, 
  CheckOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { analytics } from '../services/analytics';
import QuestionCard from '../components/QuestionCard';
import { flattenMsrSubQuestions, countAnsweredSubItems } from '../utils/flattenQuiz';

const { Text, Title } = Typography;

// Icon components with required TypeScript props
const ClockIcon = () => (
  <span className="mr-2">
    <ClockCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

const ArrowRightIcon = () => (
  <span className="ml-2">
    <ArrowRightOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

const FlagIcon = () => (
  <span className="mr-2">
    <FlagOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

const CheckIcon = () => (
  <span className="ml-2">
    <CheckOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

const WarningIcon = () => (
  <span className="text-yellow-500 text-xl mr-3 mt-1">
    <ExclamationCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

const TimerWarningIcon = () => (
  <span className="text-red-500 text-xl mr-3 mt-1">
    <ClockCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

export const QuizPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [questions, setQuestions] = useState<QuizItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [visitedQuestions, setVisitedQuestions] = useState<number[]>([0]); // Track visited questions
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<number, number>>({});
  const [currentQuestionTimer, setCurrentQuestionTimer] = useState(0);

  // Check if accessed directly (no config in location state)
  useEffect(() => {
    if (!location.state?.config) {
      // Redirect to config page if accessed directly
      navigate('/config');
      return;
    }
  }, [location.state, navigate]);

  // Get config from location state or use default
  const config: QuizConfig = location.state?.config || {
    count: 20,
    timeLimit: 30,
    questionTypeMode: 'all',
    difficultyMode: 'all',
    categoryMode: 'all'
  };

  // Load quiz questions
  useEffect(() => {
    const loadQuiz = async () => {
      // Track page view
      analytics.trackPageView({
        page_name: 'quiz',
        path: '/quiz'
      });

      try {
        setLoading(true);
        
        // Create the filters object based on the configuration
        const filters: any = {};
        
        // Handle category selection (single or multiple)
        if (config.categoryMode === 'specific') {
          if (config.selectedCategories && config.selectedCategories.length > 0) {
            filters.categories = config.selectedCategories;
          } else if (config.category) {
            filters.category = config.category;
          }
        }
        
        // Handle question type selection (single or multiple)
        if (config.questionTypeMode === 'specific') {
          if (config.selectedQuestionTypes && config.selectedQuestionTypes.length > 0) {
            filters.questionTypes = config.selectedQuestionTypes;
          } else if (config.questionType) {
            filters.questionType = config.questionType;
          }
        }
        
        // Opt-in "Ready for Quiz" — only restrict if the user explicitly
        // checked it on the config page; default is to consider all questions.
        if (config.onlyReadyForQuiz) {
          filters.onlyReadyForQuiz = true;
        }

        // Handle difficulty selection (single or multiple)
        if (config.difficultyMode === 'specific') {
          if (config.selectedDifficulties && config.selectedDifficulties.length > 0) {
            // Convert string difficulties to numbers if needed
            filters.difficulties = config.selectedDifficulties.map(diff => {
              if (diff === 'easy') return 1;
              if (diff === 'medium') return 2;
              if (diff === 'hard') return 3;
              return parseInt(diff, 10);
            });
          } else if (config.difficulty) {
            // Convert string difficulty to number if needed
            if (typeof config.difficulty === 'string') {
              if (config.difficulty === 'easy') filters.difficulty = 1;
              else if (config.difficulty === 'medium') filters.difficulty = 2;
              else if (config.difficulty === 'hard') filters.difficulty = 3;
              else filters.difficulty = parseInt(config.difficulty, 10);
            } else {
              filters.difficulty = config.difficulty;
            }
          }
        }

        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (loading) {
            setLoading(false);
            setError('Request timed out. Please try again or check your connection.');
          }
        }, 30000); // 30 second timeout
        
        // RC routing has migrated to V3 (RC-only quiz). Verbal sectional
        // (RC + CR) splits to V3-RC + V2-CR via getVerbalQuiz. Everything
        // else continues through V2.
        const requested: string[] = filters.questionTypes || (filters.questionType ? [filters.questionType] : []);
        const isRCOnly = requested.length > 0 && requested.every((t) => t === 'Reading Comprehension' || t === 'RC');
        const isVerbalMix =
          requested.includes('Reading Comprehension') && requested.includes('Critical Reasoning');

        let data: any;
        if (isRCOnly) {
          data = await getRcQuiz(config.count, config.timeLimit);
        } else if (isVerbalMix) {
          data = await getVerbalQuiz(config.count, config.timeLimit);
        } else {
          data = await getRandomQuestionsV2(config.count, config.timeLimit, filters);
        }
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        
        // Flatten MSR stems so each sub-question advances via the main pager.
        setQuestions(flattenMsrSubQuestions(data.questions) as any);
        setTimeLeft(data.timeLimit * 60);
        setQuizId(data.quizId);
        
        // Track quiz started
        analytics.trackQuizStarted({
          quizId: data.quizId,
          count: config.count,
          timeLimit: config.timeLimit,
          category: config.category,
          difficulty: config.difficulty?.toString()
        });
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load quiz questions. Please try again later.');
        setLoading(false);
      }
    };

    loadQuiz();
  }, [config]);

  // Per-question timer effect
  useEffect(() => {
    if (!isPaused && questions.length > 0) {
      const timer = setInterval(() => {
        setCurrentQuestionTimer(prev => prev + 1);
        setQuestionTimeSpent(prev => ({
          ...prev,
          [currentQuestionIndex]: (prev[currentQuestionIndex] || 0) + 1
        }));
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [currentQuestionIndex, isPaused, questions.length]);

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && !isPaused) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          // Show warning when 5 minutes left
          if (prev === 300) {
            setShowTimeWarning(true);
          }
          // Increment total time spent
          setTotalTimeSpent(current => current + 1);
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else if (timeLeft === 0 && questions.length > 0) {
      handleSubmit();
    }
  }, [timeLeft, questions.length, isPaused]);

  // Reset question timer when moving to a new question
  useEffect(() => {
    setCurrentQuestionTimer(questionTimeSpent[currentQuestionIndex] || 0);
  }, [currentQuestionIndex, questionTimeSpent]);

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle answer selection
  const handleAnswerSelect = (answer: string) => {
    if (currentQuestionIndex < questions.length) {
      const questionId = questions[currentQuestionIndex]._id;
      const currentQuestion = questions[currentQuestionIndex];
      
      setAnswers(prev => ({
        ...prev,
        [questionId]: answer
      }));
      
      // Track question answered
      analytics.trackQuestionAnswered({
        questionId: questionId,
        correct: false, // We don't know if it's correct yet
        timeTaken: questionTimeSpent[currentQuestionIndex] || 0,
        questionType: currentQuestion.type,
        // category: currentQuestion.category, // Property not available
        // difficulty: currentQuestion.difficulty // Property not available
      });
    }
  };

  // Toggle flag on current question
  const toggleFlag = () => {
    if (currentQuestionIndex < questions.length) {
      const questionId = questions[currentQuestionIndex]._id;
      const currentQuestion = questions[currentQuestionIndex];
      
      if (flaggedQuestions.includes(questionId)) {
        setFlaggedQuestions(prev => prev.filter(id => id !== questionId));
      } else if (flaggedQuestions.length < 3) {
        setFlaggedQuestions(prev => [...prev, questionId]);
        
        // Track question flagged
        analytics.trackQuestionFlagged({
          questionId: questionId,
          quizId: quizId || undefined,
          questionType: currentQuestion.type
        });
      }
    }
  };

  // Navigate to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      // Add to visited questions if not already visited
      if (!visitedQuestions.includes(nextIndex)) {
        setVisitedQuestions(prev => [...prev, nextIndex]);
      }
    }
  };

  // Toggle pause state
  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  // Calculate progress percentage. MSR sub-questions are flattened into the
  // pager, so a single answers-map entry can stand in for multiple steps —
  // countAnsweredSubItems unpacks the JSON-encoded MSR map per sub-Q.
  const calculateProgress = (): number => {
    const answeredCount = countAnsweredSubItems(questions as any, answers);
    return Math.round((answeredCount / questions.length) * 100);
  };

  // Check if all questions (including each MSR sub-question) are answered.
  const allQuestionsAnswered = (): boolean => {
    return countAnsweredSubItems(questions as any, answers) === questions.length;
  };

  // Handle quiz submission
  const handleSubmit = async () => {
    if (!quizId) {
      setError('Quiz ID is missing. Please restart the quiz.');
      return;
    }

    // Don't allow multiple submission attempts
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Handle GMAT Focus section completion
      if (config.isGmatFocus && config.sectionOrder && config.currentSection !== undefined) {
        const currentSectionIndex = config.currentSection;
        const nextSectionIndex = currentSectionIndex + 1;
        
        // If there are more sections to complete
        if (nextSectionIndex < (config.totalSections || 3)) {
          const nextSectionName = config.sectionOrder[nextSectionIndex];
          
          // Store current section results (simplified for now)
          const sectionResults = {
            sectionIndex: currentSectionIndex,
            sectionName: config.sectionName,
            answers: answers,
            timeSpent: totalTimeSpent,
            questionCount: questions.length
          };
          
          // Check if break should be offered
          if (config.breakAfterSection === nextSectionIndex) {
            // Navigate to break screen (for now, just show alert)
            const takeBreak = window.confirm(
              `Section ${currentSectionIndex + 1} completed! Would you like to take a 10-minute break before starting ${nextSectionName}?`
            );
            
            if (takeBreak) {
              alert('Break feature coming soon! For now, continuing to next section.');
            }
          }
          
          // Navigate to next section
          let nextSectionConfig;
          
          if (nextSectionName === 'Quantitative Reasoning') {
            nextSectionConfig = {
              count: 21,
              timeLimit: 45,
              questionTypeMode: 'specific',
              selectedQuestionTypes: ['Problem Solving'],
              difficultyMode: 'mixed',
              categoryMode: 'specific',
              selectedCategories: ['Quantitative Reasoning'],
              isGmatFocus: true,
              sectionOrder: config.sectionOrder,
              breakAfterSection: config.breakAfterSection,
              currentSection: nextSectionIndex,
              totalSections: config.totalSections,
              isMockTest: true,
              sectionName: 'GMAT Focus: Quantitative Reasoning'
            };
          } else if (nextSectionName === 'Verbal Reasoning') {
            nextSectionConfig = {
              count: 23,
              timeLimit: 45,
              questionTypeMode: 'specific',
              selectedQuestionTypes: ['Reading Comprehension', 'Critical Reasoning'],
              difficultyMode: 'mixed',
              categoryMode: 'specific',
              selectedCategories: ['Verbal Reasoning'],
              isGmatFocus: true,
              sectionOrder: config.sectionOrder,
              breakAfterSection: config.breakAfterSection,
              currentSection: nextSectionIndex,
              totalSections: config.totalSections,
              isMockTest: true,
              sectionName: 'GMAT Focus: Verbal Reasoning'
            };
          } else { // Data Insights
            nextSectionConfig = {
              count: 20,
              timeLimit: 45,
              questionTypeMode: 'specific',
              selectedQuestionTypes: ['Data Sufficiency'],
              difficultyMode: 'mixed',
              categoryMode: 'mixed',
              isGmatFocus: true,
              sectionOrder: config.sectionOrder,
              breakAfterSection: config.breakAfterSection,
              currentSection: nextSectionIndex,
              totalSections: config.totalSections,
              isMockTest: true,
              sectionName: 'GMAT Focus: Data Insights'
            };
          }
          
          // Navigate to next section
          setIsSubmitting(false);
          navigate('/quiz', { 
            state: { 
              config: nextSectionConfig,
              previousSectionResults: sectionResults
            }
          });
          return;
        }
      }

      // Regular quiz submission or final GMAT Focus section
      const submission = await submitQuiz(quizId, answers, totalTimeSpent, {
        mode: 'custom',
      });

      if (!submission || !submission.results) {
        throw new Error('Invalid response from server');
      }
      
      // Track quiz completed
      analytics.trackQuizCompleted({
        quizId: quizId,
        totalCorrect: 0, // We don't know the score yet
        totalTime: totalTimeSpent,
        totalQuestions: questions.length,
        score: Object.keys(answers).length
      });
      
      setIsSubmitting(false);
      navigate('/results', { 
        state: { 
          submission,
          isGmatFocus: config.isGmatFocus,
          sectionData: config.isGmatFocus ? {
            currentSection: config.currentSection,
            totalSections: config.totalSections,
            sectionOrder: config.sectionOrder
          } : undefined
        }
      });
    } catch (err) {
      setIsSubmitting(false);
      setError(
        err instanceof Error 
          ? `Failed to submit quiz: ${err.message}` 
          : 'Failed to submit quiz. Please try again later.'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading Quiz...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert type="error" message="Error" description={error} showIcon />
        <div className="mt-4 text-center">
          <Button type="primary" onClick={() => navigate('/')}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert 
          type="warning" 
          message="No Questions Available" 
          description="There are no questions available for this quiz. Please try again with different settings or contact the administrator." 
          showIcon 
        />
        <div className="mt-4 text-center">
          <Button type="primary" onClick={() => navigate('/config')}>
            Back to Quiz Configuration
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isCurrentQuestionFlagged = currentQuestion && flaggedQuestions.includes(currentQuestion._id);
  const currentAnswer = currentQuestion ? answers[currentQuestion._id] : undefined;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header with timer and pause button - now sticky */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6 sticky top-0 z-40">
        {/* GMAT Focus Section Header */}
        {config.isGmatFocus && (
          <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-purple-800">GMAT Focus Edition Mock Test</h2>
                <p className="text-sm text-purple-600">
                  {config.sectionName} • Section {(config.currentSection || 0) + 1} of {config.totalSections || 3}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-purple-600">Section Order:</div>
                <div className="text-xs font-medium text-purple-700">
                  {config.sectionOrder?.join(' → ') || 'Quant → Verbal → Data Insights'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{config.isGmatFocus ? config.sectionName : 'GMAT Quiz'}</h1>
          <div className="flex items-center gap-4">
            {/* Per-question timer */}
            <div className="flex items-center bg-gray-100 px-4 py-2 rounded-lg">
              <span className="mr-2">This question:</span>
              <span className="text-lg font-medium">
                {formatTime(currentQuestionTimer)}
              </span>
            </div>
            
            {/* Total timer */}
            <div className="flex items-center bg-gray-100 px-4 py-2 rounded-lg">
              <ClockIcon />
              <span className={`text-lg font-medium ${timeLeft < 300 ? 'text-red-500 animate-pulse' : ''}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            
            {/* Pause button */}
            <Button
              type="primary"
              onClick={togglePause}
              className="flex items-center"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          </div>
        </div>

        {/* Question navigation */}
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-100">
          <div className="text-gray-500 text-sm">
            <span>No going back to previous questions</span>
          </div>
          
          <div className="text-center font-medium">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          
          <Button 
            onClick={nextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
            className="flex items-center bg-gray-700 hover:bg-gray-600 text-white border-0 shadow-md rounded-lg px-6"
          >
            <span className="inline-flex items-center">
              Next Question <ArrowRightIcon />
            </span>
          </Button>
        </div>
      </div>

      {/* Spacer to prevent content from being hidden under sticky header */}
      <div className="h-4"></div>

      {/* Pause overlay */}
      {isPaused && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
            <h2 className="text-2xl font-bold mb-4">Quiz Paused</h2>
            <p className="mb-6">Your time has been paused. You can resume the quiz or end it now.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="large" 
                onClick={togglePause}
                className="bg-gray-700 hover:bg-gray-600 border-0 text-white shadow-md rounded-lg font-medium min-w-32"
              >
                Resume Quiz
              </Button>
              <Button 
                danger
                size="large" 
                onClick={handleSubmit}
                className="border-red-500 text-red-500 hover:bg-red-50 min-w-32"
              >
                End Quiz
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Current question card */}
      {currentQuestion && !isPaused && (
        <Card 
          className="shadow-md hover:shadow-lg transition-shadow border border-gray-200 rounded-lg overflow-hidden mb-8"
          bodyStyle={{ padding: 0 }}
        >
          {/* Question Header with metadata */}
          <div className="bg-gray-50 border-b border-gray-200 p-4">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.type && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      {currentQuestion.type}
                    </span>
                  )}
                </div>
              </div>
              <Button 
                type={isCurrentQuestionFlagged ? "primary" : "default"}
                onClick={toggleFlag}
                disabled={!isCurrentQuestionFlagged && flaggedQuestions.length >= 3}
                danger={isCurrentQuestionFlagged}
                className="ml-2"
              >
                <span className="inline-flex items-center">
                  <FlagIcon />
                  {isCurrentQuestionFlagged ? "Unflag" : "Flag for Review"}
                </span>
              </Button>
            </div>
          </div>
          
          {/* Question Content */}
          <div className="p-5">
            <QuestionCard
              question={currentQuestion as any}
              selectedOption={currentAnswer}
              onChange={(questionId, option) => handleAnswerSelect(option)}
              relatedQuestions={questions as any}
              answeredMap={answers}
              hidePassagePills
            />
          </div>

          {/* Footer with navigation */}
          <div className="flex justify-end items-center pt-4 mt-4 border-t border-gray-100 p-4 bg-gray-50">
            {!isLastQuestion ? (
              <Button 
                onClick={nextQuestion}
                disabled={!currentAnswer}
                size="large"
                className="flex items-center bg-gray-700 hover:bg-gray-600 text-white border-0 shadow-md rounded-lg px-6"
              >
                <span className="inline-flex items-center">
                  Next Question <ArrowRightIcon />
                </span>
              </Button>
            ) : (
              <Button 
                type="primary"
                onClick={handleSubmit}
                size="large"
                className="flex items-center bg-gray-700 hover:bg-gray-600 text-white border-0 shadow-md rounded-lg px-6"
              >
                <span className="inline-flex items-center">
                  Submit Quiz <CheckIcon />
                </span>
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Progress indicators */}
      {!isPaused && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="mb-2 font-medium">Question Status</div>
          <div className="grid grid-cols-10 gap-2 mb-4">
            {questions.map((question, index) => {
              const isAnswered = answers[question._id] !== undefined;
              const isFlagged = flaggedQuestions.includes(question._id);
              const isVisited = visitedQuestions.includes(index);
              const isCurrent = currentQuestionIndex === index;
              
              return (
                <div
                  key={index}
                  className={`h-8 rounded flex items-center justify-center text-xs font-bold ${
                    isCurrent 
                      ? 'bg-blue-500 text-white' 
                      : isAnswered 
                        ? 'bg-green-500 text-white' 
                        : isVisited 
                          ? 'bg-yellow-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                  } ${isFlagged ? 'ring-2 ring-red-500' : ''}`}
                >
                  {index + 1}
                </div>
              );
            })}
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
              <span>Answered</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
              <span>Visited</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-200 rounded mr-2"></div>
              <span>Not Visited</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-300 rounded mr-2 ring-2 ring-red-500"></div>
              <span>Flagged</span>
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      {!isPaused && (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="mb-4 text-gray-600">
            Ready to submit? You have answered {countAnsweredSubItems(questions as any, answers)} out of {questions.length} questions.
          </p>
          <Button
            size="large"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            className="px-8 bg-gray-700 hover:bg-gray-600 text-white border-0 shadow-md rounded-lg min-w-40"
          >
            <span className="inline-flex items-center">
              Submit Quiz <CheckIcon />
            </span>
          </Button>
        </div>
      )}

      {/* Time warning modal */}
      <Modal
        title={
          <div className="flex items-center text-red-600">
            <ClockCircleOutlined 
              className="mr-2"
              onPointerEnterCapture={() => {}}
              onPointerLeaveCapture={() => {}}
            />
            <span>Time Warning</span>
          </div>
        }
        open={showTimeWarning}
        onOk={() => setShowTimeWarning(false)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="Continue"
        centered
        maskClosable={false}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
      >
        <div className="py-4">
          <div className="flex items-start">
            <TimerWarningIcon />
            <div>
              <p className="font-medium">You have 5 minutes remaining!</p>
              <p className="text-gray-600 mt-2">
                Please finish answering the remaining questions and submit your quiz.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};