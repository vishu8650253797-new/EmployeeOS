const { Types } = require('mongoose');
const { AssetRequest, AssetCategory, Employee } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const assetAccess = require('../utils/assetAccess');

const DEFAULTS = { page: 1, limit: 20 };

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[asset-requests] socket emit failed:', err);
  }
}

async function notifyUser(userId, organizationId, type, title, message, entityId) {
  if (!userId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: userId, type, title, message, entityType: 'AssetRequest', entityId,
    });
  } catch (err) {
    console.error('[asset-requests] notifyUser failed:', err);
  }
}

async function notifyApprovers(organizationId, type, title, message, entityId) {
  try {
    const { User } = require('../models');
    const approvers = await User.find({
      organizationId: new Types.ObjectId(organizationId),
      role: { $in: assetAccess.REQUEST_APPROVER_ROLES },
      status: 'active',
    }).select('_id').lean();
    await Promise.all(approvers.map((u) => notifyUser(u._id, organizationId, type, title, message, entityId)));
  } catch (err) {
    console.error('[asset-requests] notifyApprovers failed:', err);
  }
}

function toDTO(request) {
  return { ...request, id: request._id.toString() };
}

async function resolveRequesterEmployeeId(user) {
  if (user.employeeId) return user.employeeId;
  const employee = await Employee.findOne({ userId: user._id, isDeleted: false }).select('_id').lean();
  if (!employee) throw new AppError('No employee profile is linked to your account', 400);
  return employee._id;
}

