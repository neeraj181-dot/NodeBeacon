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

export const exportPDF = async (params = {}) => {
  const response = await api.get('metrics/export-pdf/', {
    params,
    responseType: 'blob',
  });
  return response;
};

export const getReportData = async (params = {}) => {
  const response = await api.get('metrics/report-data/', { params });
  return response.data;
};

