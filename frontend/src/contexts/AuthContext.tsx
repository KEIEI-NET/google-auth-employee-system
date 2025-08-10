import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  email: string;
  name: string;
  profilePicture: string | null;
  roles: string[];
}

interface AuthContextType {
  user: Employee | null;
  isLoading: boolean;
  login: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Configure axios defaults for cookies
  useEffect(() => {
    axios.defaults.withCredentials = true; // Enable sending cookies with requests
  }, []);

  // Axios interceptor for token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await refreshToken();
            return axios(originalRequest);
          } catch (refreshError) {
            logout();
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (code: string, state: string) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/auth/google/callback`,
        { code, state },
        { withCredentials: true } // Ensure cookies are sent
      );

      const { employee } = response.data.data;
      
      // Set user (tokens are now in httpOnly cookies)
      setUser(employee);
      
      // Navigate to dashboard
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/auth/logout`,
        {},
        { withCredentials: true }
      );
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear user data
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const refreshToken = useCallback(async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/auth/refresh`,
        {},
        { withCredentials: true }
      );
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/auth/me`,
          { withCredentials: true }
        );
        setUser(response.data.data);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!user) return;

    // Refresh token every 10 minutes
    const interval = setInterval(() => {
      refreshToken().catch(() => {
        logout();
      });
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, refreshToken, logout]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};