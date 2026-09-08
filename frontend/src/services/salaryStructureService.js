import api from './api';

export const salaryStructureService = {
  async getStructures(params = {}) {
    const { data } = await api.get('/payroll/structures', { params });
    return data.data || [];
  },

  async getStructureById(id) {
    const { data } = await api.get(`/payroll/structures/${id}`);
    return data.data;
  },

  async createStructure(payload) {
    const { data } = await api.post('/payroll/structures', payload);
    return data.data;
  },

  async updateStructure(id, payload) {
    const { data } = await api.put(`/payroll/structures/${id}`, payload);
    return data.data;
  },

  async deleteStructure(id) {
    const { data } = await api.delete(`/payroll/structures/${id}`);
    return data;
  },
};
