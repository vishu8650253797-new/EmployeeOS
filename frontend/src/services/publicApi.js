import axios from 'axios';

// Unauthenticated Axios client for auth endpoints.
// Sends cookies (withCredentials) so the HTTP-only refresh token can be exchanged.

const publicApi = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? 'http://127.0.0.1:5100/api' : '/api'),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

publicApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Network error';
    return Promise.reject(new Error(message));
  }
);

export default publicApi;
