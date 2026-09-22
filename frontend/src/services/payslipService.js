import api from './api';

export const payslipService = {
  async getMyPayslips(params = {}) {
    const { data } = await api.get('/payroll/payslips/me', { params });
    return data;
  },

  async getMyPayslipById(id) {
    const { data } = await api.get(`/payroll/payslips/me/${id}`);
    return data.data;
  },

  async getMyOverview() {
    const { data } = await api.get('/payroll/payslips/me/overview');
    return data.data;
  },

  async getPayslips(params = {}) {
    const { data } = await api.get('/payroll/payslips', { params });
    return data;
  },

  async getPayslipById(id) {
    const { data } = await api.get(`/payroll/payslips/${id}`);
    return data.data;
  },
};
