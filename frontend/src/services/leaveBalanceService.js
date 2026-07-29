import api from './api';

export const leaveBalanceService = {
  getLeaveBalances: (params = {}) => api.get('/leave-balances', { params }).then((r) => r.data),
  getMyLeaveBalances: () => api.get('/leave-balances/my').then((r) => r.data),
  getEmployeeLeaveBalances: (employeeId, params = {}) =>
    api.get(`/leave-balances/employee/${employeeId}`, { params }).then((r) => r.data),
  updateLeaveBalance: (id, payload) => api.put(`/leave-balances/${id}`, payload).then((r) => r.data),
};
