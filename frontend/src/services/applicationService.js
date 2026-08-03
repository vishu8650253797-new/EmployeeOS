import api from './api';

export const applicationService = {
  getApplications: async (params = {}) => {
    const response = await api.get('/recruitment/applications', { params });
    return response.data;
  },

  getApplication: async (id) => {
    const response = await api.get(`/recruitment/applications/${id}`);
    return response.data.data;
  },

  updateStatus: async (id, status, extra = {}) => {
    const response = await api.put(`/recruitment/applications/${id}/status`, { status, ...extra });
    return response.data.data;
  },

  rejectApplication: async (id, rejectionReason) => {
    const response = await api.put(`/recruitment/applications/${id}/reject`, { rejectionReason });
    return response.data.data;
  },

  withdrawApplication: async (id, withdrawalReason) => {
    const response = await api.put(`/recruitment/applications/${id}/withdraw`, { withdrawalReason });
    return response.data.data;
  },
};
