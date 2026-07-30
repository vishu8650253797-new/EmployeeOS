import api from './api';

export const documentRequestService = {
  // Get all document requests
  getRequests: async (params = {}) => {
    const response = await api.get('/document-requests', { params });
    return response.data.data || [];
  },

  // Get my document requests
  getMyRequests: async (params = {}) => {
    const response = await api.get('/document-requests/my', { params });
    return response.data.data || [];
  },

  // Get requests for a specific employee
  getEmployeeRequests: async (employeeId, params = {}) => {
    const response = await api.get(`/document-requests/employee/${employeeId}`, { params });
    return response.data.data || [];
  },

  // Get a single request by ID
  getRequest: async (id) => {
    const response = await api.get(`/document-requests/${id}`);
    return response.data.data;
  },

  // Create a new document request
  createRequest: async (data) => {
    const response = await api.post('/document-requests', data);
    return response.data.data;
  },

  // Update a document request
  updateRequest: async (id, data) => {
    const response = await api.put(`/document-requests/${id}`, data);
    return response.data.data;
  },

  // Cancel a document request
  cancelRequest: async (id) => {
    const response = await api.patch(`/document-requests/${id}/cancel`);
    return response.data.data;
  },

  // Upload document for a request
  uploadForRequest: async (id, formData) => {
    const response = await api.post(`/document-requests/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  // Approve a document request
  approveRequest: async (id) => {
    const response = await api.patch(`/document-requests/${id}/approve`);
    return response.data.data;
  },

  // Reject a document request
  rejectRequest: async (id, data) => {
    const response = await api.patch(`/document-requests/${id}/reject`, data);
    return response.data.data;
  },
};