async function getRequests(organizationId, filters = {}, user) {
  const { status, priority, requesterId, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (status) query.status = status;
  if (priority) query.priority = priority;

  if (assetAccess.canApproveRequests(user.role)) {
    if (requesterId && Types.ObjectId.isValid(requesterId)) query.requesterId = new Types.ObjectId(requesterId);
  } else {
    query.requesterId = await resolveRequesterEmployeeId(user);
  }

  const [data, total] = await Promise.all([
    AssetRequest.find(query)
      .populate('requesterId', 'firstName lastName avatar employeeId')
      .populate('assetCategoryId', 'name icon')
      .populate('approvedBy', 'firstName lastName')
      .populate('fulfilledAssetId', 'assetTag name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AssetRequest.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getRequestById(organizationId, id, user) {
  const request = await AssetRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('requesterId', 'firstName lastName avatar employeeId userId')
    .populate('assetCategoryId', 'name icon')
    .populate('approvedBy', 'firstName lastName')
    .populate('fulfilledAssetId', 'assetTag name')
    .lean();
  if (!request) throw new AppError('Asset request not found', 404);

  if (!assetAccess.canApproveRequests(user.role)) {
    const requesterEmployeeId = await resolveRequesterEmployeeId(user);
    if (request.requesterId._id.toString() !== requesterEmployeeId.toString()) {
      throw new AppError('Forbidden: you do not have access to this request', 403);
    }
  }

  return toDTO(request);
}

async function createRequest(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const requesterId = await resolveRequesterEmployeeId(user);

  const category = await AssetCategory.findOne({ _id: payload.assetCategoryId, organizationId: orgId, isActive: true });
  if (!category) throw new AppError('Asset category not found or inactive', 404);

  const request = await AssetRequest.create({
    organizationId: orgId,
    requesterId,
    assetCategoryId: category._id,
    requestedAssetType: payload.requestedAssetType || '',
    reason: payload.reason,
    priority: payload.priority || 'MEDIUM',
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ASSET_REQUEST_CREATED', entityType: 'AssetRequest', entityId: request._id,
    metadata: { categoryId: category._id.toString() }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.ASSET_REQUEST_CREATED, { requestId: request._id.toString(), requesterId: requesterId.toString() });

  const requester = await Employee.findById(requesterId).select('firstName lastName').lean();
  await notifyApprovers(
    orgId, 'ASSET_REQUEST_CREATED', 'New asset request',
    `${requester ? `${requester.firstName} ${requester.lastName}` : 'An employee'} requested a ${category.name}.`,
    request._id
  );

  return getRequestById(organizationId, request._id, user);
}

async function approveRequest(organizationId, id, user, reqMeta = {}) {
  if (!assetAccess.canApproveRequests(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);

  const request = await AssetRequest.findOne({ _id: id, organizationId: orgId }).populate('requesterId', 'userId firstName lastName');
  if (!request) throw new AppError('Asset request not found', 404);
  if (request.status !== 'PENDING') throw new AppError(`Request is already ${request.status.toLowerCase()}`, 400);
  if (request.requesterId?.userId && request.requesterId.userId.toString() === user._id.toString()) {
    throw new AppError('You cannot approve your own asset request', 403);
  }

  request.status = 'APPROVED';
  request.approvedBy = user._id;
  request.approvedAt = new Date();
  await request.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ASSET_REQUEST_APPROVED', entityType: 'AssetRequest', entityId: request._id, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_REQUEST_APPROVED, { requestId: request._id.toString() });

  if (request.requesterId?.userId) {
    await notifyUser(request.requesterId.userId, orgId, 'ASSET_REQUEST_APPROVED', 'Asset request approved',
      'Your asset request has been approved and is awaiting fulfillment.', request._id);
  }

  return getRequestById(organizationId, request._id, user);
}

async function rejectRequest(organizationId, id, rejectionReason, user, reqMeta = {}) {
  if (!assetAccess.canApproveRequests(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  if (!rejectionReason || !rejectionReason.trim()) throw new AppError('A rejection reason is required', 400);
  const orgId = new Types.ObjectId(organizationId);

  const request = await AssetRequest.findOne({ _id: id, organizationId: orgId }).populate('requesterId', 'userId');
  if (!request) throw new AppError('Asset request not found', 404);
  if (request.status !== 'PENDING') throw new AppError(`Request is already ${request.status.toLowerCase()}`, 400);

  request.status = 'REJECTED';
  request.rejectionReason = rejectionReason.trim();
  request.approvedBy = user._id;
  request.approvedAt = new Date();
  await request.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ASSET_REQUEST_REJECTED', entityType: 'AssetRequest', entityId: request._id,
    metadata: { rejectionReason }, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_REQUEST_REJECTED, { requestId: request._id.toString() });

  if (request.requesterId?.userId) {
    await notifyUser(request.requesterId.userId, orgId, 'ASSET_REQUEST_REJECTED', 'Asset request rejected',
      `Your asset request was rejected: ${rejectionReason}`, request._id);
  }

  return getRequestById(organizationId, request._id, user);
}

async function cancelRequest(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const request = await AssetRequest.findOne({ _id: id, organizationId: orgId });
  if (!request) throw new AppError('Asset request not found', 404);

  if (!assetAccess.canApproveRequests(user.role)) {
    const requesterEmployeeId = await resolveRequesterEmployeeId(user);
    if (request.requesterId.toString() !== requesterEmployeeId.toString()) {
      throw new AppError('Forbidden: you can only cancel your own request', 403);
    }
  }
  if (!['PENDING', 'APPROVED'].includes(request.status)) {
    throw new AppError(`A ${request.status.toLowerCase()} request cannot be cancelled`, 400);
  }

  request.status = 'CANCELLED';
  request.cancelledAt = new Date();
  request.cancelledBy = user._id;
  await request.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ASSET_REQUEST_CANCELLED', entityType: 'AssetRequest', entityId: request._id, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_REQUEST_CANCELLED, { requestId: request._id.toString() });

  return getRequestById(organizationId, request._id, user);
}

async function fulfillRequest(organizationId, id, assetId, user, reqMeta = {}) {
  if (!assetAccess.canApproveRequests(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);

  const request = await AssetRequest.findOne({ _id: id, organizationId: orgId }).populate('requesterId', 'userId');
  if (!request) throw new AppError('Asset request not found', 404);
  if (request.status !== 'APPROVED') throw new AppError('Only an approved request can be fulfilled', 400);

  // Reuses the standard assignment workflow so the fulfilling asset goes
  // through the same validation, history, audit, and notification path.
  const assetService = require('./assetService');
  await assetService.assignAsset(organizationId, assetId, {
    employeeId: request.requesterId._id,
    assignmentNotes: `Fulfilled asset request ${request._id.toString()}`,
  }, user, reqMeta);

  request.status = 'FULFILLED';
  request.fulfilledAssetId = assetId;
  await request.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ASSET_REQUEST_FULFILLED', entityType: 'AssetRequest', entityId: request._id,
    metadata: { assetId }, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_REQUEST_FULFILLED, { requestId: request._id.toString(), assetId });

  if (request.requesterId?.userId) {
    await notifyUser(request.requesterId.userId, orgId, 'ASSET_REQUEST_FULFILLED', 'Asset request fulfilled',
      'Your asset request has been fulfilled — check your assigned assets.', request._id);
  }

  return getRequestById(organizationId, request._id, user);
}

module.exports = {
  getRequests, getRequestById, createRequest, approveRequest, rejectRequest, cancelRequest, fulfillRequest,
};
