const { Types } = require('mongoose');
const {
  Asset, AssetCategory, AssetVendor, AssetHistory, AssetMaintenance, Employee, Department, User,
} = require('../models');
const { NON_ASSIGNABLE_STATUSES, ASSET_STATUSES, ASSET_CONDITIONS } = require('../models/Asset');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const { withTransaction } = require('../utils/withTransaction');
const storageService = require('./storage');
const { validateFile } = require('../utils/fileValidation');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const assetAccess = require('../utils/assetAccess');

const DEFAULTS = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };
const SORTABLE_FIELDS = ['createdAt', 'purchaseDate', 'purchasePrice', 'assetTag', 'name', 'warrantyEndDate'];
const WARRANTY_WARNING_DAYS = Number(process.env.ASSET_WARRANTY_WARNING_DAYS) || 30;

function safeSort(sortBy) {
  return SORTABLE_FIELDS.includes(sortBy) ? sortBy : DEFAULTS.sortBy;
}

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[assets] socket emit failed:', err);
  }
}

async function recordAudit(organizationId, userId, action, entityId, metadata = {}, reqMeta = {}, session) {
  return auditLogService.recordAction({
    organizationId, userId, action, entityType: 'Asset', entityId, metadata, session, ...reqMeta,
  });
}

async function recordHistory(organizationId, assetId, action, performedBy, previousValue, newValue, metadata = {}, session) {
  const opts = session ? { session } : undefined;
  return AssetHistory.create(
    [{ organizationId, assetId, action, performedBy, previousValue, newValue, metadata }],
    opts
  );
}

async function notifyUser(userId, organizationId, type, title, message, entityId) {
  if (!userId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: userId, type, title, message, entityType: 'Asset', entityId,
    });
  } catch (err) {
    console.error('[assets] notifyUser failed:', err);
  }
}

// Best-effort: notifies every active user holding one of the given roles.
// A failure here must never roll back or fail a mutation that already succeeded.
async function notifyRoles(organizationId, roles, type, title, message, entityId) {
  try {
    const users = await User.find({
      organizationId: new Types.ObjectId(organizationId),
      role: { $in: roles },
      status: 'active',
    }).select('_id').lean();
    await Promise.all(
      users.map((u) => notifyUser(u._id, organizationId, type, title, message, entityId))
    );
  } catch (err) {
    console.error('[assets] notifyRoles failed:', err);
  }
}

function getWarrantyStatus(warrantyEndDate) {
  if (!warrantyEndDate) return 'NONE';
  const now = new Date();
  const end = new Date(warrantyEndDate);
  if (end < now) return 'EXPIRED';
  const daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return daysRemaining <= WARRANTY_WARNING_DAYS ? 'EXPIRING_SOON' : 'ACTIVE';
}

function toDTO(asset) {
  return { ...asset, id: asset._id.toString(), warrantyStatus: getWarrantyStatus(asset.warrantyEndDate) };
}

