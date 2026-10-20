import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';
import { getAlerts, resolveAlert as apiResolve } from '../api/alerts';
import { loadReadAlertIds, persistReadAlertIds } from './alertReadState';

const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [notificationAlerts, setNotificationAlerts] = useState([]);
  const [notificationAlertsReady, setNotificationAlertsReady] = useState(false);
  const [readAlertState, setReadAlertState] = useState({ userId: null, ids: new Set() });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    server: '',
  });

  const userId = isAuthenticated ? user?.id : null;

  useEffect(() => {
    setNotificationAlerts([]);
    setNotificationAlertsReady(false);
  }, [isAuthenticated, userId]);

  useEffect(() => {
    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      // Read state remains session-only when browser storage is unavailable.
    }
    setReadAlertState({ userId, ids: loadReadAlertIds(storage, userId) });
  }, [userId]);

  const markAlertsRead = (alertIds) => {
    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      // Keep the state in memory for this session if storage is unavailable.
    }
    const currentIds = readAlertState.userId === userId
      ? readAlertState.ids
      : loadReadAlertIds(storage, userId);
    const ids = persistReadAlertIds(storage, userId, currentIds, alertIds);
    setReadAlertState({ userId, ids });
  };

  const readAlertIds = readAlertState.userId === userId ? readAlertState.ids : new Set();

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
      if (Object.keys(activeFilters).length === 0) {
        setNotificationAlerts(data);
        setNotificationAlertsReady(true);
      } else {
        try {
          setNotificationAlerts(await getAlerts());
          setNotificationAlertsReady(true);
        } catch (notificationError) {
          console.error('Error refreshing unfiltered alerts for desktop notifications', notificationError);
        }
      }
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
      setNotificationAlerts([]);
      setNotificationAlertsReady(false);
    }
  }, [isAuthenticated, userId, filters]); // Re-fetch on account and filter changes

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
    <AlertContext.Provider value={{ alerts, notificationAlerts, notificationAlertsReady, loading, error, filters, setFilters, fetchAlerts, triggerResolve, readAlertIds, markAlertsRead }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => useContext(AlertContext);
