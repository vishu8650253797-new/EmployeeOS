import api from './api';

const feedbackService = {
  getFeedback: (params) => api.get('/feedback', { params }),
  getFeedbackById: (id) => api.get(`/feedback/${id}`),
  getEmployeeFeedback: (employeeId, params) => api.get(`/feedback/employee/${employeeId}`, { params }),
  createFeedback: (data) => api.post('/feedback', data),
  updateFeedback: (id, data) => api.put(`/feedback/${id}`, data),
  deleteFeedback: (id) => api.delete(`/feedback/${id}`),
  getFeedbackRequests: (params) => api.get('/feedback/requests', { params }),
  createFeedbackRequest: (data) => api.post('/feedback/requests', data),
  submitFeedbackRequest: (id, data) => api.put(`/feedback/requests/${id}/submit`, data),
  declineFeedbackRequest: (id) => api.put(`/feedback/requests/${id}/decline`),
};

export { feedbackService };