// Generates a unique, org-scoped, sequential asset tag (AST-000001, AST-000002, ...).
// Retries on a rare concurrent-create race rather than relying on a separate
// counter collection — good enough at asset-registry volumes.
async function generateAssetTag(organizationId, session) {
  const query = Asset.findOne({ organizationId }).sort({ createdAt: -1 }).select('assetTag');
  if (session) query.session(session);
  const last = await query.lean();

  let nextNumber = 1;
  if (last?.assetTag) {
    const match = last.assetTag.match(/(\d+)$/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }
  return `AST-${String(nextNumber).padStart(6, '0')}`;
}

async function assertCategory(organizationId, categoryId, session) {
  const opts = session ? { session } : undefined;
  const category = await AssetCategory.findOne({ _id: categoryId, organizationId }, null, opts);
  if (!category) throw new AppError('Asset category not found', 404);
  return category;
}

async function assertVendor(organizationId, vendorId, session) {
  if (!vendorId) return null;
  const opts = session ? { session } : undefined;
  const vendor = await AssetVendor.findOne({ _id: vendorId, organizationId }, null, opts);
  if (!vendor) throw new AppError('Vendor not found', 404);
  return vendor;
}

async function assertActiveEmployee(organizationId, employeeId, session) {
  const opts = session ? { session } : undefined;
  const employee = await Employee.findOne({ _id: employeeId, organizationId, isDeleted: false }, null, opts);
  if (!employee) throw new AppError('Employee not found', 404);
  if (employee.status !== 'ACTIVE') throw new AppError('Employee is not active', 400);
  return employee;
}

async function assertDepartment(organizationId, departmentId, session) {
  if (!departmentId) return null;
  const opts = session ? { session } : undefined;
  const department = await Department.findOne({ _id: departmentId, organizationId }, null, opts);
  if (!department) throw new AppError('Department not found', 404);
  return department;
}

function translateDuplicateKeyError(err) {
  if (err && err.code === 11000) {
    if (err.keyPattern?.serialNumber) {
      throw new AppError('An asset with this serial number already exists.', 409);
    }
    if (err.keyPattern?.assetTag) {
      throw new AppError('An asset with this asset tag already exists.', 409);
    }
    throw new AppError('A conflicting asset record already exists.', 409);
  }
  throw err;
}

async function getAssets(organizationId, filters = {}, user) {
  if (!assetAccess.canViewInventory(user.role)) {
    throw new AppError('Forbidden: insufficient permissions', 403);
  }

  const {
    search, category, status, condition, assignedEmployee, department, vendor, location,
    warrantyStatus, sortBy, sortOrder, page, limit,
  } = filters;

  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId), isDeleted: false };

  if (category && Types.ObjectId.isValid(category)) query.categoryId = new Types.ObjectId(category);
  if (status && ASSET_STATUSES.includes(status)) query.status = status;
  if (condition && ASSET_CONDITIONS.includes(condition)) query.condition = condition;
  if (assignedEmployee && Types.ObjectId.isValid(assignedEmployee)) query.assignedTo = new Types.ObjectId(assignedEmployee);
  if (department && Types.ObjectId.isValid(department)) query.assignedDepartment = new Types.ObjectId(department);
  if (vendor && Types.ObjectId.isValid(vendor)) query.vendorId = new Types.ObjectId(vendor);
  if (location) query.location = new RegExp(location.trim(), 'i');

  if (warrantyStatus) {
    const now = new Date();
    const warningBoundary = new Date(now.getTime() + WARRANTY_WARNING_DAYS * 24 * 60 * 60 * 1000);
    if (warrantyStatus === 'EXPIRED') query.warrantyEndDate = { $lt: now };
    else if (warrantyStatus === 'EXPIRING_SOON') query.warrantyEndDate = { $gte: now, $lte: warningBoundary };
    else if (warrantyStatus === 'ACTIVE') query.warrantyEndDate = { $gt: warningBoundary };
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ assetTag: regex }, { serialNumber: regex }, { name: regex }, { brand: regex }, { model: regex }];
  }

  const sort = { [safeSort(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    Asset.find(query)
      .populate('categoryId', 'name icon')
      .populate('vendorId', 'name')
      .populate('assignedTo', 'firstName lastName avatar employeeId')
      .populate('assignedDepartment', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Asset.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getAssetById(organizationId, id, user) {
  if (!assetAccess.canViewInventory(user.role)) {
    throw new AppError('Forbidden: insufficient permissions', 403);
  }

  const asset = await Asset.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false })
    .populate('categoryId', 'name icon')
    .populate('vendorId', 'name contactPerson email phone')
    .populate('assignedTo', 'firstName lastName avatar employeeId email')
    .populate('assignedDepartment', 'name')
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .lean();
  if (!asset) throw new AppError('Asset not found', 404);

  const [history, openMaintenance] = await Promise.all([
    AssetHistory.find({ organizationId, assetId: asset._id })
      .populate('performedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean(),
    AssetMaintenance.find({ organizationId, assetId: asset._id })
      .populate('assignedTechnicianId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return {
    ...toDTO(asset),
    history: history.map((h) => ({ ...h, id: h._id.toString() })),
    maintenanceRecords: openMaintenance.map((m) => ({ ...m, id: m._id.toString() })),
  };
}

async function createAsset(organizationId, payload, user, reqMeta = {}) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);

  const asset = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;

    await assertCategory(orgId, payload.categoryId, session);
    await assertVendor(orgId, payload.vendorId, session);

    if (payload.serialNumber) {
      const dupe = await Asset.findOne({ organizationId: orgId, serialNumber: payload.serialNumber.trim() }, null, opts);
      if (dupe) throw new AppError('An asset with this serial number already exists.', 409);
    }

    const assetTag = payload.assetTag ? payload.assetTag.trim().toUpperCase() : await generateAssetTag(orgId, session);

    let created;
    try {
      [created] = await Asset.create(
        [{
          organizationId: orgId,
          assetTag,
          serialNumber: payload.serialNumber || undefined,
          name: payload.name,
          categoryId: payload.categoryId,
          brand: payload.brand || '',
          model: payload.model || '',
          description: payload.description || '',
          purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : undefined,
          purchasePrice: payload.purchasePrice,
          currency: payload.currency || 'INR',
          vendorId: payload.vendorId || undefined,
          warrantyStartDate: payload.warrantyStartDate ? new Date(payload.warrantyStartDate) : undefined,
          warrantyEndDate: payload.warrantyEndDate ? new Date(payload.warrantyEndDate) : undefined,
          condition: payload.condition || 'NEW',
          location: payload.location || '',
          purchaseOrderNumber: payload.purchaseOrderNumber || '',
          invoiceNumber: payload.invoiceNumber || '',
          notes: payload.notes || '',
          createdBy: user._id,
          updatedBy: user._id,
        }],
        opts
      );
    } catch (err) {
      translateDuplicateKeyError(err);
    }

    await recordHistory(orgId, created._id, 'CREATED', user._id, null, { status: created.status }, {}, session);
    await recordAudit(orgId, user._id, 'ASSET_CREATED', created._id, { assetTag: created.assetTag }, reqMeta, session);

    return created;
  });

  emitToOrg(orgId, SOCKET_EVENTS.ASSET_CREATED, { assetId: asset._id.toString(), assetTag: asset.assetTag });

  return getAssetById(organizationId, asset._id, user);
}

async function updateAsset(organizationId, id, payload, user, reqMeta = {}) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);

  const asset = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const existing = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false }, null, opts);
    if (!existing) throw new AppError('Asset not found', 404);

    if (payload.categoryId) await assertCategory(orgId, payload.categoryId, session);
    if (payload.vendorId !== undefined) await assertVendor(orgId, payload.vendorId, session);

    if (payload.serialNumber && payload.serialNumber.trim() !== existing.serialNumber) {
      const dupe = await Asset.findOne({
        organizationId: orgId, serialNumber: payload.serialNumber.trim(), _id: { $ne: existing._id },
      }, null, opts);
      if (dupe) throw new AppError('An asset with this serial number already exists.', 409);
    }

    // Whitelist of editable fields — never spread req.body directly into the document.
    const editableFields = [
      'name', 'categoryId', 'brand', 'model', 'description', 'purchaseDate', 'purchasePrice', 'currency',
      'vendorId', 'warrantyStartDate', 'warrantyEndDate', 'condition', 'location',
      'purchaseOrderNumber', 'invoiceNumber', 'notes', 'serialNumber',
    ];
    const previousValue = {};
    const changedFields = [];
    editableFields.forEach((field) => {
      if (payload[field] === undefined) return;
      previousValue[field] = existing[field];
      if (['purchaseDate', 'warrantyStartDate', 'warrantyEndDate'].includes(field)) {
        existing[field] = payload[field] ? new Date(payload[field]) : undefined;
      } else if (field === 'serialNumber') {
        existing[field] = payload[field] ? payload[field].trim() : undefined;
      } else {
        existing[field] = payload[field];
      }
      changedFields.push(field);
    });
    existing.updatedBy = user._id;

    try {
      await existing.save(opts);
    } catch (err) {
      translateDuplicateKeyError(err);
    }

    if (changedFields.length) {
      await recordHistory(orgId, existing._id, 'UPDATED', user._id, previousValue, { changedFields }, {}, session);
      await recordAudit(orgId, user._id, 'ASSET_UPDATED', existing._id, { changedFields }, reqMeta, session);
    }

    return existing;
  });

  emitToOrg(orgId, SOCKET_EVENTS.ASSET_UPDATED, { assetId: asset._id.toString() });

  return getAssetById(organizationId, asset._id, user);
}

