/**
 * Analytics configuration
 */
export const analyticsConfig = {
  // Replace with your actual Mixpanel token from your Mixpanel project settings
  mixpanelToken: process.env.REACT_APP_MIXPANEL_TOKEN || 'YOUR_MIXPANEL_TOKEN',
  
  // Enable/disable analytics in development mode
  enableInDevelopment: false,
  
  // Event names - centralizing these helps maintain consistency
  events: {
    PAGE_VIEW: 'Page View',
    QUIZ_STARTED: 'Quiz Started',
    QUIZ_COMPLETED: 'Quiz Completed',
    QUESTION_ANSWERED: 'Question Answered',
    USER_REGISTERED: 'User Registered',
    USER_LOGGED_IN: 'User Logged In',
    USER_LOGGED_OUT: 'User Logged Out',
    FEATURE_USED: 'Feature Used',
    STUDY_SESSION_STARTED: 'Study Session Started',
    STUDY_SESSION_COMPLETED: 'Study Session Completed',
    ERROR_OCCURRED: 'Error Occurred',
    SEARCH_PERFORMED: 'Search Performed',
    FILTER_APPLIED: 'Filter Applied',
    CONTENT_VIEWED: 'Content Viewed',
    SETTINGS_CHANGED: 'Settings Changed'
  }
}; 