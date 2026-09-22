import api from './api';

export const hrRequestService = {
  async getRequests(params = {}) {
    const { data } = await api.get('/ess/requests', { params });
    return data;
  },

  async getRequestById(id) {
    const { data } = await api.get(`/ess/requests/${id}`);
    return data.data;
  },

  async createRequest(payload) {
    const { data } = await api.post('/ess/requests', payload);
    return data.data;
  },

  async addMessage(id, message) {
    const { data } = await api.post(`/ess/requests/${id}/messages`, { message });
    return data.data;
  },

  async cancelRequest(id) {
    const { data } = await api.post(`/ess/requests/${id}/cancel`);
    return data.data;
  },
};

export const HR_REQUEST_CATEGORIES = [
  { value: 'EMPLOYMENT_LETTER', label: 'Employment Letter' },
  { value: 'SALARY_CERTIFICATE', label: 'Salary Certificate' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience Letter' },
  { value: 'PERSONAL_INFO_UPDATE', label: 'Personal Information Update' },
  { value: 'PAYROLL_CLARIFICATION', label: 'Payroll Clarification' },
  { value: 'LEAVE_CLARIFICATION', label: 'Leave Clarification' },
  { value: 'BENEFITS_INQUIRY', label: 'Benefits Inquiry' },
  { value: 'DOCUMENT_REQUEST', label: 'Document Request' },
  { value: 'GENERAL_INQUIRY', label: 'General Inquiry' },
  { value: 'OTHER', label: 'Other' },
];
