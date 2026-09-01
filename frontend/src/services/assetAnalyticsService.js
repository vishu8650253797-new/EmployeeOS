import api from './api';

export const assetAnalyticsService = {
  async getOverview() {
    const { data } = await api.get('/assets/analytics/overview');
    return data.data;
  },

  async getStatusBreakdown() {
    const { data } = await api.get('/assets/analytics/status');
    return data.data || [];
  },

  async getCategoryBreakdown() {
    const { data } = await api.get('/assets/analytics/category');
    return data.data || [];
  },

  async getDepartmentBreakdown() {
    const { data } = await api.get('/assets/analytics/department');
    return data.data || [];
  },

  async getMaintenanceAnalytics() {
    const { data } = await api.get('/assets/analytics/maintenance');
    return data.data;
  },

  async getWarrantyAnalytics() {
    const { data } = await api.get('/assets/analytics/warranty');
    return data.data;
  },
};
