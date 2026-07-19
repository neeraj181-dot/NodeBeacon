import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';
import { getServers, createServer as apiCreate, updateServer as apiUpdate, deleteServer as apiDelete } from '../api/servers';

const ServerContext = createContext(null);

export const ServerProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchServers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getServers();
      setServers(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching servers", err);
      setError("Failed to fetch servers. Please check your network connection.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Poll servers every 10 seconds if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchServers();

      const intervalId = setInterval(() => {
        fetchServers(true); // Silent update without triggering loaders
      }, 10000);

      
      return () => clearInterval(intervalId);
    } else {
      setServers([]);
    }
  }, [isAuthenticated]);

  const addServer = async (serverData) => {
    try {
      const newServer = await apiCreate(serverData);
      setServers((prev) => [newServer, ...prev]);
      return newServer;
    } catch (err) {
      const errMsg = err.response?.data ? Object.values(err.response.data).flat()[0] : 'Failed to register server.';
      throw new Error(errMsg);
    }
  };

  const editServer = async (id, serverData) => {
    try {
      const updated = await apiUpdate(id, serverData);
      setServers((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (err) {
      const errMsg = err.response?.data ? Object.values(err.response.data).flat()[0] : 'Failed to update server.';
      throw new Error(errMsg);
    }
  };

  const removeServer = async (id) => {
    try {
      await apiDelete(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err) {
      throw new Error('Failed to delete server.');
    }
  };

  return (
    <ServerContext.Provider value={{ servers, loading, error, fetchServers, addServer, editServer, removeServer }}>
      {children}
    </ServerContext.Provider>
  );
};

export const useServers = () => useContext(ServerContext);
