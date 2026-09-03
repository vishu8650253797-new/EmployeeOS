import api from './api';

export const offboardingService = {
  async getOffboardings(params = {}) {
    const { data } = await api.get('/offboarding', { params });
    return data;
  },

  async getDashboard() {
    const { data } = await api.get('/offboarding/dashboard');
    return data.data;
  },

  async getOffboardingById(id) {
    const { data } = await api.get(`/offboarding/${id}`);
    return data.data;
  },

  async initiateOffboarding(payload) {
    const { data } = await api.post('/offboarding', payload);
    return data.data;
  },

  async updateOffboarding(id, payload) {
    const { data } = await api.patch(`/offboarding/${id}`, payload);
    return data.data;
  },

  async submitOffboarding(id) {
    const { data } = await api.post(`/offboarding/${id}/submit`);
    return data.data;
  },

  async approveOffboarding(id, payload) {
    const { data } = await api.post(`/offboarding/${id}/approve`, payload);
    return data.data;
  },

  async rejectOffboarding(id, payload) {
    const { data } = await api.post(`/offboarding/${id}/reject`, payload);
    return data.data;
  },

  async cancelOffboarding(id, reason) {
    const { data } = await api.post(`/offboarding/${id}/cancel`, { reason });
    return data.data;
  },

  async completeOffboarding(id) {
    const { data } = await api.post(`/offboarding/${id}/complete`);
    return data.data;
  },

  async getTimeline(id) {
    const { data } = await api.get(`/offboarding/${id}/timeline`);
    return data.data || [];
  },

  async updateClearance(id, clearanceId, payload) {
    const { data } = await api.patch(`/offboarding/${id}/clearances/${clearanceId}`, payload);
    return data.data;
  },

  async getOffboardingAssets(id) {
    const { data } = await api.get(`/offboarding/${id}/assets`);
    return data.data || [];
  },

  async refreshAssetClearance(id) {
    const { data } = await api.post(`/offboarding/${id}/assets/refresh-clearance`);
    return data.data;
  },

  async scheduleExitInterview(id, payload) {
    const { data } = await api.post(`/offboarding/${id}/exit-interview`, payload);
    return data.data;
  },

  async updateExitInterview(id, payload) {
    const { data } = await api.patch(`/offboarding/${id}/exit-interview`, payload);
    return data.data;
  },

  async updateKnowledgeTransfer(id, payload) {
    const { data } = await api.patch(`/offboarding/${id}/knowledge-transfer`, payload);
    return data.data;
  },

  async requestAccessDeactivation(id, payload) {
    const { data } = await api.post(`/offboarding/${id}/access/deactivate`, payload);
    return data.data;
  },

  async updateAccessDeactivation(id, payload) {
    const { data } = await api.patch(`/offboarding/${id}/access`, payload);
    return data.data;
  },

  async getSettlementPreparation(id) {
    const { data } = await api.get(`/offboarding/${id}/settlement-preparation`);
    return data.data;
  },

  async getDocuments(id) {
    const { data } = await api.get(`/offboarding/${id}/documents`);
    return data.data || [];
  },

  async requestDocument(id, payload) {
    const { data } = await api.post(`/offboarding/${id}/documents`, payload);
    return data.data;
  },
};
