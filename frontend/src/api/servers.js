import api from './api';

export const getServers = async () => {
  const response = await api.get('servers/');
  return response.data;
};

export const getServer = async (id) => {
  const response = await api.get(`servers/${id}/`);
  return response.data;
};

export const createServer = async (serverData) => {
  const response = await api.post('servers/', serverData);
  return response.data;
};

export const updateServer = async (id, serverData) => {
  const response = await api.put(`servers/${id}/`, serverData);
  return response.data;
};

export const deleteServer = async (id) => {
  const response = await api.delete(`servers/${id}/`);
  return response.data;
};
