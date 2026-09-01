import api from './api';

export const assetVendorService = {
  async getVendors(params = {}) {
    const { data } = await api.get('/assets/vendors', { params });
    return data;
  },

  async getVendorById(id) {
    const { data } = await api.get(`/assets/vendors/${id}`);
    return data.data;
  },

  async createVendor(payload) {
    const { data } = await api.post('/assets/vendors', payload);
    return data.data;
  },

  async updateVendor(id, payload) {
    const { data } = await api.put(`/assets/vendors/${id}`, payload);
    return data.data;
  },

  async deleteVendor(id) {
    const { data } = await api.delete(`/assets/vendors/${id}`);
    return data;
  },
};
