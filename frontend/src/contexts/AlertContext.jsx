import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';
import { getAlerts, resolveAlert as apiResolve } from '../api/alerts';

const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    server: '',
  });

  const fetchAlerts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Build query params based on active filter states
      const activeFilters = {};
      if (filters.status) activeFilters.status = filters.status;
      if (filters.severity) activeFilters.severity = filters.severity;
      if (filters.server) activeFilters.server = filters.server;

      const data = await getAlerts(activeFilters);
      setAlerts(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching alerts", err);
      setError("Failed to fetch alerts.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Poll alerts every 10 seconds if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts();

      const intervalId = setInterval(() => {
        fetchAlerts(true); // Silent update
      }, 10000);

      return () => clearInterval(intervalId);
    } else {
      setAlerts([]);
    }
  }, [isAuthenticated, filters]); // Re-fetch on filter changes

  const triggerResolve = async (id) => {
    try {
      await apiResolve(id);
      // Mark local state as resolved
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: 'Resolved', resolved_at: new Date().toISOString() }
            : a
        )
      );
      return true;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to resolve alert.';
      throw new Error(errMsg);
    }
  };

  return (
    <AlertContext.Provider value={{ alerts, loading, error, filters, setFilters, fetchAlerts, triggerResolve }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => useContext(AlertContext);
