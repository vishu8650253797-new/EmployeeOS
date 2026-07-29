const notificationService = require('../services/notificationService');

exports.getNotifications = async (req, res) => {
  const { data, pagination } = await notificationService.getNotifications(req.user._id, req.query);
  res.json({ success: true, data, pagination });
};

exports.getUnreadCount = async (req, res) => {
  const data = await notificationService.getUnreadCount(req.user._id);
  res.json({ success: true, data });
};

exports.markAsRead = async (req, res) => {
  const result = await notificationService.markAsRead(req.user._id, req.params.id);
  res.json(result);
};

exports.markAllAsRead = async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user._id);
  res.json(result);
};
