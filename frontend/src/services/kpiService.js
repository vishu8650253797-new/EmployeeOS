import api from './api';

const kpiService = {
  getKPIs: (params) => api.get('/kpis', { params }),
  getKPIById: (id) => api.get(`/kpis/${id}`),
  getEmployeeKPIs: (employeeId, params) => api.get(`/kpis/employee/${employeeId}`, { params }),
  getCycleKPIs: (cycleId) => api.get(`/kpis/cycle/${cycleId}`),
  createKPI: (data) => api.post('/kpis', data),
  updateKPI: (id, data) => api.put(`/kpis/${id}`, data),
  deleteKPI: (id) => api.delete(`/kpis/${id}`),
  updateKPIValue: (id, data) => api.put(`/kpis/${id}/value`, data),
};

export { kpiService };
