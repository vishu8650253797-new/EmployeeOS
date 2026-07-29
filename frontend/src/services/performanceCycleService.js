import api from './api';

const performanceCycleService = {
  getCycles: (params) => api.get('/performance-cycles', { params }),
  getCycleById: (id) => api.get(`/performance-cycles/${id}`),
  getActiveCycle: () => api.get('/performance-cycles/active'),
  createCycle: (data) => api.post('/performance-cycles', data),
  updateCycle: (id, data) => api.put(`/performance-cycles/${id}`, data),
  deleteCycle: (id) => api.delete(`/performance-cycles/${id}`),
};

export { performanceCycleService };
