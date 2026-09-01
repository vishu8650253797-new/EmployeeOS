import api from './api';

export const assetCategoryService = {
  async getCategories(params = {}) {
    const { data } = await api.get('/assets/categories', { params });
    return data.data || [];
  },

  async getCategoryById(id) {
    const { data } = await api.get(`/assets/categories/${id}`);
    return data.data;
  },

  async createCategory(payload) {
    const { data } = await api.post('/assets/categories', payload);
    return data.data;
  },

  async updateCategory(id, payload) {
    const { data } = await api.put(`/assets/categories/${id}`, payload);
    return data.data;
  },

  async deleteCategory(id) {
    const { data } = await api.delete(`/assets/categories/${id}`);
    return data;
  },
};
