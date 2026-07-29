import api from './api';

export const leaveTypeService = {
  getLeaveTypes: (params = {}) => api.get('/leave-types', { params }).then((r) => r.data),
  getLeaveTypeById: (id) => api.get(`/leave-types/${id}`).then((r) => r.data),
  createLeaveType: (payload) => api.post('/leave-types', payload).then((r) => r.data),
  updateLeaveType: (id, payload) => api.put(`/leave-types/${id}`, payload).then((r) => r.data),
  deleteLeaveType: (id) => api.delete(`/leave-types/${id}`).then((r) => r.data),
};
