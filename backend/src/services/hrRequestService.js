const { Types } = require('mongoose');
const { HrRequest, User } = require('../models');
const { LOCKED_STATUSES, CANCELLABLE_STATUSES, HR_REQUEST_STATUSES } = require('../models/HrRequest');
const AppError = require('../utils/AppError');
const essAccess = require('../utils/essAccess');
const hrRequestAccess = require('../utils/hrRequestAccess');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom, getUserRoom } = require('../socket/socketRooms');

const DEFAULTS = { page: 1, limit: 20 };

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[hr-requests] socket emit failed:', err);
  }
}

function emitToUser(userId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getUserRoom(userId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[hr-requests] socket emit failed:', err);
  }
}

async function notifyUser(userId, organizationId, type, title, message, entityId) {
  if (!userId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: userId, type, title, message, entityType: 'HrRequest', entityId,
    });
  } catch (err) {
    console.error('[hr-requests] notifyUser failed:', err);
  }
}

async function notifyHrAdmins(organizationId, type, title, message, entityId) {
  try {
    const admins = await User.find({
      organizationId: new Types.ObjectId(organizationId),
      role: { $in: hrRequestAccess.HR_REQUEST_ADMIN_ROLES },
      status: 'active',
    }).select('_id').lean();
    await Promise.all(admins.map((u) => notifyUser(u._id, organizationId, type, title, message, entityId)));
  } catch (err) {
    console.error('[hr-requests] notifyHrAdmins failed:', err);
  }
}

function toDTO(request) {
  return { ...request, id: request._id.toString() };
}

async function paginate(query, page, limit) {
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    HrRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    HrRequest.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

// ---- Employee self-service ----------------------------------------------

async function getMyRequests(organizationId, user, filters = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const query = {
    organizationId: new Types.ObjectId(organizationId),
    employeeId: employee._id,
  };
  if (filters.status && HR_REQUEST_STATUSES.includes(filters.status)) query.status = filters.status;
  return paginate(query, filters.page, filters.limit);
}

async function getMyRequestById(organizationId, user, id) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const request = await HrRequest.findOne({
    _id: id, organizationId: new Types.ObjectId(organizationId), employeeId: employee._id,
  }).lean();
  if (!request) throw new AppError('Request not found', 404);
  return toDTO(request);
}

