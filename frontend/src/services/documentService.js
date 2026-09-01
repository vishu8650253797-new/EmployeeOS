import api from './api';

export const documentService = {
  // Get all documents for an organization
  getDocuments: async (params = {}) => {
    const response = await api.get('/documents', { params });
    return response.data.data || [];
  },

  // Get documents for a specific employee
  getEmployeeDocuments: async (employeeId, params = {}) => {
    const response = await api.get(`/documents/employee/${employeeId}`, { params });
    return response.data.data || [];
  },

  // Get a single document by ID
  getDocument: async (id) => {
    const response = await api.get(`/documents/${id}`);
    return response.data.data;
  },

  // Upload a document
  uploadDocument: async (formData) => {
    const response = await api.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  // Download a document
  downloadDocument: async (id) => {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    return response;
  },

  // Preview a document
  previewDocument: async (id) => {
    const response = await api.get(`/documents/${id}/preview`, {
      responseType: 'blob',
    });
    return response;
  },

  // Update document metadata
  updateDocument: async (id, data) => {
    const response = await api.put(`/documents/${id}`, data);
    return response.data.data;
  },

  // Delete a document
  deleteDocument: async (id) => {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  // Verify a document
  verifyDocument: async (id, data) => {
    const response = await api.patch(`/documents/${id}/verify`, data);
    return response.data.data;
  },

  // Reject a document
  rejectDocument: async (id, data) => {
    const response = await api.patch(`/documents/${id}/reject`, data);
    return response.data.data;
  },
};
