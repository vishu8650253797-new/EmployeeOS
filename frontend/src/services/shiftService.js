import api from './api';

export const shiftService = {
  async getShifts(params = {}) {
    const { data } = await api.get('/shifts', { params });
    return data;
  },

  async getShiftById(id) {
    const { data } = await api.get(`/shifts/${id}`);
    return data.data;
  },

  async createShift(payload) {
    const { data } = await api.post('/shifts', payload);
    return data.data;
  },

  async updateShift(id, payload) {
    const { data } = await api.put(`/shifts/${id}`, payload);
    return data.data;
  },

  async setShiftStatus(id, status) {
    const { data } = await api.patch(`/shifts/${id}/status`, { status });
    return data.data;
  },

  async archiveShift(id) {
    const { data } = await api.delete(`/shifts/${id}`);
    return data;
  },
};