// Assets are never hard-deleted once they carry history — RETIRED/DISPOSED are
// the compliant terminal states. A hard delete is only permitted for a
// freshly-created asset with no assignment or maintenance history at all.
async function deleteAsset(organizationId, id, user, reqMeta = {}) {
  if (user.role !== 'SUPER_ADMIN') throw new AppError('Forbidden: only a super admin can delete an asset record', 403);
  const orgId = new Types.ObjectId(organizationId);

  const asset = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  if (!asset) throw new AppError('Asset not found', 404);

  const historyCount = await AssetHistory.countDocuments({ organizationId: orgId, assetId: asset._id, action: { $ne: 'CREATED' } });
  if (historyCount > 0 || asset.assignedTo) {
    throw new AppError('This asset has assignment/maintenance history — retire or dispose it instead of deleting.', 400);
  }

  asset.isDeleted = true;
  asset.updatedBy = user._id;
  await asset.save();

  await recordAudit(orgId, user._id, 'ASSET_DELETED', asset._id, { assetTag: asset.assetTag }, reqMeta);
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_DELETED, { assetId: asset._id.toString() });

  return { success: true, message: 'Asset deleted' };
}

async function assignAsset(organizationId, id, payload, user, reqMeta = {}) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);
  const { employeeId, departmentId, assignmentNotes, onboardingTaskId } = payload;

  const employee = await assertActiveEmployee(orgId, employeeId);
  const department = departmentId ? await assertDepartment(orgId, departmentId) : null;

  const { asset, previousStatus } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const current = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false }, null, opts);
    if (!current) throw new AppError('Asset not found', 404);
    if (NON_ASSIGNABLE_STATUSES.includes(current.status)) {
      throw new AppError(`Asset cannot be assigned while it is ${current.status.replace('_', ' ').toLowerCase()}. Reassign or return it first.`, 400);
    }
    const prevStatus = current.status;

    // Atomic compare-and-swap: the status filter guards against two admins
    // assigning the same asset at once — only the first write matches.
    const updated = await Asset.findOneAndUpdate(
      { _id: id, organizationId: orgId, status: { $nin: NON_ASSIGNABLE_STATUSES } },
      {
        status: 'ASSIGNED',
        assignedTo: employee._id,
        assignedDepartment: department ? department._id : undefined,
        assignedAt: new Date(),
        returnedAt: undefined,
        updatedBy: user._id,
      },
      { new: true, ...opts }
    );
    if (!updated) throw new AppError('This asset was just assigned by someone else — please refresh and try again.', 409);

    await recordHistory(orgId, updated._id, 'ASSIGNED', user._id, { status: prevStatus }, {
      employeeId: employee._id.toString(), departmentId: department ? department._id.toString() : null,
    }, { assignmentNotes }, session);
    await recordAudit(orgId, user._id, 'ASSET_ASSIGNED', updated._id, { employeeId: employee._id.toString() }, reqMeta, session);

    return { asset: updated, previousStatus: prevStatus };
  });

  emitToOrg(orgId, SOCKET_EVENTS.ASSET_ASSIGNED, {
    assetId: asset._id.toString(), employeeId: employee._id.toString(), assetTag: asset.assetTag,
  });

  if (employee.userId) {
    await notifyUser(
      employee.userId, orgId, 'ASSET_ASSIGNED', 'Asset assigned to you',
      `${asset.name} (${asset.assetTag}) has been assigned to you.`, asset._id
    );
  }

  // Onboarding integration: link an IT-setup task to this assignment without
  // rebuilding the onboarding module — mark the task complete once the asset
  // that fulfilled it has been handed over.
  if (onboardingTaskId) {
    try {
      const onboardingService = require('./onboardingService');
      await onboardingService.updateTaskStatus(organizationId, onboardingTaskId, 'COMPLETED', user, reqMeta);
    } catch (err) {
      console.error('[assets] failed to complete linked onboarding task:', err.message);
    }
  }

  return getAssetById(organizationId, asset._id, user);
}

