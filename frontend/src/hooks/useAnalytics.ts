import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Analytics } from '../services/mixpanelService';

/**
 * Custom hook for analytics tracking
 * Provides easy access to analytics functions and automatically tracks page views
 */
export const useAnalytics = () => {
  const location = useLocation();
  
  // Track page views automatically
  useEffect(() => {
    const pageName = location.pathname;
    Analytics.trackPageView(pageName, {
      url: window.location.href,
      referrer: document.referrer,
      path: location.pathname,
      search: location.search,
      title: document.title
    });
  }, [location.pathname, location.search]);
  
  return {
    // Basic tracking
    track: Analytics.track.bind(Analytics),
    identify: Analytics.identify.bind(Analytics),
    setUserProperties: Analytics.setUserProperties.bind(Analytics),
    reset: Analytics.reset.bind(Analytics),
    
    // Specific event tracking
    trackQuizStarted: Analytics.trackQuizStarted.bind(Analytics),
    trackQuizCompleted: Analytics.trackQuizCompleted.bind(Analytics),
    trackQuestionAnswered: Analytics.trackQuestionAnswered.bind(Analytics),
    trackRegistration: Analytics.trackRegistration.bind(Analytics),
    trackLogin: Analytics.trackLogin.bind(Analytics),
    trackLogout: Analytics.trackLogout.bind(Analytics),
    trackFeatureUsed: Analytics.trackFeatureUsed.bind(Analytics),
    
    // Custom event tracking helpers
    trackStudySessionStarted: (sessionId: string, sessionType: string) => {
      Analytics.track('Study Session Started', {
        session_id: sessionId,
        session_type: sessionType,
        timestamp: new Date().toISOString()
      });
    },
    
    trackStudySessionCompleted: (sessionId: string, durationMinutes: number) => {
      Analytics.track('Study Session Completed', {
        session_id: sessionId,
        duration_minutes: durationMinutes,
        timestamp: new Date().toISOString()
      });
    },
    
    trackError: (errorMessage: string, errorSource: string) => {
      Analytics.track('Error Occurred', {
        error_message: errorMessage,
        error_source: errorSource,
        timestamp: new Date().toISOString()
      });
    },
    
    trackSearch: (query: string, resultsCount: number, filters?: Record<string, any>) => {
      Analytics.track('Search Performed', {
        search_query: query,
        results_count: resultsCount,
        filters,
        timestamp: new Date().toISOString()
      });
    }
  };
}; 