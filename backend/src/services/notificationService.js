const { Types } = require('mongoose');
const { Notification, User } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getUserRoom } = require('../socket/socketRooms');

const DEFAULTS = { page: 1, limit: 20 };

// Every module already passes a Mongoose model name as entityType (Asset, Offboarding,
// OnboardingProcess, LEAVE_REQUEST, ...). Deriving the notification category from it here
// means every existing caller gets categorization/preferences for free, with zero changes
// to the ~10 services that already call createNotification.
const ENTITY_TYPE_CATEGORIES = {
  Employee: 'EMPLOYEE',
  Asset: 'ASSET',
  AssetRequest: 'ASSET',
  AssetMaintenance: 'ASSET',
  Offboarding: 'OFFBOARDING',
  OnboardingProcess: 'ONBOARDING',
  OnboardingTask: 'ONBOARDING',
  JobOpening: 'RECRUITMENT',
  JobApplication: 'RECRUITMENT',
  Candidate: 'RECRUITMENT',
  Interview: 'RECRUITMENT',
  JobOffer: 'RECRUITMENT',
  LEAVE_REQUEST: 'LEAVE',
  EMPLOYEE_DOCUMENT: 'SYSTEM',
  DOCUMENT_REQUEST: 'SYSTEM',
};

function deriveCategory(entityType) {
  return ENTITY_TYPE_CATEGORIES[entityType] || 'SYSTEM';
}

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

// A notification is private to its recipient — findOneAndUpdate scoped by both
// _id and recipientId is the IDOR guard: a mismatched id is indistinguishable
// from a not-found id, so this never leaks whether another user's notification exists.
async function markAsRead(recipientId, id) {
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipientId: new Types.ObjectId(recipientId) },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new AppError('Notification not found', 404);
  return { success: true, message: 'Notification marked as read' };
}

async function markAllAsRead(recipientId) {
  await Notification.updateMany(
    { recipientId: new Types.ObjectId(recipientId), isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return { success: true, message: 'All notifications marked as read' };
}

function emitNewNotification(notification) {
  try {
    const io = getSocketInstance();
    if (!io) return;
    io.to(getUserRoom(notification.recipientId.toString())).emit(SOCKET_EVENTS.NOTIFICATION_NEW, {
      id: notification._id.toString(),
      type: notification.type,
      category: notification.category,
      priority: notification.priority,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType || null,
      entityId: notification.entityId ? notification.entityId.toString() : null,
      isRead: false,
      createdAt: notification.createdAt,
    });
  } catch (err) {
    console.error('[notifications] socket emit failed:', err);
  }
}

// The single funnel every module creates notifications through. Persists first
// (source of truth for offline/reconnect delivery per Step 10E), then pushes a
// real-time event — never the other way around. Respects the recipient's
// per-category preference so this stays the one place that logic needs to live.
async function createNotification({
  organizationId, recipientId, type, title, message, entityType, entityId, priority, actorUserId,
}) {
  const category = deriveCategory(entityType);

  const recipient = await User.findById(recipientId).select('notificationPreferences').lean();
  if (recipient?.notificationPreferences && recipient.notificationPreferences[category] === false) {
    return null;
  }

  const notification = await Notification.create({
    organizationId: new Types.ObjectId(organizationId),
    recipientId: new Types.ObjectId(recipientId),
    actorUserId: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
    type,
    category,
    priority: priority && ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority) ? priority : 'NORMAL',
    title,
    message,
    entityType,
    entityId: entityId ? new Types.ObjectId(entityId) : undefined,
  });

  emitNewNotification(notification);

  return notification.toObject({ virtuals: false });
}

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead, createNotification };
