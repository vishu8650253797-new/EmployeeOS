const { Types } = require('mongoose');
const { AssetMaintenance, Asset, AssetHistory, AssetVendor, User } = require('../models');
const { MAINTENANCE_STATUSES } = require('../models/AssetMaintenance');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const { withTransaction } = require('../utils/withTransaction');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const assetAccess = require('../utils/assetAccess');

const DEFAULTS = { page: 1, limit: 20 };

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[maintenance] socket emit failed:', err);
  }
}

async function notifyUser(userId, organizationId, type, title, message, entityId) {
  if (!userId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: userId, type, title, message, entityType: 'AssetMaintenance', entityId,
    });
  } catch (err) {
    console.error('[maintenance] notifyUser failed:', err);
  }
}

async function notifyItAdmins(organizationId, type, title, message, entityId) {
  try {
    const users = await User.find({
      organizationId: new Types.ObjectId(organizationId),
      role: { $in: assetAccess.FULL_ROLES },
      status: 'active',
    }).select('_id').lean();
    await Promise.all(users.map((u) => notifyUser(u._id, organizationId, type, title, message, entityId)));
  } catch (err) {
    console.error('[maintenance] notifyItAdmins failed:', err);
  }
}

function toDTO(record) {
  return { ...record, id: record._id.toString() };
}

async function assertCanReport(organizationId, asset, user) {
  if (assetAccess.canManageAssets(user.role)) return;
  if (asset.assignedTo && user.employeeId && asset.assignedTo.toString() === user.employeeId.toString()) return;
  throw new AppError('Forbidden: you can only report issues on an asset assigned to you', 403);
}

