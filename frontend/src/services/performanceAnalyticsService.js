import api from './api';

const performanceAnalyticsService = {
  getOverviewAnalytics: (cycleId) => api.get('/performance-analytics/overview', { params: { cycleId } }),
  getDepartmentAnalytics: (cycleId) => api.get('/performance-analytics/departments', { params: { cycleId } }),
  getPerformanceTrends: (employeeId) => api.get(`/performance-analytics/trends/${employeeId}`),
  getTopPerformers: (cycleId, limit) => api.get('/performance-analytics/top-performers', { params: { cycleId, limit } }),
  getAtRiskEmployees: (cycleId) => api.get('/performance-analytics/at-risk', { params: { cycleId } }),
  getEmployeePerformanceSummary: (employeeId, cycleId) => api.get(`/performance-analytics/employee/${employeeId}/summary`, { params: { cycleId } }),
};

export { performanceAnalyticsService };
