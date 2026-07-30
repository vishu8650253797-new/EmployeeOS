import api from './api';

export const documentAnalyticsService = {
  // Get overview analytics
  getOverview: async () => {
    const response = await api.get('/document-analytics/overview');
    return response.data.data;
  },

  // Get expiry analytics
  getExpiryAnalytics: async () => {
    const response = await api.get('/document-analytics/expiry');
    return response.data.data;
  },

  // Get category analytics
  getCategoryAnalytics: async () => {
    const response = await api.get('/document-analytics/categories');
    return response.data.data || [];
  },

  // Get department analytics
  getDepartmentAnalytics: async () => {
    const response = await api.get('/document-analytics/departments');
    return response.data.data || [];
  },

  // Get compliance report
  getComplianceReport: async (params = {}) => {
    const response = await api.get('/document-analytics/compliance', { params });
    return response.data.data;
  },
};
