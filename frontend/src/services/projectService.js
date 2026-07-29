import api from './api';

export const projectService = {
  getProjects: (params = {}) => api.get('/projects', { params }),
  getProjectById: (id) => api.get(`/projects/${id}`),
  createProject: (payload) => api.post('/projects', payload),
  updateProject: (id, payload) => api.put(`/projects/${id}`, payload),
  deleteProject: (id) => api.delete(`/projects/${id}`),
  addProjectMember: (id, employeeId) => api.post(`/projects/${id}/members`, { employeeId }),
  removeProjectMember: (id, employeeId) => api.delete(`/projects/${id}/members`, { data: { employeeId } }),
  getProjectStatistics: (id) => api.get(`/projects/${id}/statistics`),
  calculateProjectProgress: (id) => api.post(`/projects/${id}/progress`),
};
