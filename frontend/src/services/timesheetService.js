import api from './api';

export const timesheetService = {
  async getTimesheets(params = {}) {
    const { data } = await api.get('/ess/timesheets', { params });
    return data;
  },

  async getCurrent() {
    const { data } = await api.get('/ess/timesheets/current');
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/ess/timesheets/${id}`);
    return data.data;
  },

  async getEntries(id) {
    const { data } = await api.get(`/ess/timesheets/${id}/entries`);
    return data.data;
  },

  async prepare(periodStart) {
    const { data } = await api.post('/ess/timesheets/prepare', periodStart ? { periodStart } : {});
    return data.data;
  },

  async submit(id) {
    const { data } = await api.post(`/ess/timesheets/${id}/submit`);
    return data.data;
  },
};
