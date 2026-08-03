import publicApi from './publicApi';

export const publicJobService = {
  getJobs: async (params = {}) => {
    const response = await publicApi.get('/public/jobs', { params });
    return response.data;
  },

  getJobBySlug: async (slug) => {
    const response = await publicApi.get(`/public/jobs/${slug}`);
    return response.data.data;
  },

  applyToJob: async (jobId, formData, onUploadProgress) => {
    const response = await publicApi.post(`/public/jobs/${jobId}/apply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
    return response.data;
  },

  getOffer: async (token) => {
    const response = await publicApi.get(`/public/offers/${token}`);
    return response.data.data;
  },

  acceptOffer: async (token) => {
    const response = await publicApi.put(`/public/offers/${token}/accept`);
    return response.data;
  },

  rejectOffer: async (token) => {
    const response = await publicApi.put(`/public/offers/${token}/reject`);
    return response.data;
  },
};
