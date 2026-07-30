import api from './api';

const feedbackService = {
  getFeedback: async (params) => {
    const response = await api.get('/feedback', { params });
    return response.data.data || [];
  },
  getFeedbackById: async (id) => {
    const response = await api.get(`/feedback/${id}`);
    return response.data.data;
  },
  getEmployeeFeedback: async (employeeId, params) => {
    const response = await api.get(`/feedback/employee/${employeeId}`, { params });
    return response.data.data || [];
  },
  createFeedback: async (data) => {
    const response = await api.post('/feedback', data);
    return response.data.data;
  },
  updateFeedback: async (id, data) => {
    const response = await api.put(`/feedback/${id}`, data);
    return response.data.data;
  },
  deleteFeedback: async (id) => {
    const response = await api.delete(`/feedback/${id}`);
    return response.data;
  },
  getFeedbackRequests: async (params) => {
    const response = await api.get('/feedback/requests', { params });
    return response.data.data || [];
  },
  createFeedbackRequest: async (data) => {
    const response = await api.post('/feedback/requests', data);
    return response.data.data;
  },
  submitFeedbackRequest: async (id, data) => {
    const response = await api.put(`/feedback/requests/${id}/submit`, data);
    return response.data.data;
  },
  declineFeedbackRequest: async (id) => {
    const response = await api.put(`/feedback/requests/${id}/decline`);
    return response.data.data;
  },
};

export { feedbackService };
