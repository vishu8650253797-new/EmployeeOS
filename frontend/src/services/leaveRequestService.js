import api from './api';

export const leaveRequestService = {
  getLeaveRequests: (params = {}) => api.get('/leave-requests', { params }).then((r) => r.data),
  getMyLeaveRequests: (params = {}) => api.get('/leave-requests/my', { params }).then((r) => r.data),
  getEmployeeLeaveRequests: (employeeId, params = {}) =>
    api.get(`/leave-requests/employee/${employeeId}`, { params }).then((r) => r.data),
  getLeaveRequestById: (id) => api.get(`/leave-requests/${id}`).then((r) => r.data),
  createLeaveRequest: (payload) => api.post('/leave-requests', payload).then((r) => r.data),
  approveLeaveRequest: (id) => api.put(`/leave-requests/${id}/approve`).then((r) => r.data),
  rejectLeaveRequest: (id, rejectionReason) =>
    api.put(`/leave-requests/${id}/reject`, { rejectionReason }).then((r) => r.data),
  cancelLeaveRequest: (id) => api.put(`/leave-requests/${id}/cancel`).then((r) => r.data),
};
