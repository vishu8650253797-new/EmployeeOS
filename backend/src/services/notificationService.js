const { Types } = require('mongoose');
const { Notification } = require('../models');
const AppError = require('../utils/AppError');

const DEFAULTS = { page: 1, limit: 20 };

async function getNotifications(recipientId, filters = {}) {
  const { isRead, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { recipientId: new Types.ObjectId(recipientId) };
  if (isRead === 'true') query.isRead = true;
  if (isRead === 'false') query.isRead = false;

  const [data, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Notification.countDocuments(query),
  ]);

  const items = data.map((n) => ({ ...n, id: n._id.toString() }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getUnreadCount(recipientId) {
  const count = await Notification.countDocuments({ recipientId: new Types.ObjectId(recipientId), isRead: false });
  return { count };
}

async function markAsRead(recipientId, id) {
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipientId: new Types.ObjectId(recipientId) },
    { isRead: true },
    { new: true }
  );
  if (!notification) throw new AppError('Notification not found', 404);
  return { success: true, message: 'Notification marked as read' };
}

async function markAllAsRead(recipientId) {
  await Notification.updateMany({ recipientId: new Types.ObjectId(recipientId), isRead: false }, { isRead: true });
  return { success: true, message: 'All notifications marked as read' };
}

async function createNotification({ organizationId, recipientId, type, title, message, entityType, entityId }) {
  const notification = await Notification.create({
    organizationId: new Types.ObjectId(organizationId),
    recipientId: new Types.ObjectId(recipientId),
    type,
    title,
    message,
    entityType,
    entityId: entityId ? new Types.ObjectId(entityId) : undefined,
  });
  return notification.toObject({ virtuals: false });
}

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead, createNotification };
