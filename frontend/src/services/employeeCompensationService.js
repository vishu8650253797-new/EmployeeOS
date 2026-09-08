import api from './api';

export const employeeCompensationService = {
  async getCompensationHistory(employeeId, params = {}) {
    const { data } = await api.get('/payroll/compensation', { params: { ...params, employeeId } });
    return data;
  },

  async getCompensationById(id) {
    const { data } = await api.get(`/payroll/compensation/${id}`);
    return data.data;
  },

  async getCurrentCompensation(employeeId) {
    const { data } = await api.get(`/payroll/compensation/employee/${employeeId}/current`);
    return data.data;
  },

  async assignCompensation(payload) {
    const { data } = await api.post('/payroll/compensation', payload);
    return data.data;
  },

  async updateCompensation(id, payload) {
    const { data } = await api.put(`/payroll/compensation/${id}`, payload);
    return data.data;
  },

  async cancelCompensation(id) {
    const { data } = await api.delete(`/payroll/compensation/${id}`);
    return data;
  },
};
