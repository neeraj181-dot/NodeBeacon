import api from './api';

export const getAlerts = async (filters = {}) => {
  const response = await api.get('alerts/', { params: filters });
  return response.data;
};

export const getAlert = async (id) => {
  const response = await api.get(`alerts/${id}/`);
  return response.data;
};

export const resolveAlert = async (id) => {
  const response = await api.patch(`alerts/${id}/resolve/`);
  return response.data;
};
