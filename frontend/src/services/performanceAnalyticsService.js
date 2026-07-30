import api from './api';

const performanceAnalyticsService = {
  getOverviewAnalytics: async (cycleId) => {
    const response = await api.get('/performance-analytics/overview', { params: { cycleId } });
    return response.data.data;
  },
  getDepartmentAnalytics: async (cycleId) => {
    const response = await api.get('/performance-analytics/departments', { params: { cycleId } });
    return response.data.data || [];
  },
  getPerformanceTrends: async (employeeId) => {
    const response = await api.get(`/performance-analytics/trends/${employeeId}`);
    return response.data.data || [];
  },
  getTopPerformers: async (cycleId, limit) => {
    const response = await api.get('/performance-analytics/top-performers', { params: { cycleId, limit } });
    return response.data.data || [];
  },
  getAtRiskEmployees: async (cycleId) => {
    const response = await api.get('/performance-analytics/at-risk', { params: { cycleId } });
    return response.data.data || [];
  },
  getEmployeePerformanceSummary: async (employeeId, cycleId) => {
    const response = await api.get(`/performance-analytics/employee/${employeeId}/summary`, { params: { cycleId } });
    return response.data.data;
  },
};

export { performanceAnalyticsService };
