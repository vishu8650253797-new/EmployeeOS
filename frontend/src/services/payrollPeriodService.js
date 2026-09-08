import api from './api';

export const payrollPeriodService = {
  async getPeriods(params = {}) {
    const { data } = await api.get('/payroll/periods', { params });
    return data.data || [];
  },

  async getPeriodById(id) {
    const { data } = await api.get(`/payroll/periods/${id}`);
    return data.data;
  },

  async createPeriod(payload) {
    const { data } = await api.post('/payroll/periods', payload);
    return data.data;
  },

  async closePeriod(id) {
    const { data } = await api.put(`/payroll/periods/${id}/close`);
    return data.data;
  },

  async deletePeriod(id) {
    const { data } = await api.delete(`/payroll/periods/${id}`);
    return data;
  },
};
