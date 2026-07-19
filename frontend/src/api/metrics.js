import api from './api';

export const getMetrics = async () => {
  const response = await api.get('metrics/');
  return response.data;
};

export const getServerMetrics = async (serverId, limit = 100) => {
  const response = await api.get(`servers/${serverId}/metrics/`, {
    params: { limit },
  });
  return response.data;
};

export const exportPDF = async () => {
  const response = await api.get('metrics/export-pdf/', {
    responseType: 'blob',
  });
  return response;
};
