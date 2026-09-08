import api from './api';

export const payrollAnalyticsService = {
  async getOverview() {
    const { data } = await api.get('/payroll/analytics/overview');
    return data.data;
  },

  async getTrends(periods = 12) {
    const { data } = await api.get('/payroll/analytics/trends', { params: { periods } });
    return data.data || [];
  },

  async getDepartmentCost(payrollPeriodId) {
    const { data } = await api.get('/payroll/analytics/department-cost', { params: { payrollPeriodId } });
    return data.data || [];
  },
};
