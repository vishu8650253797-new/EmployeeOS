import api from './api';

export const interviewService = {
  getInterviews: async (params = {}) => {
    const response = await api.get('/recruitment/interviews', { params });
    return response.data;
  },

  getInterview: async (id) => {
    const response = await api.get(`/recruitment/interviews/${id}`);
    return response.data.data;
  },

  createInterview: async (data) => {
    const response = await api.post('/recruitment/interviews', data);
    return response.data.data;
  },

  updateInterview: async (id, data) => {
    const response = await api.put(`/recruitment/interviews/${id}`, data);
    return response.data.data;
  },

  rescheduleInterview: async (id, data) => {
    const response = await api.put(`/recruitment/interviews/${id}/reschedule`, data);
    return response.data.data;
  },

  cancelInterview: async (id) => {
    const response = await api.put(`/recruitment/interviews/${id}/cancel`);
    return response.data.data;
  },

  completeInterview: async (id) => {
    const response = await api.put(`/recruitment/interviews/${id}/complete`);
    return response.data.data;
  },

  deleteInterview: async (id) => {
    const response = await api.delete(`/recruitment/interviews/${id}`);
    return response.data;
  },

  getFeedback: async (interviewId) => {
    const response = await api.get(`/recruitment/interviews/${interviewId}/feedback`);
    return response.data.data || [];
  },

  submitFeedback: async (interviewId, data) => {
    const response = await api.post(`/recruitment/interviews/${interviewId}/feedback`, data);
    return response.data.data;
  },

  updateFeedback: async (feedbackId, data) => {
    const response = await api.put(`/recruitment/feedback/${feedbackId}`, data);
    return response.data.data;
  },
};
