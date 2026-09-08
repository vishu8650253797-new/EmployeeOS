import api from './api';

export const payrollRunService = {
  async getRuns(params = {}) {
    const { data } = await api.get('/payroll/runs', { params });
    return data;
  },

  async getRunById(id) {
    const { data } = await api.get(`/payroll/runs/${id}`);
    return data.data;
  },

  async getRunRecords(id, params = {}) {
    const { data } = await api.get(`/payroll/runs/${id}/records`, { params });
    return data;
  },

  async createRun(payload) {
    const { data } = await api.post('/payroll/runs', payload);
    return data.data;
  },

  async processRun(id) {
    const { data } = await api.post(`/payroll/runs/${id}/process`);
    return data.data;
  },

  async recalculateRun(id) {
    const { data } = await api.post(`/payroll/runs/${id}/recalculate`);
    return data.data;
  },

  async updateRecord(runId, recordId, payload) {
    const { data } = await api.put(`/payroll/runs/${runId}/records/${recordId}`, payload);
    return data.data;
  },

  async submitRun(id) {
    const { data } = await api.post(`/payroll/runs/${id}/submit`);
    return data.data;
  },

  async approveRun(id) {
    const { data } = await api.post(`/payroll/runs/${id}/approve`);
    return data.data;
  },

  async rejectRun(id, reason) {
    const { data } = await api.post(`/payroll/runs/${id}/reject`, { reason });
    return data.data;
  },

  async finalizeRun(id) {
    const { data } = await api.post(`/payroll/runs/${id}/finalize`);
    return data.data;
  },

  async cancelRun(id, reason) {
    const { data } = await api.post(`/payroll/runs/${id}/cancel`, { reason });
    return data.data;
  },
};
