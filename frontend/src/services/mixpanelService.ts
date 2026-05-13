import mixpanel from 'mixpanel-browser';

// Replace with your actual Mixpanel token
const MIXPANEL_TOKEN = process.env.REACT_APP_MIXPANEL_TOKEN || 'YOUR_MIXPANEL_TOKEN';

// Initialize Mixpanel only if token is available
if (MIXPANEL_TOKEN && MIXPANEL_TOKEN !== 'YOUR_MIXPANEL_TOKEN') {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: true,
    persistence: 'localStorage'
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Mixpanel initialized in development mode');
  }
} else if (process.env.NODE_ENV === 'development') {
  console.warn('Mixpanel token not found. Analytics will not be tracked.');
}

/**
 * MixpanelService provides methods to track user events and manage user identity
 */
class MixpanelService {
  /**
   * Track an event
   * @param eventName - Name of the event
   * @param properties - Additional properties for the event
   */
  track(eventName: string, properties?: Record<string, any>): void {
    mixpanel.track(eventName, properties);
  }

  /**
   * Identify a user
   * @param userId - Unique identifier for the user
   */
  identify(userId: string): void {
    mixpanel.identify(userId);
  }

  /**
   * Set user properties
   * @param properties - User properties to set
   */
  setUserProperties(properties: Record<string, any>): void {
    mixpanel.people.set(properties);
  }

  /**
   * Track page view
   * @param pageName - Name of the page
   * @param properties - Additional properties
   */
  trackPageView(pageName: string, properties?: Record<string, any>): void {
    this.track('Page View', {
      page: pageName,
      ...properties
    });
  }

  /**
   * Reset user identity (e.g., on logout)
   */
  reset(): void {
    mixpanel.reset();
  }

  /**
   * Track quiz started event
   * @param quizId - ID of the quiz
   * @param quizType - Type of quiz (e.g., 'Verbal', 'Quant')
   * @param questionCount - Number of questions in the quiz
   */
  trackQuizStarted(quizId: string, quizType: string, questionCount: number): void {
    this.track('Quiz Started', {
      quiz_id: quizId,
      quiz_type: quizType,
      question_count: questionCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track quiz completed event
   * @param quizId - ID of the quiz
   * @param score - Score achieved
   * @param timeSpent - Time spent in seconds
   * @param correctAnswers - Number of correct answers
   */
  trackQuizCompleted(quizId: string, score: number, timeSpent: number, correctAnswers: number): void {
    this.track('Quiz Completed', {
      quiz_id: quizId,
      score,
      time_spent_seconds: timeSpent,
      correct_answers: correctAnswers,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track question answered event
   * @param questionId - ID of the question
   * @param quizId - ID of the quiz
   * @param isCorrect - Whether the answer was correct
   * @param questionType - Type of question
   * @param timeSpent - Time spent on the question in seconds
   */
  trackQuestionAnswered(
    questionId: string, 
    quizId: string, 
    isCorrect: boolean, 
    questionType: string,
    timeSpent: number
  ): void {
    this.track('Question Answered', {
      question_id: questionId,
      quiz_id: quizId,
      is_correct: isCorrect,
      question_type: questionType,
      time_spent_seconds: timeSpent,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track user registration
   * @param userId - User ID
   * @param method - Registration method (e.g., 'email', 'google')
   */
  trackRegistration(userId: string, method: string): void {
    this.track('User Registered', {
      user_id: userId,
      registration_method: method,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track user login
   * @param userId - User ID
   * @param method - Login method
   */
  trackLogin(userId: string, method: string): void {
    this.track('User Logged In', {
      user_id: userId,
      login_method: method,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track user logout
   */
  trackLogout(): void {
    this.track('User Logged Out', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track feature usage
   * @param featureName - Name of the feature
   * @param properties - Additional properties
   */
  trackFeatureUsed(featureName: string, properties?: Record<string, any>): void {
    this.track('Feature Used', {
      feature_name: featureName,
      timestamp: new Date().toISOString(),
      ...properties
    });
  }
}

// Export as a singleton
export const Analytics = new MixpanelService(); 