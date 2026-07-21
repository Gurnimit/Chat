import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

import { User } from '../types';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (loginIdentifier: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, displayName?: string) => Promise<{ emailVerificationRequired: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string, bio: string, avatarUrl: string, username?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const getBackendURL = (): string => {
  const custom = localStorage.getItem('velvet_backend_url');
  if (custom) return custom;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const hasCapacitor = typeof (window as any).Capacitor !== 'undefined';
  const isCapacitorNative = hasCapacitor && typeof (window as any).Capacitor.isNativePlatform === 'function' && (window as any).Capacitor.isNativePlatform();

  if (isCapacitorNative) {
    return 'https://velvet-chat-backend.onrender.com';
  }

  // In browser: use the Vite dev proxy (same origin) or production origin
  return window.location.origin;
};

export const getApiBaseURL = (): string => {
  const url = getBackendURL();
  return url.endsWith('/') ? `${url}api` : `${url}/api`;
};

export const api = axios.create({
  baseURL: getApiBaseURL(),
  withCredentials: true, // Send cookies in browser environment
});

// Queue structures to synchronize parallel token refreshes
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize: attempt to restore user profile using cookie-based refresh token
  useEffect(() => {
    const initializeAuth = async () => {
      const hasSession = localStorage.getItem('hasSession') === 'true';
      if (!hasSession) {
        setIsLoading(false);
        return;
      }

      try {
        // Attempt token refresh to get initial access token (sending HttpOnly cookie)
        const response = await api.post('/auth/refresh', {}, { withCredentials: true });
        const { accessToken: newAccessToken } = response.data;
        
        setAccessToken(newAccessToken);
        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('hasSession', 'true');

        // Fetch user profile
        const userResponse = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${newAccessToken}` },
        });

        setUser(userResponse.data.user);
      } catch (error) {
        console.error('Session restoration failed:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('hasSession');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Synchronize authentication state across multiple tabs
  useEffect(() => {
    const handleStorageSync = async (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        const newToken = e.newValue;
        if (newToken) {
          setAccessToken(newToken);
          // Fetch user profile to sync state
          try {
            const userResponse = await api.get('/auth/me', {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            setUser(userResponse.data.user);
          } catch (err) {
            console.error('Failed to sync user state from storage event:', err);
          }
        } else {
          setAccessToken(null);
          setUser(null);
        }
      } else if (e.key === 'hasSession' && e.newValue !== 'true') {
        setAccessToken(null);
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageSync);
    return () => {
      window.removeEventListener('storage', handleStorageSync);
    };
  }, []);

  // Configure Axios Request interceptor to append authorization token
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        config.baseURL = getApiBaseURL();
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
    };
  }, [accessToken]);

  // Configure Axios Response interceptor to handle auto token refresh on expiration
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        const isAuthEndpoint = originalRequest.url && (
          originalRequest.url.includes('/auth/login') ||
          originalRequest.url.includes('/auth/register') ||
          originalRequest.url.includes('/auth/refresh') ||
          originalRequest.url.includes('/auth/logout') ||
          originalRequest.url.includes('/auth/verify-email') ||
          originalRequest.url.includes('/auth/forgot-password') ||
          originalRequest.url.includes('/auth/reset-password')
        );

        // If error is 403 (expired access token) and we haven't retried yet and not an auth endpoint
        if (error.response?.status === 403 && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          const reqToken = originalRequest.headers.Authorization?.split(' ')[1] || accessToken;
          
          if (isRefreshing) {
            return new Promise<string>((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          // Check if the token in localStorage is already different from the one we used
          const currentAccessToken = localStorage.getItem('accessToken');
          
          // If the token changed, it means another tab already refreshed it!
          if (currentAccessToken && currentAccessToken !== reqToken) {
            setAccessToken(currentAccessToken);
            originalRequest.headers.Authorization = `Bearer ${currentAccessToken}`;
            return api(originalRequest);
          }

          isRefreshing = true;

          try {
            // Attempt to rotate refresh token
            const refreshResponse = await api.post('/auth/refresh', {}, { withCredentials: true });
            const { accessToken: newAccessToken } = refreshResponse.data;

            setAccessToken(newAccessToken);
            localStorage.setItem('accessToken', newAccessToken);
            localStorage.setItem('hasSession', 'true');

            isRefreshing = false;
            processQueue(null, newAccessToken);

            // Update authorization header on the original request and retry
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            isRefreshing = false;

            // Check if another tab refreshed it while we were making the request!
            const latestAccessToken = localStorage.getItem('accessToken');
            if (latestAccessToken && latestAccessToken !== reqToken) {
              setAccessToken(latestAccessToken);
              processQueue(null, latestAccessToken);
              originalRequest.headers.Authorization = `Bearer ${latestAccessToken}`;
              return api(originalRequest);
            }

            processQueue(refreshError, null);

            console.error('Automatic token refresh failed, logging out...');
            // Clear auth state
            setUser(null);
            setAccessToken(null);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('hasSession');
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [accessToken]);


  const logToConsoleAndUI = (msg: string, isError = false) => {
    if (isError) {
      console.error(msg);
    } else {
      console.log(msg);
    }
    if (typeof (window as any).velvetLog === 'function') {
      (window as any).velvetLog(msg);
    }
  };

  const login = async (loginIdentifier: string, password: string) => {
    logToConsoleAndUI(`[VELVET AuthContext] login called. identifier: "${loginIdentifier}", password length: ${password?.length}. BaseURL: ${api.defaults.baseURL}`);
    try {
      logToConsoleAndUI(`[VELVET AuthContext] Sending POST to /auth/login, url: ${getApiBaseURL()}/auth/login`);
      logToConsoleAndUI(`[VELVET AuthContext] Request Body: ${JSON.stringify({ loginIdentifier })}`);
      const response = await api.post('/auth/login', {
        loginIdentifier,
        password,
      }, { withCredentials: true });

      logToConsoleAndUI(`[VELVET AuthContext] Received response from /auth/login. Status: ${response.status}`);
      logToConsoleAndUI(`[VELVET AuthContext] Response Body: ${JSON.stringify(response.data)}`);
      const { accessToken: newAccessToken, user: loggedUser } = response.data;
      
      setAccessToken(newAccessToken);
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('hasSession', 'true');
      setUser(loggedUser);
      logToConsoleAndUI('[VELVET AuthContext] Login state applied successfully.');
    } catch (error: any) {
      logToConsoleAndUI(`[VELVET AuthContext] Login request failed: ${error.message || error.toString()}`, true);
      if (error.response) {
        logToConsoleAndUI(`[VELVET AuthContext] Error response - status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`, true);
      }
      const errorMsg = error.response?.data?.error || error.message || 'Login failed';
      throw new Error(errorMsg);
    }
  };

  const register = async (email: string, username: string, password: string, displayName?: string) => {
    logToConsoleAndUI(`[VELVET AuthContext] register called. email: "${email}", username: "${username}", password length: ${password?.length}. BaseURL: ${api.defaults.baseURL}`);
    try {
      logToConsoleAndUI(`[VELVET AuthContext] Sending POST to /auth/register, url: ${getApiBaseURL()}/auth/register`);
      logToConsoleAndUI(`[VELVET AuthContext] Request Body: ${JSON.stringify({ email, username, displayName })}`);
      const response = await api.post('/auth/register', {
        email,
        username,
        password,
        displayName,
      }, { withCredentials: true });

      logToConsoleAndUI(`[VELVET AuthContext] Received response from /auth/register. Status: ${response.status}`);
      logToConsoleAndUI(`[VELVET AuthContext] Response Body: ${JSON.stringify(response.data)}`);
      const { accessToken: newAccessToken, user: registeredUser, emailVerificationRequired } = response.data;

      if (emailVerificationRequired) {
        logToConsoleAndUI('[VELVET AuthContext] Registration successful, email verification required.');
        return { emailVerificationRequired: true, message: response.data.message };
      }

      setAccessToken(newAccessToken);
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('hasSession', 'true');
      setUser(registeredUser);
      logToConsoleAndUI('[VELVET AuthContext] Registration state applied successfully.');
      return { emailVerificationRequired: false };
    } catch (error: any) {
      logToConsoleAndUI(`[VELVET AuthContext] Registration request failed: ${error.message || error.toString()}`, true);
      if (error.response) {
        logToConsoleAndUI(`[VELVET AuthContext] Error response - status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`, true);
      }
      const errorMsg = error.response?.data?.error || error.message || 'Registration failed';
      throw new Error(errorMsg);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('hasSession');
    }
  };

  const updateProfile = async (displayName: string, bio: string, avatarUrl: string, username?: string) => {
    try {
      const response = await api.put('/auth/profile', {
        displayName,
        bio,
        avatarUrl,
        username,
      });

      const updatedUser = response.data.user;
      if (updatedUser) {
        setUser(updatedUser);
      } else {
        const updatedProfile = response.data.profile;
        setUser(prev => prev ? { ...prev, profile: updatedProfile } : null);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Profile update failed';
      throw new Error(errorMsg);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