async function getMaintenanceForAsset(organizationId, assetId, user) {
  if (!assetAccess.canViewInventory(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const data = await AssetMaintenance.find({ organizationId, assetId })
    .populate('reportedBy', 'firstName lastName')
    .populate('assignedTechnicianId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .lean();
  return { data: data.map(toDTO) };
}

async function getMaintenanceList(organizationId, filters = {}, user) {
  if (!assetAccess.canViewInventory(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const { status, priority, assetId, assignedTechnicianId, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (status && MAINTENANCE_STATUSES.includes(status)) query.status = status;
  if (priority) query.priority = priority;
  if (assetId && Types.ObjectId.isValid(assetId)) query.assetId = new Types.ObjectId(assetId);
  if (assignedTechnicianId && Types.ObjectId.isValid(assignedTechnicianId)) query.assignedTechnicianId = new Types.ObjectId(assignedTechnicianId);

  const [data, total] = await Promise.all([
    AssetMaintenance.find(query)
      .populate('assetId', 'assetTag name categoryId')
      .populate('reportedBy', 'firstName lastName')
      .populate('assignedTechnicianId', 'firstName lastName')
      .populate('vendorId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AssetMaintenance.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getMaintenanceById(organizationId, id, user) {
  const record = await AssetMaintenance.findOne({ _id: id, organizationId })
    .populate('assetId', 'assetTag name categoryId status')
    .populate('reportedBy', 'firstName lastName')
    .populate('assignedTechnicianId', 'firstName lastName')
    .populate('vendorId', 'name')
    .lean();
  if (!record) throw new AppError('Maintenance record not found', 404);

  // Elevated roles can view any record; the employee who reported it can
  // always view their own — otherwise reporting an issue (which an assigned
  // employee is allowed to do) would immediately 403 on its own response.
  const isOwnReport = record.reportedBy?._id?.toString() === user._id.toString();
  if (!assetAccess.canViewInventory(user.role) && !isOwnReport) {
    throw new AppError('Forbidden: insufficient permissions', 403);
  }

  return toDTO(record);
}

async function createMaintenance(organizationId, assetId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const asset = await Asset.findOne({ _id: assetId, organizationId: orgId, isDeleted: false });
  if (!asset) throw new AppError('Asset not found', 404);
  await assertCanReport(orgId, asset, user);

  if (payload.vendorId) {
    const vendor = await AssetVendor.findOne({ _id: payload.vendorId, organizationId: orgId });
    if (!vendor) throw new AppError('Vendor not found', 404);
  }

  const record = await AssetMaintenance.create({
    organizationId: orgId,
    assetId: asset._id,
    reportedBy: user._id,
    issueType: payload.issueType || 'OTHER',
    description: payload.description,
    priority: payload.priority || 'MEDIUM',
    vendorId: payload.vendorId || undefined,
    notes: payload.notes || '',
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'MAINTENANCE_CREATED', entityType: 'AssetMaintenance', entityId: record._id,
    metadata: { assetId: asset._id.toString() }, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_MAINTENANCE_CREATED, { maintenanceId: record._id.toString(), assetId: asset._id.toString() });
  await notifyItAdmins(orgId, 'ASSET_MAINTENANCE_CREATED', 'New maintenance issue reported',
    `${asset.name} (${asset.assetTag}): ${record.description}`, record._id);

  return getMaintenanceById(organizationId, record._id, user);
}

async function updateMaintenance(organizationId, id, payload, user, reqMeta = {}) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);

  const { record, assetUpdated } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const maintenance = await AssetMaintenance.findOne({ _id: id, organizationId: orgId }, null, opts);
    if (!maintenance) throw new AppError('Maintenance record not found', 404);
    if (['COMPLETED', 'CANCELLED'].includes(maintenance.status)) {
      throw new AppError(`Cannot update a ${maintenance.status.toLowerCase()} maintenance record`, 400);
    }

    const asset = await Asset.findOne({ _id: maintenance.assetId, organizationId: orgId }, null, opts);
    if (!asset) throw new AppError('Asset not found', 404);

    const previousStatus = maintenance.status;
    const editableFields = ['issueType', 'description', 'priority', 'assignedTechnicianId', 'maintenanceCost', 'vendorId', 'resolution', 'notes'];
    editableFields.forEach((field) => {
      if (payload[field] !== undefined) maintenance[field] = payload[field];
    });

    let assetChanged = false;
    if (payload.status && payload.status !== previousStatus) {
      if (!MAINTENANCE_STATUSES.includes(payload.status)) throw new AppError('Invalid maintenance status', 400);
      maintenance.status = payload.status;

      if (payload.status === 'IN_PROGRESS' && !maintenance.startedAt) {
        maintenance.startedAt = new Date();
        if (asset.status !== 'IN_MAINTENANCE') {
          asset.status = 'IN_MAINTENANCE';
          asset.updatedBy = user._id;
          await asset.save(opts);
          await AssetHistory.create([{
            organizationId: orgId, assetId: asset._id, action: 'MAINTENANCE_STARTED', performedBy: user._id,
            previousValue: { status: 'AVAILABLE' }, newValue: { status: 'IN_MAINTENANCE' }, metadata: { maintenanceId: maintenance._id.toString() },
          }], opts);
          assetChanged = true;
        }
      }

      if (payload.status === 'COMPLETED') {
        maintenance.completedAt = new Date();
        const restoredStatus = asset.assignedTo ? 'ASSIGNED' : 'AVAILABLE';
        asset.status = restoredStatus;
        asset.updatedBy = user._id;
        await asset.save(opts);
        await AssetHistory.create([{
          organizationId: orgId, assetId: asset._id, action: 'MAINTENANCE_COMPLETED', performedBy: user._id,
          previousValue: { status: 'IN_MAINTENANCE' }, newValue: { status: restoredStatus },
          metadata: { maintenanceId: maintenance._id.toString(), cost: maintenance.maintenanceCost },
        }], opts);
        assetChanged = true;
      }
    }

    await maintenance.save(opts);
    await auditLogService.recordAction({
      organizationId: orgId, userId: user._id, action: maintenance.status === 'COMPLETED' ? 'MAINTENANCE_COMPLETED' : 'MAINTENANCE_UPDATED',
      entityType: 'AssetMaintenance', entityId: maintenance._id, metadata: { from: previousStatus, to: maintenance.status }, session, ...reqMeta,
    });

    return { record: maintenance, assetUpdated: assetChanged };
  });

  const eventName = record.status === 'COMPLETED' ? SOCKET_EVENTS.ASSET_MAINTENANCE_COMPLETED : SOCKET_EVENTS.ASSET_MAINTENANCE_UPDATED;
  emitToOrg(orgId, eventName, { maintenanceId: record._id.toString(), assetId: record.assetId.toString(), status: record.status });
  if (assetUpdated) emitToOrg(orgId, SOCKET_EVENTS.ASSET_UPDATED, { assetId: record.assetId.toString() });

  if (record.status === 'COMPLETED') {
    const asset = await Asset.findById(record.assetId).select('name assetTag assignedTo').lean();
    if (asset?.assignedTo) {
      const { Employee } = require('../models');
      const employee = await Employee.findById(asset.assignedTo).select('userId').lean();
      if (employee?.userId) {
        await notifyUser(employee.userId, orgId, 'ASSET_MAINTENANCE_COMPLETED', 'Asset maintenance completed',
          `${asset.name} (${asset.assetTag}) is back and ready to use.`, record._id);
      }
    }
  }

  return getMaintenanceById(organizationId, record._id, user);
}

module.exports = { getMaintenanceForAsset, getMaintenanceList, getMaintenanceById, createMaintenance, updateMaintenance };