async function createRequest(organizationId, user, payload, reqMeta = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const orgId = new Types.ObjectId(organizationId);

  const request = await HrRequest.create({
    organizationId: orgId,
    employeeId: employee._id,
    category: payload.category,
    subject: payload.subject,
    description: payload.description,
    createdBy: user._id,
    statusHistory: [{ status: 'SUBMITTED', changedBy: user._id }],
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ESS_HR_REQUEST_CREATED', entityType: 'HrRequest', entityId: request._id,
    metadata: { category: payload.category }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.HR_REQUEST_CREATED, { requestId: request._id.toString() });
  await notifyHrAdmins(
    orgId, 'HR_REQUEST_CREATED', 'New HR request',
    `${employee.firstName} ${employee.lastName} submitted a new HR request: ${request.subject}`,
    request._id
  );

  return getMyRequestById(organizationId, user, request._id);
}

async function addMyMessage(organizationId, user, id, message, reqMeta = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const orgId = new Types.ObjectId(organizationId);
  const request = await HrRequest.findOne({ _id: id, organizationId: orgId, employeeId: employee._id });
  if (!request) throw new AppError('Request not found', 404);
  if (LOCKED_STATUSES.includes(request.status)) throw new AppError('This request is closed and no longer accepts messages', 409);

  request.messages.push({ authorId: user._id, authorRole: user.role, message });
  await request.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ESS_HR_REQUEST_MESSAGE_ADDED', entityType: 'HrRequest', entityId: request._id, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.HR_REQUEST_MESSAGE_ADDED, { requestId: request._id.toString() });
  await notifyHrAdmins(orgId, 'HR_REQUEST_MESSAGE_ADDED', 'New reply on an HR request',
    `${employee.firstName} ${employee.lastName} replied on "${request.subject}".`, request._id);

  return getMyRequestById(organizationId, user, request._id);
}

async function cancelRequest(organizationId, user, id, reqMeta = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const orgId = new Types.ObjectId(organizationId);
  const request = await HrRequest.findOne({ _id: id, organizationId: orgId, employeeId: employee._id });
  if (!request) throw new AppError('Request not found', 404);
  if (!CANCELLABLE_STATUSES.includes(request.status)) {
    throw new AppError(`A request that is ${request.status.toLowerCase().replace('_', ' ')} can no longer be cancelled`, 409);
  }

  request.status = 'CANCELLED';
  request.cancelledAt = new Date();
  request.statusHistory.push({ status: 'CANCELLED', changedBy: user._id });
  await request.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ESS_HR_REQUEST_CANCELLED', entityType: 'HrRequest', entityId: request._id, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.HR_REQUEST_CANCELLED, { requestId: request._id.toString() });

  return getMyRequestById(organizationId, user, request._id);
}

// ---- HR/admin side --------------------------------------------------------

function assertCanManage(user) {
  if (!hrRequestAccess.canManageHrRequests(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
}

async function getRequests(organizationId, filters = {}, user) {
  assertCanManage(user);
  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (filters.status && HR_REQUEST_STATUSES.includes(filters.status)) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (filters.employeeId && Types.ObjectId.isValid(filters.employeeId)) query.employeeId = filters.employeeId;
  return paginate(query, filters.page, filters.limit);
}

async function getRequestById(organizationId, id, user) {
  assertCanManage(user);
  const request = await HrRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!request) throw new AppError('Request not found', 404);
  return toDTO(request);
}

async function addAdminMessage(organizationId, user, id, message, reqMeta = {}) {
  assertCanManage(user);
  const orgId = new Types.ObjectId(organizationId);
  const request = await HrRequest.findOne({ _id: id, organizationId: orgId }).populate('employeeId', 'userId');
  if (!request) throw new AppError('Request not found', 404);
  if (LOCKED_STATUSES.includes(request.status)) throw new AppError('This request is closed and no longer accepts messages', 409);

  request.messages.push({ authorId: user._id, authorRole: user.role, message });
  await request.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'HR_REQUEST_MESSAGE_ADDED', entityType: 'HrRequest', entityId: request._id, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.HR_REQUEST_MESSAGE_ADDED, { requestId: request._id.toString() });
  if (request.employeeId?.userId) {
    emitToUser(request.employeeId.userId, SOCKET_EVENTS.HR_REQUEST_MESSAGE_ADDED, { requestId: request._id.toString() });
    await notifyUser(request.employeeId.userId, orgId, 'HR_REQUEST_MESSAGE_ADDED', 'HR responded to your request',
      `There's a new reply on "${request.subject}".`, request._id);
  }

  return getRequestById(organizationId, request._id, user);
}

async function updateStatus(organizationId, user, id, { status, note }, reqMeta = {}) {
  assertCanManage(user);
  if (!HR_REQUEST_STATUSES.includes(status)) throw new AppError('Invalid status', 400);
  const orgId = new Types.ObjectId(organizationId);
  const request = await HrRequest.findOne({ _id: id, organizationId: orgId }).populate('employeeId', 'userId');
  if (!request) throw new AppError('Request not found', 404);
  if (LOCKED_STATUSES.includes(request.status)) throw new AppError(`Request is already ${request.status.toLowerCase()}`, 409);

  request.status = status;
  if (status === 'RESOLVED') request.resolvedAt = new Date();
  request.statusHistory.push({ status, changedBy: user._id, note: note || undefined });
  await request.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'HR_REQUEST_STATUS_CHANGED', entityType: 'HrRequest', entityId: request._id,
    metadata: { status }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.HR_REQUEST_STATUS_CHANGED, { requestId: request._id.toString(), status });
  if (request.employeeId?.userId) {
    emitToUser(request.employeeId.userId, SOCKET_EVENTS.HR_REQUEST_STATUS_CHANGED, { requestId: request._id.toString(), status });
    await notifyUser(request.employeeId.userId, orgId, 'HR_REQUEST_STATUS_CHANGED', 'Your HR request was updated',
      `"${request.subject}" is now ${status.toLowerCase().replace('_', ' ')}.`, request._id);
  }

  return getRequestById(organizationId, request._id, user);
}

module.exports = {
  getMyRequests,
  getMyRequestById,
  createRequest,
  addMyMessage,
  cancelRequest,
  getRequests,
  getRequestById,
  addAdminMessage,
  updateStatus,
};
