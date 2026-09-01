import api from './api';

export const assetService = {
  async getAssets(params = {}) {
    const { data } = await api.get('/assets', { params });
    return data;
  },

  async getAssetById(id) {
    const { data } = await api.get(`/assets/${id}`);
    return data.data;
  },

  async createAsset(payload) {
    const { data } = await api.post('/assets', payload);
    return data.data;
  },

  async updateAsset(id, payload) {
    const { data } = await api.put(`/assets/${id}`, payload);
    return data.data;
  },

  async deleteAsset(id) {
    const { data } = await api.delete(`/assets/${id}`);
    return data;
  },

  async assignAsset(id, payload) {
    const { data } = await api.post(`/assets/${id}/assign`, payload);
    return data.data;
  },

  async reassignAsset(id, payload) {
    const { data } = await api.post(`/assets/${id}/reassign`, payload);
    return data.data;
  },

  async returnAsset(id, payload) {
    const { data } = await api.post(`/assets/${id}/return`, payload);
    return data.data;
  },

  async markDamaged(id, notes) {
    const { data } = await api.patch(`/assets/${id}/damage`, { notes });
    return data.data;
  },

  async markLost(id, notes) {
    const { data } = await api.patch(`/assets/${id}/lost`, { notes });
    return data.data;
  },

  async recoverAsset(id, notes) {
    const { data } = await api.patch(`/assets/${id}/recover`, { notes });
    return data.data;
  },

  async retireAsset(id, notes) {
    const { data } = await api.patch(`/assets/${id}/retire`, { notes });
    return data.data;
  },

  async disposeAsset(id, notes) {
    const { data } = await api.patch(`/assets/${id}/dispose`, { notes });
    return data.data;
  },

  async uploadAttachment(id, formData) {
    const { data } = await api.post(`/assets/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  async downloadAttachment(id, attachmentId) {
    const response = await api.get(`/assets/${id}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return response;
  },

  async deleteAttachment(id, attachmentId) {
    const { data } = await api.delete(`/assets/${id}/attachments/${attachmentId}`);
    return data;
  },

  async getAssetMaintenance(id) {
    const { data } = await api.get(`/assets/${id}/maintenance`);
    return data.data || [];
  },

  async reportMaintenanceIssue(id, payload) {
    const { data } = await api.post(`/assets/${id}/maintenance`, payload);
    return data.data;
  },

  async getEmployeeAssets(employeeId) {
    const { data } = await api.get(`/employees/${employeeId}/assets`);
    return data.data || [];
  },
};