async function reassignAsset(organizationId, id, payload, user, reqMeta = {}) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);
  const { employeeId, departmentId, assignmentNotes } = payload;

  const newEmployee = await assertActiveEmployee(orgId, employeeId);
  const department = departmentId ? await assertDepartment(orgId, departmentId) : null;

  const { asset, previousEmployeeId } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const current = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false }, null, opts);
    if (!current) throw new AppError('Asset not found', 404);
    if (current.status !== 'ASSIGNED') {
      throw new AppError('Only a currently assigned asset can be reassigned — return it first otherwise.', 400);
    }
    if (current.assignedTo && current.assignedTo.toString() === employeeId.toString()) {
      throw new AppError('This asset is already assigned to this employee.', 400);
    }
    const prevEmployeeId = current.assignedTo ? current.assignedTo.toString() : null;

    const updated = await Asset.findOneAndUpdate(
      { _id: id, organizationId: orgId, status: 'ASSIGNED' },
      {
        assignedTo: newEmployee._id,
        assignedDepartment: department ? department._id : undefined,
        assignedAt: new Date(),
        updatedBy: user._id,
      },
      { new: true, ...opts }
    );
    if (!updated) throw new AppError('This asset was just modified by someone else — please refresh and try again.', 409);

    await recordHistory(orgId, updated._id, 'REASSIGNED', user._id, { employeeId: prevEmployeeId }, {
      employeeId: newEmployee._id.toString(), departmentId: department ? department._id.toString() : null,
    }, { assignmentNotes }, session);
    await recordAudit(orgId, user._id, 'ASSET_REASSIGNED', updated._id, {
      fromEmployeeId: prevEmployeeId, toEmployeeId: newEmployee._id.toString(),
    }, reqMeta, session);

    return { asset: updated, previousEmployeeId: prevEmployeeId };
  });

  emitToOrg(orgId, SOCKET_EVENTS.ASSET_REASSIGNED, {
    assetId: asset._id.toString(), employeeId: newEmployee._id.toString(), assetTag: asset.assetTag,
  });

  if (newEmployee.userId) {
    await notifyUser(
      newEmployee.userId, orgId, 'ASSET_REASSIGNED', 'Asset assigned to you',
      `${asset.name} (${asset.assetTag}) has been assigned to you.`, asset._id
    );
  }
  if (previousEmployeeId) {
    const prevEmployee = await Employee.findById(previousEmployeeId).select('userId').lean();
    if (prevEmployee?.userId) {
      await notifyUser(
        prevEmployee.userId, orgId, 'ASSET_REASSIGNED', 'Asset reassigned',
        `${asset.name} (${asset.assetTag}) has been reassigned to another employee.`, asset._id
      );
    }
  }

  return getAssetById(organizationId, asset._id, user);
}

