import api from './api';

export const documentCategoryService = {
  // Get all document categories
  getCategories: async (params = {}) => {
    const response = await api.get('/document-categories', { params });
    return response.data.data || [];
  },

  // Get a single category by ID
  getCategory: async (id) => {
    const response = await api.get(`/document-categories/${id}`);
    return response.data.data;
  },

  // Create a new category
  createCategory: async (data) => {
    const response = await api.post('/document-categories', data);
    return response.data.data;
  },

  // Update a category
  updateCategory: async (id, data) => {
    const response = await api.put(`/document-categories/${id}`, data);
    return response.data.data;
  },

  // Delete a category
  deleteCategory: async (id) => {
    const response = await api.delete(`/document-categories/${id}`);
    return response.data;
  },
};
