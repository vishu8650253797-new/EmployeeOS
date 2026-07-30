const { Types } = require('mongoose');
const { EmployeeDocument, Employee, User, Notification } = require('../models');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getDocumentRoom } = require('../socket/socketRooms');
const { REMINDER_THRESHOLDS_DAYS } = require('../utils/documentExpiry');
const auditLogService = require('./auditLogService');

async function notifyEmployeeAndHR(document, { type, title, message }) {
  const employee = await Employee.findById(document.employeeId).lean();
  const io = getSocketInstance();
  const recipientUserIds = new Set();

  if (employee?.userId) recipientUserIds.add(employee.userId.toString());

  const hrUsers = await User.find({
    organizationId: document.organizationId,
    role: { $in: ['HR_ADMIN', 'SUPER_ADMIN'] },
    status: 'active',
  }).lean();
  hrUsers.forEach((u) => recipientUserIds.add(u._id.toString()));

  for (const userId of recipientUserIds) {
    await Notification.create({
      organizationId: document.organizationId,
      recipientId: new Types.ObjectId(userId),
      type,
      title,
      message,
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: document._id,
    });
    if (io) io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW);
  }

  if (io) {
    const socketEvent = type === 'DOCUMENT_EXPIRED' ? SOCKET_EVENTS.DOCUMENT_EXPIRED : SOCKET_EVENTS.DOCUMENT_EXPIRING;
    io.to(getDocumentRoom(document._id)).emit(socketEvent, { documentId: document._id.toString() });
    io.to(`organization:${document.organizationId}`).emit(socketEvent, { documentId: document._id.toString() });
  }
}

// Flips ACTIVE documents past their expiry date to EXPIRED and notifies the
// employee + HR. Idempotent: only documents still in ACTIVE status match.
async function scanAndProcessExpiries() {
  const expired = await EmployeeDocument.find({
    status: 'ACTIVE',
    isDeleted: false,
    expiryDate: { $lte: new Date() },
  });

  let processed = 0;
  for (const document of expired) {
    document.status = 'EXPIRED';
    await document.save();

    await auditLogService.recordAction({
      organizationId: document.organizationId,
      userId: null,
      actorType: 'SYSTEM',
      action: 'DOCUMENT_EXPIRED',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: document._id,
    });

    await notifyEmployeeAndHR(document, {
      type: 'DOCUMENT_EXPIRED',
      title: 'Document expired',
      message: `"${document.title}" has expired.`,
    });
    processed += 1;
  }
  return { processed };
}

// Sends reminders at fixed day thresholds before expiry. Dedup is enforced
// atomically via remindersSent so overlapping cron ticks / multiple app
// instances can never send the same threshold twice.
async function sendExpiryReminders() {
  const now = new Date();
  const maxThreshold = Math.max(...REMINDER_THRESHOLDS_DAYS);
  const horizon = new Date(now.getTime() + maxThreshold * 24 * 60 * 60 * 1000);

  const candidates = await EmployeeDocument.find({
    status: 'ACTIVE',
    isDeleted: false,
    expiryDate: { $gt: now, $lte: horizon },
  }).lean();

  let sent = 0;
  for (const document of candidates) {
    const daysLeft = Math.ceil((new Date(document.expiryDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const alreadySent = new Set((document.remindersSent || []).map((r) => r.threshold));
    const threshold = REMINDER_THRESHOLDS_DAYS
      .filter((t) => daysLeft <= t && !alreadySent.has(t))
      .sort((a, b) => b - a)[0];

    if (threshold === undefined) continue;

    const claimed = await EmployeeDocument.findOneAndUpdate(
      { _id: document._id, 'remindersSent.threshold': { $ne: threshold } },
      { $push: { remindersSent: { threshold, sentAt: new Date() } } },
      { new: true }
    );
    if (!claimed) continue; // another process already claimed this threshold

    await notifyEmployeeAndHR(claimed, {
      type: 'DOCUMENT_EXPIRING',
      title: threshold <= 1 ? 'Document expiring today' : `Document expiring in ${threshold} days`,
      message: `"${claimed.title}" expires on ${new Date(claimed.expiryDate).toISOString().slice(0, 10)}.`,
    });
    sent += 1;
  }
  return { sent };
}

module.exports = { scanAndProcessExpiries, sendExpiryReminders };
