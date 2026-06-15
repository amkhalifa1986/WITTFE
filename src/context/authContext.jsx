import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import signalrService from '../services/signalrService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      if (api.accessToken) {
        const res = await api.getCurrentUser();
        setUser(res.data);
        // Connect SignalR if authenticated
        signalrService.connect().catch(err => console.error('Failed to start SignalR', err));
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
      api.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    // Listen for auth expiration events from api helper
    const handleAuthExpired = () => {
      setUser(null);
      signalrService.disconnect();
    };

    window.addEventListener('auth_expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth_expired', handleAuthExpired);
    };
  }, []);

  const login = async (email, password, rememberMe) => {
    setLoading(true);
    try {
      const data = await api.login(email, password, rememberMe);
      const profileRes = await api.getCurrentUser();
      const fullUser = profileRes.data;
      setUser(fullUser);
      // Connect SignalR asynchronously without blocking login flow
      signalrService.connect().catch(err => console.error('Failed to start SignalR on login', err));
      return fullUser;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (displayName, email, password) => {
    setLoading(true);
    try {
      await api.register(displayName, email, password);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    api.clearTokens();
    setUser(null);
    signalrService.disconnect();
  };

  const updateUserProfile = async (displayName, bio, avatarUrl) => {
    try {
      const res = await api.updateProfile(displayName, bio, avatarUrl);
      setUser(prev => prev ? { ...prev, ...res.data } : null);
      return res.data;
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
