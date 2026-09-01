import api from './api';

export const assetRequestService = {
  async getRequests(params = {}) {
    const { data } = await api.get('/assets/requests', { params });
    return data;
  },

  async getRequestById(id) {
    const { data } = await api.get(`/assets/requests/${id}`);
    return data.data;
  },

  async createRequest(payload) {
    const { data } = await api.post('/assets/requests', payload);
    return data.data;
  },

  async approveRequest(id) {
    const { data } = await api.put(`/assets/requests/${id}/approve`);
    return data.data;
  },

  async rejectRequest(id, rejectionReason) {
    const { data } = await api.put(`/assets/requests/${id}/reject`, { rejectionReason });
    return data.data;
  },

  async cancelRequest(id) {
    const { data } = await api.put(`/assets/requests/${id}/cancel`);
    return data.data;
  },

  async fulfillRequest(id, assetId) {
    const { data } = await api.put(`/assets/requests/${id}/fulfill`, { assetId });
    return data.data;
  },
};
