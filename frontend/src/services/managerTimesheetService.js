import api from './api';

export const managerTimesheetService = {
  async getTimesheets(params = {}) {
    const { data } = await api.get('/timesheets', { params });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/timesheets/${id}`);
    return data.data;
  },

  async getEntries(id) {
    const { data } = await api.get(`/timesheets/${id}/entries`);
    return data.data;
  },

  async approve(id) {
    const { data } = await api.post(`/timesheets/${id}/approve`);
    return data.data;
  },

  async reject(id, reason) {
    const { data } = await api.post(`/timesheets/${id}/reject`, { reason });
    return data.data;
  },
};
