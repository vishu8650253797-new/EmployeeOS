const { Types } = require('mongoose');
const { AuditLog } = require('../models');

const DEFAULTS = { page: 1, limit: 20 };

async function recordAction({
  organizationId,
  userId,
  actorType = 'USER',
  action,
  entityType,
  entityId,
  metadata,
  ipAddress,
  userAgent,
  session,
}) {
  const [entry] = await AuditLog.create(
    [
      {
        organizationId: new Types.ObjectId(organizationId),
        userId: userId ? new Types.ObjectId(userId) : undefined,
        actorType,
        action,
        entityType,
        entityId: new Types.ObjectId(entityId),
        metadata: metadata || {},
        ipAddress,
        userAgent,
      },
    ],
    session ? { session } : undefined
  );
  return entry;
}

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

async function getAuditLogs(organizationId, filters = {}) {
  const { entityType, entityId, action, userId, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = new Types.ObjectId(entityId);
  if (action) query.action = action;
  if (userId) query.userId = new Types.ObjectId(userId);

  const [data, total] = await Promise.all([
    AuditLog.find(query).populate('userId', 'firstName lastName email role').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    data: data.map((d) => ({ ...d, id: d._id.toString() })),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getEntityHistory(organizationId, entityType, entityId) {
  const data = await AuditLog.find({
    organizationId: new Types.ObjectId(organizationId),
    entityType,
    entityId: new Types.ObjectId(entityId),
  })
    .populate('userId', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .lean();
  return data.map((d) => ({ ...d, id: d._id.toString() }));
}

module.exports = { recordAction, requestMeta, getAuditLogs, getEntityHistory };
