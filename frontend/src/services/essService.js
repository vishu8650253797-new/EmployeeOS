import api from './api';

export const essService = {
  async getMe() {
    const { data } = await api.get('/ess/me');
    return data.data;
  },
};