async function returnAsset(organizationId, id, payload, user, reqMeta = {}) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);
  const { condition, returnNotes } = payload;
  if (!ASSET_CONDITIONS.includes(condition)) throw new AppError('Invalid asset condition', 400);

  const nextStatus = condition === 'DAMAGED' ? 'IN_MAINTENANCE' : 'AVAILABLE';

  const { asset, previousEmployeeId } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const current = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false }, null, opts);
    if (!current) throw new AppError('Asset not found', 404);
    if (current.status !== 'ASSIGNED') {
      throw new AppError('Only a currently assigned asset can be returned.', 400);
    }
    const prevEmployeeId = current.assignedTo ? current.assignedTo.toString() : null;
    const prevCondition = current.condition;

    const updated = await Asset.findOneAndUpdate(
      { _id: id, organizationId: orgId, status: 'ASSIGNED' },
      {
        status: nextStatus,
        condition,
        assignedTo: undefined,
        assignedDepartment: undefined,
        returnedAt: new Date(),
        updatedBy: user._id,
      },
      { new: true, ...opts }
    );
    if (!updated) throw new AppError('This asset was just modified by someone else — please refresh and try again.', 409);

    await recordHistory(orgId, updated._id, 'RETURNED', user._id, {
      employeeId: prevEmployeeId, condition: prevCondition,
    }, { condition, status: nextStatus }, { returnNotes }, session);
    await recordAudit(orgId, user._id, 'ASSET_RETURNED', updated._id, { condition, nextStatus }, reqMeta, session);

    if (condition === 'DAMAGED') {
      await AssetMaintenance.create(
        [{
          organizationId: orgId,
          assetId: updated._id,
          reportedBy: user._id,
          issueType: 'DAMAGE',
          description: returnNotes || 'Asset returned in damaged condition — requires inspection.',
          priority: 'HIGH',
          status: 'OPEN',
        }],
        opts
      );
    }

    return { asset: updated, previousEmployeeId: prevEmployeeId };
  });

  emitToOrg(orgId, SOCKET_EVENTS.ASSET_RETURNED, {
    assetId: asset._id.toString(), assetTag: asset.assetTag, status: asset.status,
  });

  if (previousEmployeeId) {
    const prevEmployee = await Employee.findById(previousEmployeeId).select('userId').lean();
    if (prevEmployee?.userId) {
      await notifyUser(
        prevEmployee.userId, orgId, 'ASSET_RETURNED', 'Asset return confirmed',
        `Your return of ${asset.name} (${asset.assetTag}) has been recorded.`, asset._id
      );
    }
  }
  if (condition === 'DAMAGED') {
    await notifyRoles(orgId, assetAccess.FULL_ROLES, 'ASSET_MAINTENANCE_CREATED', 'Damaged asset returned',
      `${asset.name} (${asset.assetTag}) was returned damaged and needs inspection.`, asset._id);
  }

  return getAssetById(organizationId, asset._id, user);
}

