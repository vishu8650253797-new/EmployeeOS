import api from './api';

export const taskCommentService = {
  getTaskComments: (taskId, params = {}) => api.get(`/comments/task/${taskId}`, { params }).then((r) => r.data),
  getCommentById: (id) => api.get(`/comments/${id}`).then((r) => r.data),
  createTaskComment: (taskId, payload) => api.post(`/comments/task/${taskId}`, payload).then((r) => r.data),
  updateTaskComment: (id, payload) => api.put(`/comments/${id}`, payload).then((r) => r.data),
  deleteTaskComment: (id) => api.delete(`/comments/${id}`).then((r) => r.data),
};
