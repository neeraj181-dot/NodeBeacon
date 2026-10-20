import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as apiLogin, register as apiRegister, getProfile, exchangeGoogleCode } from '../api/auth';

// React Hook / API - createContext for global user session state
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // React Hook - useState (Tracks current user, authentication status, and initial verification loading)
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // React Hook - useEffect (Initializes authentication state on app startup by verifying JWT token)
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const profile = await getProfile();
          setUser(profile);
          setIsAuthenticated(true);
        } catch (err) {
          console.error("Token verification failed, logging out", err);
          logout();
        }
      }
      setLoading(false);
    };

    fetchUser();

    // Listen to global logout events from Axios interceptor
    const handleLogoutEvent = () => {
      logout();
    };

    window.addEventListener('auth_logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('auth_logout', handleLogoutEvent);
    };
  }, []);

  const login = async (username, password) => {
    setError(null);
    try {
      const data = await apiLogin(username, password);
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      
      const profile = await getProfile();
      setUser(profile);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Authentication failed. Please check your credentials.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const register = async (username, email, password, firstName = '', lastName = '', role = 'INDIVIDUAL', organizationName = '', alertEmail = '') => {
    setError(null);
    try {
      await apiRegister(username, email, password, firstName, lastName, role, organizationName, alertEmail);
      // Auto login after successful registration
      return await login(username, password);
    } catch (err) {
      let errMsg = 'Registration failed. Please check the inputs.';
      if (err.response?.data) {
        const firstErrField = Object.keys(err.response.data)[0];
        const firstErrVal = err.response.data[firstErrField];
        errMsg = Array.isArray(firstErrVal) ? firstErrVal[0] : firstErrVal;
        errMsg = `${firstErrField}: ${errMsg}`;
      }
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const loginWithGoogle = async (code, redirectUri, state) => {
    setError(null);
    try {
      const data = await exchangeGoogleCode(code, redirectUri, state);
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      if (data.user) {
        setUser(data.user);
      } else {
        const profile = await getProfile();
        setUser(profile);
      }
      setIsAuthenticated(true);
      return data;
    } catch (err) {
      const errMsg = err.response?.data?.detail
        || err.response?.data?.message
        || err.response?.data?.error
        || err.message
        || 'Google sign-in failed. Please try again.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const setTokensAndLogin = async (accessToken, refreshToken) => {
    setError(null);
    try {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      const profile = await getProfile();
      setUser(profile);
      setIsAuthenticated(true);
      return profile;
    } catch (err) {
      logout();
      const errMsg = err.response?.data?.detail || err.message || 'Failed to authenticate session.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updates) => {
    setUser(current => current ? { ...current, ...updates } : current);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      loading,
      error,
      login,
      loginWithGoogle,
      setTokensAndLogin,
      register,
      logout,
      setError,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// React Hook - useContext (Custom hook exposing authentication context to any component)
export const useAuth = () => useContext(AuthContext);