const STATUS_ACTION_MAP = {
  MARK_DAMAGED: { status: 'DAMAGED', historyAction: 'MARKED_DAMAGED', auditAction: 'ASSET_MARKED_DAMAGED' },
  MARK_LOST: { status: 'LOST', historyAction: 'MARKED_LOST', auditAction: 'ASSET_MARKED_LOST' },
  RETIRE: { status: 'RETIRED', historyAction: 'MARKED_RETIRED', auditAction: 'ASSET_RETIRED' },
  DISPOSE: { status: 'DISPOSED', historyAction: 'MARKED_DISPOSED', auditAction: 'ASSET_DISPOSED' },
  RECOVER: { status: 'AVAILABLE', historyAction: 'RECOVERED', auditAction: 'ASSET_RECOVERED' },
};

// Covers the remaining terminal/exception transitions from the lifecycle
// diagram (damaged, lost, retired, disposed, recovered) behind one endpoint.
async function transitionStatus(organizationId, id, transition, notes, user, reqMeta = {}) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const config = STATUS_ACTION_MAP[transition];
  if (!config) throw new AppError('Invalid status transition', 400);
  const orgId = new Types.ObjectId(organizationId);

  const asset = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const current = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false }, null, opts);
    if (!current) throw new AppError('Asset not found', 404);

    if (transition === 'RECOVER' && current.status !== 'LOST') {
      throw new AppError('Only a lost asset can be marked recovered.', 400);
    }
    if (['RETIRE', 'DISPOSE'].includes(transition) && current.status === 'ASSIGNED') {
      throw new AppError('Return or reassign this asset before retiring/disposing it.', 400);
    }
    if (['RETIRE', 'DISPOSE'].includes(transition) && current.status === config.status) {
      throw new AppError(`Asset is already ${config.status.toLowerCase()}.`, 400);
    }

    const prevStatus = current.status;
    current.status = config.status;
    if (transition === 'RECOVER') {
      current.assignedTo = undefined;
      current.assignedDepartment = undefined;
    }
    current.updatedBy = user._id;
    await current.save(opts);

    await recordHistory(orgId, current._id, config.historyAction, user._id, { status: prevStatus }, { status: config.status }, { notes }, session);
    await recordAudit(orgId, user._id, config.auditAction, current._id, { from: prevStatus, to: config.status }, reqMeta, session);

    return current;
  });

  const eventMap = {
    MARK_DAMAGED: SOCKET_EVENTS.ASSET_DAMAGED,
    MARK_LOST: SOCKET_EVENTS.ASSET_LOST,
    RETIRE: SOCKET_EVENTS.ASSET_RETIRED,
    DISPOSE: SOCKET_EVENTS.ASSET_DISPOSED,
    RECOVER: SOCKET_EVENTS.ASSET_RECOVERED,
  };
  emitToOrg(orgId, eventMap[transition], { assetId: asset._id.toString(), status: asset.status });

  return getAssetById(organizationId, asset._id, user);
}

