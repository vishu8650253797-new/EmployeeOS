import api from './api';

export const assetMaintenanceService = {
  async getMaintenanceList(params = {}) {
    const { data } = await api.get('/assets/maintenance', { params });
    return data;
  },

  async getMaintenanceById(id) {
    const { data } = await api.get(`/assets/maintenance/${id}`);
    return data.data;
  },

  async updateMaintenance(id, payload) {
    const { data } = await api.put(`/assets/maintenance/${id}`, payload);
    return data.data;
  },
};
