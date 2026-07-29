import api from './api';

const goalService = {
  getGoals: (params) => api.get('/goals', { params }),
  getGoalById: (id) => api.get(`/goals/${id}`),
  getMyGoals: (params) => api.get('/goals/my', { params }),
  getEmployeeGoals: (employeeId, params) => api.get(`/goals/employee/${employeeId}`, { params }),
  getCycleGoals: (cycleId) => api.get(`/goals/cycle/${cycleId}`),
  createGoal: (data) => api.post('/goals', data),
  updateGoal: (id, data) => api.put(`/goals/${id}`, data),
  deleteGoal: (id) => api.delete(`/goals/${id}`),
  updateGoalProgress: (id, data) => api.put(`/goals/${id}/progress`, data),
  updateGoalStatus: (id, status) => api.put(`/goals/${id}/status`, { status }),
  getGoalProgressHistory: (id) => api.get(`/goals/${id}/progress-history`),
};

export { goalService };
