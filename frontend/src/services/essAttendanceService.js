import api from './api';

export const essAttendanceService = {
  async getMyHistory(params = {}) {
    const { data } = await api.get('/ess/attendance', { params });
    return data;
  },

  async getMySummary(params = {}) {
    const { data } = await api.get('/ess/attendance/summary', { params });
    return data.data;
  },

  async getRecordById(id) {
    const { data } = await api.get(`/ess/attendance/${id}`);
    return data.data;
  },
};
