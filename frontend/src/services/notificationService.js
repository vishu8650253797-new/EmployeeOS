import api from './api';

export const notificationService = {
  getNotifications: (params = {}) => api.get('/notifications', { params }).then((r) => r.data),
  getUnreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
  markAsRead: (id) => api.put(`/notifications/${id}/read`).then((r) => r.data),
  markAllAsRead: () => api.put('/notifications/read-all').then((r) => r.data),
};