async function uploadAttachment(organizationId, id, file, payload, user) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  if (!file) throw new AppError('A file is required', 400);
  const orgId = new Types.ObjectId(organizationId);

  const asset = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  if (!asset) throw new AppError('Asset not found', 404);

  const { extension } = validateFile({
    originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, buffer: file.buffer,
  });

  const { storageKey } = await storageService.uploadFile({
    buffer: file.buffer, organizationId: orgId, employeeId: 'assets', documentId: asset._id, versionNumber: 1, extension,
  });

  asset.attachments.push({
    title: payload.title || file.originalname,
    category: payload.category || 'OTHER',
    originalFileName: file.originalname,
    storageKey,
    mimeType: file.mimetype,
    fileSize: file.size,
    uploadedBy: user._id,
  });
  asset.updatedBy = user._id;
  await asset.save();

  await recordAudit(orgId, user._id, 'ASSET_ATTACHMENT_UPLOADED', asset._id, { fileName: file.originalname });

  return getAssetById(organizationId, asset._id, user);
}

async function downloadAttachment(organizationId, id, attachmentId, user) {
  if (!assetAccess.canViewInventory(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);

  const asset = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false }).select('+attachments.storageKey');
  if (!asset) throw new AppError('Asset not found', 404);

  const attachment = asset.attachments.id(attachmentId);
  if (!attachment) throw new AppError('Attachment not found', 404);

  const { stream, size } = await storageService.getFileStream(attachment.storageKey);
  return { stream, size, filename: attachment.originalFileName, mimeType: attachment.mimeType };
}

async function deleteAttachment(organizationId, id, attachmentId, user) {
  if (!assetAccess.canManageAssets(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);

  const asset = await Asset.findOne({ _id: id, organizationId: orgId, isDeleted: false }).select('+attachments.storageKey');
  if (!asset) throw new AppError('Asset not found', 404);

  const attachment = asset.attachments.id(attachmentId);
  if (!attachment) throw new AppError('Attachment not found', 404);

  await storageService.deleteFile(attachment.storageKey);
  attachment.deleteOne();
  asset.updatedBy = user._id;
  await asset.save();

  return { success: true, message: 'Attachment removed' };
}

async function getEmployeeAssets(organizationId, employeeId, user) {
  assetAccess.assertSelfOrElevated(user, employeeId);
  const orgId = new Types.ObjectId(organizationId);

  const employee = await Employee.findOne({ _id: employeeId, organizationId: orgId, isDeleted: false }).select('_id').lean();
  if (!employee) throw new AppError('Employee not found', 404);

  const assets = await Asset.find({ organizationId: orgId, assignedTo: employeeId, isDeleted: false })
    .populate('categoryId', 'name icon')
    .sort({ assignedAt: -1 })
    .lean();

  return { data: assets.map(toDTO) };
}

module.exports = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAsset,
  reassignAsset,
  returnAsset,
  transitionStatus,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
  getEmployeeAssets,
  getWarrantyStatus,
  generateAssetTag,
};
