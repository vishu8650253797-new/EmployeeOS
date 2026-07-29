import api from './api';
import publicApi from './publicApi';

// In-memory access token — never persisted to localStorage.
let accessToken = null;

function normalizeUser(data) {
  const user = data?.user || data;
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const name = user.name || `${firstName} ${lastName}`.trim();
  return {
    id: user._id || user.id,
    name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId?._id || user.organizationId,
    avatar: user.avatar || null,
    jobTitle: user.jobTitle || '',
    department: user.department || '',
  };
}

export const authService = {
  setAccessToken(token) {
    accessToken = token || null;
  },

  getAccessToken() {
    return accessToken;
  },

  async register(payload) {
    const response = await publicApi.post('/auth/register', payload);
    const user = normalizeUser(response.data);
    this.setAccessToken(response.data.accessToken);
    return user;
  },

  async login({ email, password }) {
    const response = await publicApi.post('/auth/login', {
      email: email?.toLowerCase().trim(),
      password: password?.trim(),
    });
    const user = normalizeUser(response.data);
    this.setAccessToken(response.data.accessToken);
    return user;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      this.setAccessToken(null);
    }
  },

  async getMe() {
    const response = await api.get('/auth/me');
    return normalizeUser(response.data);
  },

  async refreshToken() {
    const response = await publicApi.post('/auth/refresh');
    this.setAccessToken(response.data.accessToken);
    return normalizeUser(response.data);
  },

  async initialize() {
    // On app start, try to refresh the session using the HTTP-only cookie.
    await this.refreshToken();
    return this.getMe();
  },
};
