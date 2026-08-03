import api from './api';

export const recruitmentJobService = {
  getJobs: async (params = {}) => {
    const response = await api.get('/recruitment/jobs', { params });
    return response.data;
  },

  getJob: async (id) => {
    const response = await api.get(`/recruitment/jobs/${id}`);
    return response.data.data;
  },

  createJob: async (data) => {
    const response = await api.post('/recruitment/jobs', data);
    return response.data.data;
  },

  updateJob: async (id, data) => {
    const response = await api.put(`/recruitment/jobs/${id}`, data);
    return response.data.data;
  },

  deleteJob: async (id) => {
    const response = await api.delete(`/recruitment/jobs/${id}`);
    return response.data;
  },

  publishJob: async (id) => {
    const response = await api.put(`/recruitment/jobs/${id}/publish`);
    return response.data.data;
  },

  pauseJob: async (id) => {
    const response = await api.put(`/recruitment/jobs/${id}/pause`);
    return response.data.data;
  },

  closeJob: async (id) => {
    const response = await api.put(`/recruitment/jobs/${id}/close`);
    return response.data.data;
  },

  reopenJob: async (id) => {
    const response = await api.put(`/recruitment/jobs/${id}/reopen`);
    return response.data.data;
  },
};
