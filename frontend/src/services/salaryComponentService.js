import api from './api';

export const salaryComponentService = {
  async getComponents(params = {}) {
    const { data } = await api.get('/payroll/components', { params });
    return data.data || [];
  },

  async getComponentById(id) {
    const { data } = await api.get(`/payroll/components/${id}`);
    return data.data;
  },

  async createComponent(payload) {
    const { data } = await api.post('/payroll/components', payload);
    return data.data;
  },

  async updateComponent(id, payload) {
    const { data } = await api.put(`/payroll/components/${id}`, payload);
    return data.data;
  },

  async deleteComponent(id) {
    const { data } = await api.delete(`/payroll/components/${id}`);
    return data;
  },
};
