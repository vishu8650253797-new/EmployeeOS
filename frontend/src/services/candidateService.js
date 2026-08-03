import api from './api';

export const candidateService = {
  getCandidates: async (params = {}) => {
    const response = await api.get('/recruitment/candidates', { params });
    return response.data;
  },

  getCandidate: async (id) => {
    const response = await api.get(`/recruitment/candidates/${id}`);
    return response.data.data;
  },

  updateCandidate: async (id, data) => {
    const response = await api.put(`/recruitment/candidates/${id}`, data);
    return response.data.data;
  },

  updateTags: async (id, tags) => {
    const response = await api.put(`/recruitment/candidates/${id}/tags`, { tags });
    return response.data.data;
  },

  assignRecruiter: async (id, recruiterId) => {
    const response = await api.put(`/recruitment/candidates/${id}/assign`, { recruiterId });
    return response.data.data;
  },

  downloadResume: async (id) => {
    const response = await api.get(`/recruitment/candidates/${id}/resume`, { responseType: 'blob' });
    return response.data;
  },

  getNotes: async (id) => {
    const response = await api.get(`/recruitment/candidates/${id}/notes`);
    return response.data.data || [];
  },

  createNote: async (id, data) => {
    const response = await api.post(`/recruitment/candidates/${id}/notes`, data);
    return response.data.data;
  },

  updateNote: async (noteId, data) => {
    const response = await api.put(`/recruitment/notes/${noteId}`, data);
    return response.data.data;
  },

  deleteNote: async (noteId) => {
    const response = await api.delete(`/recruitment/notes/${noteId}`);
    return response.data;
  },

  getActivities: async (id) => {
    const response = await api.get(`/recruitment/candidates/${id}/activities`);
    return response.data.data || [];
  },

  getCandidateFeedback: async (id) => {
    const response = await api.get(`/recruitment/candidates/${id}/feedback`);
    return response.data.data || [];
  },

  convertToEmployee: async (id, data) => {
    const response = await api.post(`/recruitment/candidates/${id}/convert-to-employee`, data);
    return response.data.data;
  },
};
