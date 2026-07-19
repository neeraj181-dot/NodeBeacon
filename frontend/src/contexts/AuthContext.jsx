import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as apiLogin, register as apiRegister, getProfile } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state
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

  const register = async (username, email, password, firstName = '', lastName = '') => {
    setError(null);
    try {
      await apiRegister(username, email, password, firstName, lastName);
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

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, error, login, register, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
