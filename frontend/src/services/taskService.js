import api from './api';

export const taskService = {
  getTasks: (params = {}) => api.get('/tasks', { params }).then((r) => r.data),
  getTaskById: (id) => api.get(`/tasks/${id}`).then((r) => r.data),
  createTask: (payload) => api.post('/tasks', payload).then((r) => r.data),
  updateTask: (id, payload) => api.put(`/tasks/${id}`, payload).then((r) => r.data),
  deleteTask: (id) => api.delete(`/tasks/${id}`).then((r) => r.data),
  updateTaskStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }).then((r) => r.data),
  assignTask: (id, assigneeIds) => api.patch(`/tasks/${id}/assign`, { assigneeIds }).then((r) => r.data),
};
