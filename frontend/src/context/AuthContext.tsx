import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { login as loginService, register as registerService, logout as logoutService, getCurrentUser, isAuthenticated } from '../services/authService';
import { LoginCredentials, RegisterCredentials, User, UserStats } from '../types/auth';

interface AuthContextType {
  user: User | null;
  stats: UserStats | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  error: string | null;
}

// Create context with default values
export const AuthContext = createContext<AuthContextType>({
  user: null,
  stats: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  error: null,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user from storage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        
        if (isAuthenticated()) {
          try {
            const profileData = await getCurrentUser();
            // Set user and stats from the profile data
            setUser(profileData.user);
            setStats(profileData.stats);
          } catch (error) {
            console.error('Error fetching user profile:', error);
            // The shared axios interceptor already tried /auth/refresh-token
            // before this catch fires, so a thrown error here means the
            // session is genuinely dead. Fire-and-forget the server logout
            // so the refresh-token cookie is revoked too.
            void logoutService();
            setUser(null);
            setStats(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      const response = await loginService(credentials);
      setUser(response.user);
      // After login, fetch user profile to get stats
      try {
        const profileData = await getCurrentUser();
        setStats(profileData.stats);
      } catch (profileError) {
        console.error('Error fetching user profile after login:', profileError);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to login');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      setLoading(true);
      setError(null);
      const response = await registerService(credentials);
      setUser(response.user);
      // New users won't have stats yet, but set an empty object
      setStats({
        totalQuizzes: 0,
        averageScore: 0
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || 'Failed to register');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Fire-and-forget: revokes refresh token + clears cookie server-side.
    void logoutService();
    setUser(null);
    setStats(null);
    setLoading(false);
  };

  const value = {
    user,
    stats,
    loading,
    login,
    register,
    logout,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 