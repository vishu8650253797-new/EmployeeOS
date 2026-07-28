import api from './api';

export const departmentService = {
  async getDepartments(params = {}) {
    const { data } = await api.get('/departments', { params });
    return data.data;
  },

  async getDepartmentById(id) {
    const { data } = await api.get(`/departments/${id}`);
    return data.data;
  },

  async createDepartment(payload) {
    const { data } = await api.post('/departments', payload);
    return data.data;
  },

  async updateDepartment(id, payload) {
    const { data } = await api.put(`/departments/${id}`, payload);
    return data.data;
  },

  async deleteDepartment(id) {
    const { data } = await api.delete(`/departments/${id}`);
    return data;
  },
};
