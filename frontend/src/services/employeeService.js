import api from './api';

export const employeeService = {
  async getEmployees(params = {}) {
    const { data } = await api.get('/employees', { params });
    return data;
  },

  async getEmployeeById(id) {
    const { data } = await api.get(`/employees/${id}`);
    return data.data;
  },

  async createEmployee(payload) {
    const { data } = await api.post('/employees', payload);
    return data.data;
  },

  async updateEmployee(id, payload) {
    const { data } = await api.put(`/employees/${id}`, payload);
    return data.data;
  },

  async deleteEmployee(id) {
    const { data } = await api.delete(`/employees/${id}`);
    return data;
  },
};
