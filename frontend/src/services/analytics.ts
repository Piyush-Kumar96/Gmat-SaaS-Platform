import mixpanel from 'mixpanel-browser';

// Mixpanel project token
const MIXPANEL_TOKEN = '50f7707453bcac586b0a0ed8898fe2fa';

// Initialize Mixpanel
mixpanel.init(MIXPANEL_TOKEN, {
  debug: process.env.NODE_ENV === 'development',
  track_pageview: false, // We'll handle page views manually
  persistence: 'localStorage',
  property_blacklist: [], // Add any properties you want to exclude
  ignore_dnt: false, // Respect Do Not Track
});

// Event property interfaces for type safety
export interface UserSignedUpProps {
  userId: string;
  email: string;
  registrationMethod?: string;
  timestamp?: string;
}

export interface UserLoggedInProps {
  userId: string;
  loginMethod?: string;
  timestamp?: string;
}

export interface QuizStartedProps {
  quizId: string;
  count: number;
  timeLimit: number;
  category?: string;
  difficulty?: string;
  timestamp?: string;
}

export interface QuestionAnsweredProps {
  questionId: string;
  correct: boolean;
  timeTaken: number; // in seconds
  questionType?: string;
  category?: string;
  difficulty?: number;
  timestamp?: string;
}

export interface QuestionFlaggedProps {
  questionId: string;
  quizId?: string;
  questionType?: string;
  timestamp?: string;
}

export interface QuizCompletedProps {
  quizId: string;
  totalCorrect: number;
  totalTime: number; // in seconds
  totalQuestions?: number;
  score?: number;
  category?: string;
  timestamp?: string;
}

export interface PageViewProps {
  page_name: string;
  userId?: string;
  timestamp?: string;
  [key: string]: any; // Allow additional user properties
}

/**
 * Analytics service for tracking user events with Mixpanel
 * Provides typed wrappers around mixpanel.track() for consistent event tracking
 */
class AnalyticsService {
  private isInitialized = true;

  /**
   * Track when a user signs up
   * Maps to: User registration flow completion
   * View in Mixpanel: Events > user_signed_up
   */
  trackUserSignedUp(props: UserSignedUpProps): void {
    this.track('user_signed_up', {
      ...props,
      timestamp: props.timestamp || new Date().toISOString(),
    });
    
    // Set user identity and properties
    this.identify(props.userId);
    this.setUserProperties({
      email: props.email,
      $email: props.email, // Mixpanel special property
      signup_date: new Date().toISOString(),
    });
  }

  /**
   * Track when a user logs in
   * Maps to: Successful authentication
   * View in Mixpanel: Events > user_logged_in
   */
  trackUserLoggedIn(props: UserLoggedInProps): void {
    this.track('user_logged_in', {
      ...props,
      timestamp: props.timestamp || new Date().toISOString(),
    });
    
    // Set user identity
    this.identify(props.userId);
    this.setUserProperties({
      last_login: new Date().toISOString(),
    });
  }

  /**
   * Track when a quiz is started
   * Maps to: User clicks "Start Quiz" button
   * View in Mixpanel: Events > quiz_started
   */
  trackQuizStarted(props: QuizStartedProps): void {
    this.track('quiz_started', {
      ...props,
      timestamp: props.timestamp || new Date().toISOString(),
    });
  }

  /**
   * Track when a question is answered
   * Maps to: User selects an answer and moves to next question
   * View in Mixpanel: Events > question_answered
   */
  trackQuestionAnswered(props: QuestionAnsweredProps): void {
    this.track('question_answered', {
      ...props,
      timestamp: props.timestamp || new Date().toISOString(),
    });
  }

  /**
   * Track when a question is flagged for review
   * Maps to: User clicks "Flag for Review" button
   * View in Mixpanel: Events > question_flagged
   */
  trackQuestionFlagged(props: QuestionFlaggedProps): void {
    this.track('question_flagged', {
      ...props,
      timestamp: props.timestamp || new Date().toISOString(),
    });
  }

  /**
   * Track when a quiz is completed
   * Maps to: User submits final quiz or time runs out
   * View in Mixpanel: Events > quiz_completed
   */
  trackQuizCompleted(props: QuizCompletedProps): void {
    this.track('quiz_completed', {
      ...props,
      timestamp: props.timestamp || new Date().toISOString(),
      accuracy: props.totalQuestions ? (props.totalCorrect / props.totalQuestions) * 100 : undefined,
    });
  }

  /**
   * Track page views
   * Maps to: User navigates to different pages in the app
   * View in Mixpanel: Events > page_view
   */
  trackPageView(props: PageViewProps): void {
    this.track('page_view', {
      ...props,
      timestamp: props.timestamp || new Date().toISOString(),
    });
  }

  /**
   * Generic track method (private)
   */
  private track(eventName: string, properties?: Record<string, any>): void {
    if (!this.isInitialized) {
      console.warn('Analytics not initialized');
      return;
    }

    try {
      mixpanel.track(eventName, properties);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Analytics Event: ${eventName}`, properties);
      }
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  /**
   * Identify a user
   */
  identify(userId: string): void {
    if (!this.isInitialized) return;
    
    try {
      mixpanel.identify(userId);
    } catch (error) {
      console.error('Analytics identify error:', error);
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, any>): void {
    if (!this.isInitialized) return;
    
    try {
      mixpanel.people.set(properties);
    } catch (error) {
      console.error('Analytics set user properties error:', error);
    }
  }

  /**
   * Reset user identity (call on logout)
   */
  reset(): void {
    if (!this.isInitialized) return;
    
    try {
      mixpanel.reset();
    } catch (error) {
      console.error('Analytics reset error:', error);
    }
  }

  /**
   * Track user logout
   */
  trackUserLoggedOut(): void {
    this.track('user_logged_out', {
      timestamp: new Date().toISOString(),
    });
    this.reset();
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Export for backward compatibility
export default analytics; 