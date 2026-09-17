import api from './api';

export const essLeaveService = {
  async getLeaveTypes() {
    const { data } = await api.get('/ess/leave/types');
    return data.data || [];
  },

  async getBalance(year) {
    const { data } = await api.get('/ess/leave/balance', { params: year ? { year } : {} });
    return data.data || [];
  },

  async getRequests(params = {}) {
    const { data } = await api.get('/ess/leave/requests', { params });
    return data;
  },

  async getRequestById(id) {
    const { data } = await api.get(`/ess/leave/requests/${id}`);
    return data.data;
  },

  async createRequest(payload) {
    const { data } = await api.post('/ess/leave/requests', payload);
    return data.data;
  },

  async cancelRequest(id) {
    const { data } = await api.post(`/ess/leave/requests/${id}/cancel`);
    return data.data;
  },
};
