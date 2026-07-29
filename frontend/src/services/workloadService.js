import api from './api';

export const workloadService = {
  getWorkload: (params = {}) => api.get('/workload', { params }),
  getMyWorkload: () => api.get('/workload/my'),
};
