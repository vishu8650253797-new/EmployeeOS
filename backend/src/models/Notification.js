const { Schema, model } = require('mongoose');

const NOTIFICATION_CATEGORIES = [
  'SYSTEM', 'EMPLOYEE', 'RECRUITMENT', 'ONBOARDING', 'ASSET', 'OFFBOARDING',
  'LEAVE', 'ATTENDANCE', 'APPROVAL', 'SECURITY', 'ANNOUNCEMENT',
];
const NOTIFICATION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const notificationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, default: 'SYSTEM', index: true },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: 'NORMAL' },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    entityType: { type: String, trim: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// notificationService queries always filter by recipientId alone (never
// organizationId — a user belongs to exactly one org, so recipientId is already
// fully exclusive); recipientId must lead the compound index or Mongo can't use
// it for the unread-count check or the paginated/sorted list query.
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

module.exports = model('Notification', notificationSchema);
module.exports.NOTIFICATION_CATEGORIES = NOTIFICATION_CATEGORIES;
module.exports.NOTIFICATION_PRIORITIES = NOTIFICATION_PRIORITIES;
