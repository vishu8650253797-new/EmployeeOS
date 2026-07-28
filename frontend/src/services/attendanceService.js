import api from './api';

export const attendanceService = {
  async checkIn(notes = '') {
    const { data } = await api.post('/attendance/check-in', { notes });
    return data.data;
  },

  async checkOut(notes = '') {
    const { data } = await api.post('/attendance/check-out', { notes });
    return data.data;
  },

  async getToday() {
    const { data } = await api.get('/attendance/today');
    return data.data;
  },

  async getMyHistory(params = {}) {
    const { data } = await api.get('/attendance/my-history', { params });
    return data.data;
  },

  async getAttendance(params = {}) {
    const { data } = await api.get('/attendance', { params });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/attendance/${id}`);
    return data.data;
  },

  async getEmployeeAttendance(employeeId, params = {}) {
    const { data } = await api.get(`/attendance/employee/${employeeId}`, { params });
    return data.data;
  },

  async getEmployeeSummary(employeeId, params = {}) {
    const { data } = await api.get(`/attendance/employee/${employeeId}/summary`, { params });
    return data.data;
  },

  async getDepartmentAttendance(departmentId, params = {}) {
    const { data } = await api.get(`/attendance/department/${departmentId}`, { params });
    return data.data;
  },

  async getDepartmentStats(departmentId, params = {}) {
    const { data } = await api.get(`/attendance/department/${departmentId}/stats`, { params });
    return data.data;
  },

  async getStats(params = {}) {
    const { data } = await api.get('/attendance/stats', { params });
    return data.data;
  },
};
