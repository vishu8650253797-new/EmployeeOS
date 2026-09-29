import api from './api';

export const employeeScheduleService = {
  async getSchedules(params = {}) {
    const { data } = await api.get('/employee-schedules', { params });
    return data;
  },

  async getScheduleById(id) {
    const { data } = await api.get(`/employee-schedules/${id}`);
    return data.data;
  },

  async assign(payload) {
    const { data } = await api.post('/employee-schedules', payload);
    return data.data;
  },

  async updateSchedule(id, payload) {
    const { data } = await api.patch(`/employee-schedules/${id}`, payload);
    return data.data;
  },

  async cancel(id) {
    const { data } = await api.post(`/employee-schedules/${id}/cancel`);
    return data.data;
  },

  async validateAssignment(payload) {
    const { data } = await api.post('/employee-schedules/validate', payload);
    return data.data;
  },

  async bulkAssign(payload) {
    const { data } = await api.post('/employee-schedules/bulk', payload);
    return data.data;
  },
};
