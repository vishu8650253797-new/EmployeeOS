import api from './api';

export const offerService = {
  getOffers: async (params = {}) => {
    const response = await api.get('/recruitment/offers', { params });
    return response.data;
  },

  getOffer: async (id) => {
    const response = await api.get(`/recruitment/offers/${id}`);
    return response.data.data;
  },

  createOffer: async (data) => {
    const response = await api.post('/recruitment/offers', data);
    return response.data.data;
  },

  updateOffer: async (id, data) => {
    const response = await api.put(`/recruitment/offers/${id}`, data);
    return response.data.data;
  },

  sendOffer: async (id) => {
    const response = await api.put(`/recruitment/offers/${id}/send`);
    return response.data.data;
  },

  withdrawOffer: async (id, withdrawalReason) => {
    const response = await api.put(`/recruitment/offers/${id}/withdraw`, { withdrawalReason });
    return response.data.data;
  },
};
