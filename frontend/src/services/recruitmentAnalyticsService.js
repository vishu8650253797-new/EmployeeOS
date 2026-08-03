import api from './api';

export const recruitmentAnalyticsService = {
  getOverview: async () => {
    const response = await api.get('/recruitment/analytics/overview');
    return response.data.data;
  },

  getFunnel: async (params = {}) => {
    const response = await api.get('/recruitment/analytics/funnel', { params });
    return response.data.data;
  },

  getSources: async (params = {}) => {
    const response = await api.get('/recruitment/analytics/sources', { params });
    return response.data.data || [];
  },

  getJobs: async () => {
    const response = await api.get('/recruitment/analytics/jobs');
    return response.data.data || [];
  },

  getTimeToHire: async (params = {}) => {
    const response = await api.get('/recruitment/analytics/time-to-hire', { params });
    return response.data.data;
  },
};
