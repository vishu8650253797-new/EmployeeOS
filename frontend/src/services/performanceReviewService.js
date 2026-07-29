import api from './api';

const performanceReviewService = {
  getReviews: (params) => api.get('/performance-reviews', { params }),
  getReviewById: (id) => api.get(`/performance-reviews/${id}`),
  getMyReviews: (params) => api.get('/performance-reviews/my', { params }),
  getEmployeeReviews: (employeeId, params) => api.get(`/performance-reviews/employee/${employeeId}`, { params }),
  getCycleReviews: (cycleId) => api.get(`/performance-reviews/cycle/${cycleId}`),
  createReview: (data) => api.post('/performance-reviews', data),
  updateReview: (id, data) => api.put(`/performance-reviews/${id}`, data),
  deleteReview: (id) => api.delete(`/performance-reviews/${id}`),
  submitReview: (id) => api.put(`/performance-reviews/${id}/submit`),
  approveReview: (id) => api.put(`/performance-reviews/${id}/approve`),
  completeReview: (id, data) => api.put(`/performance-reviews/${id}/complete`, data),
  reopenReview: (id) => api.put(`/performance-reviews/${id}/reopen`),
};

export { performanceReviewService };
