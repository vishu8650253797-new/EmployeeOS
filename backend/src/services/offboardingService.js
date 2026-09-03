const { Types } = require('mongoose');
const {
  Offboarding, Employee, User, Asset, DocumentRequest, LeaveBalance,
} = require('../models');
const {
  OFFBOARDING_TYPES, CLEARANCE_DEPARTMENTS, CLEARANCE_STATUSES,
} = require('../models/Offboarding');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance, disconnectUserSockets } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const { withTransaction } = require('../utils/withTransaction');
const notificationService = require('./notificationService');
const auditLogService = require('./auditLogService');
const documentRequestService = require('./documentRequestService');
const offboardingAccess = require('../utils/offboardingAccess');

const DEFAULTS = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };
const ACTIVE_STATUSES = ['DRAFT', 'INITIATED', 'PENDING_APPROVAL', 'APPROVED', 'NOTICE_PERIOD', 'CLEARANCE_IN_PROGRESS', 'FINAL_REVIEW'];
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'];
const CLEARANCE_ROLE_MAP = { HR: 'HR_ADMIN', IT: 'IT_ADMIN', FINANCE: 'FINANCE', ADMIN: 'HR_ADMIN' };

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[offboarding] socket emit failed:', err);
  }
}

async function recordAudit(organizationId, userId, action, entityId, metadata = {}, reqMeta = {}, session) {
  return auditLogService.recordAction({
    organizationId, userId, action, entityType: 'Offboarding', entityId, metadata, session, ...reqMeta,
  });
}

// Best-effort notifications — a failure here must never roll back or fail a mutation
// that already succeeded.
async function notifyUser(userId, organizationId, type, title, message, entityId) {
  if (!userId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: userId, type, title, message, entityType: 'Offboarding', entityId,
    });
  } catch (err) {
    console.error('[offboarding] notifyUser failed:', err);
  }
}

async function notifyRoles(organizationId, roles, type, title, message, entityId) {
  try {
    const users = await User.find({
      organizationId: new Types.ObjectId(organizationId), role: { $in: roles }, status: 'active',
    }).select('_id').lean();
    await Promise.all(users.map((u) => notifyUser(u._id, organizationId, type, title, message, entityId)));
  } catch (err) {
    console.error('[offboarding] notifyRoles failed:', err);
  }
}

function safeSort(sortBy) {
  const allowed = ['createdAt', 'lastWorkingDate', 'status', 'offboardingType'];
  return allowed.includes(sortBy) ? sortBy : 'createdAt';
}

function daysBetween(a, b) {
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24)));
}

async function resolveClearanceAssignee(organizationId, department, employee) {
  if (department === 'MANAGER') {
    if (!employee.managerId) return null;
    const managerEmployee = await Employee.findById(employee.managerId).select('userId').lean();
    return managerEmployee?.userId || null;
  }
  const role = CLEARANCE_ROLE_MAP[department] || 'HR_ADMIN';
  const user = await User.findOne({ organizationId, role, status: 'active' }).sort({ createdAt: 1 }).lean();
  return user ? user._id : null;
}

function recalcClearanceStatus(offboarding) {
  const clearances = offboarding.clearances || [];
  if (clearances.length === 0) return 'NOT_STARTED';
  if (clearances.some((c) => c.status === 'REJECTED')) return 'BLOCKED';
  const relevant = clearances.filter((c) => c.status !== 'NOT_APPLICABLE');
  if (relevant.length === 0) return 'CLEARED';
  if (relevant.every((c) => c.status === 'CLEARED')) return 'CLEARED';
  if (relevant.some((c) => c.status !== 'PENDING')) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

// Evaluated against the fixed set of assets snapshotted at approval time (see the
// Offboarding.assetIds comment) — not a live "assignedTo" lookup, which would go
// empty the moment an asset is returned and be indistinguishable from "never had any".
async function computeAssetClearanceStatus(assetIds) {
  if (!assetIds || assetIds.length === 0) return 'NOT_APPLICABLE';
  const assets = await Asset.find({ _id: { $in: assetIds } }).select('status').lean();
  if (assets.length === 0) return 'NOT_APPLICABLE';
  const stillAssigned = assets.filter((a) => a.status === 'ASSIGNED');
  if (stillAssigned.length === 0) return 'CLEARED';
  if (stillAssigned.length === assets.length) return 'PENDING';
  return 'PARTIAL';
}

async function computeDocumentClearanceStatus(documentRequestIds) {
  if (!documentRequestIds || documentRequestIds.length === 0) return 'NOT_APPLICABLE';
  const requests = await DocumentRequest.find({ _id: { $in: documentRequestIds } }).select('status').lean();
  if (requests.length === 0) return 'NOT_APPLICABLE';
  const done = requests.filter((r) => r.status === 'APPROVED');
  const dead = requests.filter((r) => ['CANCELLED', 'EXPIRED'].includes(r.status));
  const relevant = requests.length - dead.length;
  if (relevant <= 0) return 'NOT_APPLICABLE';
  if (done.length >= relevant) return 'CLEARED';
  if (done.length === 0) return 'PENDING';
  return 'PARTIAL';
}

// Auto-advances the lifecycle status once the gating condition for the current
// stage is satisfied. Never moves the status backwards and never touches a
// terminal/pre-approval status.
function maybeAdvanceStatus(offboarding) {
  if (offboarding.status === 'NOTICE_PERIOD' && offboarding.clearanceStatus !== 'NOT_STARTED') {
    offboarding.status = 'CLEARANCE_IN_PROGRESS';
  }
  if (offboarding.status === 'CLEARANCE_IN_PROGRESS') {
    const clearancesDone = offboarding.clearanceStatus === 'CLEARED';
    const assetsDone = ['CLEARED', 'NOT_APPLICABLE'].includes(offboarding.assetClearanceStatus);
    const documentsDone = ['CLEARED', 'NOT_APPLICABLE'].includes(offboarding.documentClearanceStatus);
    const interviewDone = ['COMPLETED', 'WAIVED'].includes(offboarding.exitInterviewStatus);
    if (clearancesDone && assetsDone && documentsDone && interviewDone) {
      offboarding.status = 'FINAL_REVIEW';
    }
  }
}

function redactExitInterview(offboarding, user) {
  if (offboardingAccess.canViewExitInterviewDetails(offboarding, user)) return offboarding.exitInterview;
  const { status, scheduledDate, completedAt } = offboarding.exitInterview || {};
  return { status, scheduledDate, completedAt };
}

function toDTO(offboarding, user) {
  return { ...offboarding, id: offboarding._id.toString(), exitInterview: redactExitInterview(offboarding, user) };
}

async function getOffboardingDoc(organizationId, id) {
  const offboarding = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!offboarding) throw new AppError('Offboarding record not found', 404);
  return offboarding;
}

async function getById(organizationId, id, user) {
  const offboarding = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('employeeId', 'firstName lastName email avatar jobTitle departmentId managerId status')
    .populate('initiatedBy', 'firstName lastName')
    .populate('managerApproval.by', 'firstName lastName')
    .populate('hrApproval.by', 'firstName lastName')
    .populate('clearances.assignedTo', 'firstName lastName email role')
    .populate('clearances.completedBy', 'firstName lastName')
    .populate('exitInterview.interviewerId', 'firstName lastName')
    .populate('knowledgeTransfer.handoverOwnerId', 'firstName lastName')
    .populate('knowledgeTransfer.replacementEmployeeId', 'firstName lastName')
    .populate('completedBy', 'firstName lastName')
    .lean();
  if (!offboarding) throw new AppError('Offboarding record not found', 404);

  await offboardingAccess.authorizeView(offboarding, user);
  return toDTO(offboarding, user);
}

async function list(organizationId, filters = {}, user) {
  const {
    search, status, offboardingType, approvalStatus, clearanceStatus, employeeId,
    dateFrom, dateTo, sortBy, sortOrder, page, limit,
  } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  let query = { organizationId: new Types.ObjectId(organizationId) };
  if (status && Offboarding.OFFBOARDING_STATUSES.includes(status)) query.status = status;
  if (offboardingType && OFFBOARDING_TYPES.includes(offboardingType)) query.offboardingType = offboardingType;
  if (approvalStatus) query.approvalStatus = approvalStatus;
  if (clearanceStatus) query.clearanceStatus = clearanceStatus;
  if (employeeId && Types.ObjectId.isValid(employeeId)) query.employeeId = new Types.ObjectId(employeeId);
  if (dateFrom || dateTo) {
    query.lastWorkingDate = {};
    if (dateFrom) query.lastWorkingDate.$gte = new Date(dateFrom);
    if (dateTo) query.lastWorkingDate.$lte = new Date(dateTo);
  }

  query = await offboardingAccess.restrictEmployeeIdQuery(query, user);

  let employeeIdFilter = null;
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    const matches = await Employee.find({
      organizationId: new Types.ObjectId(organizationId),
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }, { employeeId: regex }],
    }).select('_id').lean();
    employeeIdFilter = matches.map((m) => m._id);
    query.$or = [{ employeeId: { $in: employeeIdFilter } }, { reason: regex }];
  }

  const sort = { [safeSort(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    Offboarding.find(query)
      .populate('employeeId', 'firstName lastName email avatar jobTitle departmentId')
      .populate('initiatedBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Offboarding.countDocuments(query),
  ]);

  return {
    data: data.map((o) => toDTO(o, user)),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getDashboardMetrics(organizationId, user) {
  let baseQuery = { organizationId: new Types.ObjectId(organizationId) };
  baseQuery = await offboardingAccess.restrictEmployeeIdQuery(baseQuery, user);

  const [
    activeOffboardings, pendingApprovals, inNoticePeriod, pendingClearances,
    pendingAssetReturns, pendingExitInterviews, pendingAccessDeactivation, completedOffboardings,
  ] = await Promise.all([
    Offboarding.countDocuments({ ...baseQuery, status: { $in: ACTIVE_STATUSES } }),
    Offboarding.countDocuments({ ...baseQuery, status: 'PENDING_APPROVAL' }),
    Offboarding.countDocuments({ ...baseQuery, status: 'NOTICE_PERIOD' }),
    Offboarding.countDocuments({ ...baseQuery, status: { $in: ACTIVE_STATUSES }, clearanceStatus: { $in: ['NOT_STARTED', 'IN_PROGRESS'] } }),
    Offboarding.countDocuments({ ...baseQuery, status: { $in: ACTIVE_STATUSES }, assetClearanceStatus: { $in: ['PENDING', 'PARTIAL'] } }),
    Offboarding.countDocuments({ ...baseQuery, status: { $in: ACTIVE_STATUSES }, exitInterviewStatus: { $in: ['NOT_SCHEDULED', 'SCHEDULED'] } }),
    Offboarding.countDocuments({ ...baseQuery, status: { $in: ACTIVE_STATUSES }, accessDeactivationStatus: { $in: ['PENDING', 'SCHEDULED'] } }),
    Offboarding.countDocuments({ ...baseQuery, status: 'COMPLETED' }),
  ]);

  return {
    activeOffboardings, pendingApprovals, inNoticePeriod, pendingClearances,
    pendingAssetReturns, pendingExitInterviews, pendingAccessDeactivation, completedOffboardings,
  };
}

async function initiate(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const employee = await Employee.findOne({ _id: payload.employeeId, organizationId: orgId, isDeleted: false });
  if (!employee) throw new AppError('Employee not found', 404);
  if (employee.status !== 'ACTIVE') throw new AppError('Employee is not active', 400);

  if (!offboardingAccess.canInitiate(user.role, payload.offboardingType)) {
    throw new AppError('Forbidden: you are not permitted to initiate this type of offboarding', 403);
  }
  if (offboardingAccess.SELF_INITIATE_TYPES.includes(payload.offboardingType) && !offboardingAccess.canAccessAll(user.role)) {
    if (!user.employeeId || user.employeeId.toString() !== employee._id.toString()) {
      throw new AppError('Forbidden: you can only initiate your own resignation', 403);
    }
  }

  const existing = await Offboarding.findOne({
    organizationId: orgId, employeeId: employee._id, status: { $in: ACTIVE_STATUSES },
  });
  if (existing) throw new AppError('An active offboarding process already exists for this employee', 409);

  const lastWorkingDate = new Date(payload.lastWorkingDate);
  if (Number.isNaN(lastWorkingDate.getTime())) throw new AppError('A valid last working date is required', 400);
  const referenceDate = payload.resignationDate ? new Date(payload.resignationDate) : new Date();
  if (lastWorkingDate < referenceDate) throw new AppError('Last working date cannot be before the resignation/reference date', 400);

  const status = payload.saveAsDraft ? 'DRAFT' : 'INITIATED';

  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const [created] = await Offboarding.create(
      [{
        organizationId: orgId,
        employeeId: employee._id,
        initiatedBy: user._id,
        offboardingType: payload.offboardingType,
        reason: payload.reason || '',
        subReason: payload.subReason || '',
        resignationDate: payload.resignationDate ? new Date(payload.resignationDate) : undefined,
        terminationDate: payload.terminationDate ? new Date(payload.terminationDate) : undefined,
        lastWorkingDate,
        noticePeriodDays: daysBetween(referenceDate, lastWorkingDate),
        status,
        remarks: payload.remarks || '',
        employeeComments: payload.employeeComments || '',
      }],
      opts
    );

    await recordAudit(organizationId, user._id, 'OFFBOARDING_CREATED', created._id, {
      employeeId: employee._id.toString(), offboardingType: created.offboardingType, status: created.status,
    }, reqMeta, session);

    return created;
  });

  emitToOrg(orgId, SOCKET_EVENTS.OFFBOARDING_CREATED, { offboardingId: offboarding._id.toString(), employeeId: employee._id.toString() });
  await notifyRoles(orgId, offboardingAccess.FULL_ROLES, 'OFFBOARDING_CREATED', 'Offboarding initiated',
    `An offboarding process (${offboarding.offboardingType.toLowerCase()}) was started for ${employee.firstName} ${employee.lastName}`, offboarding._id);

  return getById(organizationId, offboarding._id, user);
}

async function update(organizationId, id, payload, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (!offboardingAccess.canEditRecord(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
    if (!['DRAFT', 'INITIATED', 'PENDING_APPROVAL'].includes(record.status)) {
      throw new AppError(`Cannot edit an offboarding record that is already ${record.status.toLowerCase().replace('_', ' ')}`, 400);
    }

    const editable = ['reason', 'subReason', 'remarks', 'employeeComments', 'hrComments', 'managerComments'];
    editable.forEach((field) => {
      if (payload[field] !== undefined) record[field] = payload[field];
    });
    if (payload.lastWorkingDate) {
      const lastWorkingDate = new Date(payload.lastWorkingDate);
      if (Number.isNaN(lastWorkingDate.getTime())) throw new AppError('Invalid last working date', 400);
      record.lastWorkingDate = lastWorkingDate;
    }

    await record.save(opts);
    await recordAudit(organizationId, user._id, 'OFFBOARDING_UPDATED', record._id, { changed: Object.keys(payload) }, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_UPDATED, { offboardingId: offboarding._id.toString() });
  return getById(organizationId, offboarding._id, user);
}

async function submit(organizationId, id, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (!offboardingAccess.canEditRecord(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
    if (!['DRAFT', 'INITIATED'].includes(record.status)) {
      throw new AppError(`Cannot submit a record that is already ${record.status.toLowerCase().replace('_', ' ')}`, 400);
    }

    const employee = await Employee.findById(record.employeeId, null, opts).select('managerId').lean();
    record.managerApproval.required = Boolean(employee?.managerId);
    if (!record.managerApproval.required) record.managerApproval.status = 'SKIPPED';
    record.status = 'PENDING_APPROVAL';
    await record.save(opts);

    await recordAudit(organizationId, user._id, 'OFFBOARDING_SUBMITTED', record._id, {}, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_UPDATED, { offboardingId: offboarding._id.toString(), status: offboarding.status });
  await notifyRoles(organizationId, offboardingAccess.FULL_ROLES, 'OFFBOARDING_APPROVAL_REQUIRED', 'Offboarding approval required',
    'An offboarding request is awaiting approval', offboarding._id);

  return getById(organizationId, offboarding._id, user);
}

async function createDefaultClearances(organizationId, employee) {
  const clearances = [];
  for (const department of CLEARANCE_DEPARTMENTS) {
    const assignedTo = await resolveClearanceAssignee(organizationId, department, employee);
    clearances.push({
      department,
      assignedTo: assignedTo || undefined,
      status: department === 'MANAGER' && !assignedTo ? 'NOT_APPLICABLE' : 'PENDING',
      dueDate: undefined,
    });
  }
  return clearances;
}

async function approve(organizationId, id, level, payload = {}, user, reqMeta = {}) {
  if (!['MANAGER', 'HR'].includes(level)) throw new AppError('Invalid approval level', 400);

  const { offboarding, employee } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (record.status !== 'PENDING_APPROVAL') throw new AppError(`Cannot approve a record that is ${record.status.toLowerCase().replace('_', ' ')}`, 400);

    const emp = await Employee.findById(record.employeeId, null, opts);
    if (!emp) throw new AppError('Employee not found', 404);

    if (level === 'MANAGER') {
      const isEmployeeManager = user.role === 'MANAGER' && user.employeeId && emp.managerId && emp.managerId.toString() === user.employeeId.toString();
      if (!offboardingAccess.canAccessAll(user.role) && !isEmployeeManager) {
        throw new AppError('Forbidden: only the employee\'s manager or HR can give manager approval', 403);
      }
      if (!record.managerApproval.required) throw new AppError('Manager approval is not required for this record', 400);
      if (record.managerApproval.status === 'APPROVED') throw new AppError('Manager approval has already been recorded', 400);
      record.managerApproval.status = 'APPROVED';
      record.managerApproval.by = user._id;
      record.managerApproval.at = new Date();
      record.managerApproval.comments = payload.comments || '';
      if (record.approvalStatus === 'PENDING') record.approvalStatus = 'MANAGER_APPROVED';
    } else {
      if (!offboardingAccess.canAccessAll(user.role)) throw new AppError('Forbidden: only HR can give HR approval', 403);
      if (record.managerApproval.required && record.managerApproval.status !== 'APPROVED') {
        throw new AppError('Manager approval is still pending', 400);
      }
      if (record.hrApproval.status === 'APPROVED') throw new AppError('HR approval has already been recorded', 400);
      record.hrApproval.status = 'APPROVED';
      record.hrApproval.by = user._id;
      record.hrApproval.at = new Date();
      record.hrApproval.comments = payload.comments || '';
      record.approvalStatus = 'APPROVED';

      // Approval finalized — start the notice period and set up department clearances
      // in the same step (there is no separate user action for "start notice period").
      record.noticePeriodStartDate = new Date();
      record.noticePeriodEndDate = record.lastWorkingDate;
      record.noticePeriodDays = daysBetween(record.noticePeriodStartDate, record.noticePeriodEndDate);
      record.clearances = await createDefaultClearances(organizationId, emp);
      record.clearanceStatus = recalcClearanceStatus(record);

      const assignedAssets = await Asset.find({
        organizationId: new Types.ObjectId(organizationId), assignedTo: emp._id, isDeleted: false,
      }, null, opts).select('_id').lean();
      record.assetIds = assignedAssets.map((a) => a._id);
      record.assetClearanceStatus = await computeAssetClearanceStatus(record.assetIds);
      record.status = 'NOTICE_PERIOD';
    }

    await record.save(opts);
    await recordAudit(organizationId, user._id, level === 'MANAGER' ? 'OFFBOARDING_MANAGER_APPROVED' : 'OFFBOARDING_APPROVED',
      record._id, { level }, reqMeta, session);

    return { offboarding: record, employee: emp };
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_APPROVED, { offboardingId: offboarding._id.toString(), level, status: offboarding.status });

  if (employee.userId) {
    await notifyUser(employee.userId, organizationId,
      level === 'HR' ? 'OFFBOARDING_APPROVED' : 'OFFBOARDING_MANAGER_APPROVED',
      level === 'HR' ? 'Offboarding approved' : 'Manager approval recorded',
      level === 'HR' ? 'Your offboarding request has been fully approved. Your notice period has started.' : 'Your manager has approved your offboarding request.',
      offboarding._id);
  }
  if (level === 'MANAGER') {
    await notifyRoles(organizationId, offboardingAccess.FULL_ROLES, 'OFFBOARDING_APPROVAL_REQUIRED', 'HR approval required',
      'Manager approval is complete — HR approval is now required to proceed.', offboarding._id);
  }

  return getById(organizationId, offboarding._id, user);
}

async function reject(organizationId, id, level, reason, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (record.status !== 'PENDING_APPROVAL') throw new AppError(`Cannot reject a record that is ${record.status.toLowerCase().replace('_', ' ')}`, 400);

    const emp = await Employee.findById(record.employeeId, null, opts).select('managerId').lean();
    const isEmployeeManager = user.role === 'MANAGER' && user.employeeId && emp?.managerId && emp.managerId.toString() === user.employeeId.toString();
    if (!offboardingAccess.canAccessAll(user.role) && !isEmployeeManager) {
      throw new AppError('Forbidden: insufficient permissions', 403);
    }

    const step = level === 'MANAGER' ? record.managerApproval : record.hrApproval;
    step.status = 'REJECTED';
    step.by = user._id;
    step.at = new Date();
    step.comments = reason || '';

    record.approvalStatus = 'REJECTED';
    record.status = 'REJECTED';
    record.rejectedAt = new Date();
    record.rejectedBy = user._id;
    record.rejectionReason = reason || '';
    await record.save(opts);

    await recordAudit(organizationId, user._id, 'OFFBOARDING_REJECTED', record._id, { level, reason }, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_REJECTED, { offboardingId: offboarding._id.toString(), reason });

  const employee = await Employee.findById(offboarding.employeeId).select('userId').lean();
  if (employee?.userId) {
    await notifyUser(employee.userId, organizationId, 'OFFBOARDING_REJECTED', 'Offboarding request rejected',
      reason || 'Your offboarding request was rejected.', offboarding._id);
  }

  return getById(organizationId, offboarding._id, user);
}

async function cancel(organizationId, id, reason, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (!offboardingAccess.canEditRecord(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
    if (TERMINAL_STATUSES.includes(record.status)) throw new AppError(`Record is already ${record.status.toLowerCase()}`, 400);

    record.status = 'CANCELLED';
    record.cancelledAt = new Date();
    record.cancelledBy = user._id;
    record.cancellationReason = reason || '';
    await record.save(opts);

    await recordAudit(organizationId, user._id, 'OFFBOARDING_CANCELLED', record._id, { reason }, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_CANCELLED, { offboardingId: offboarding._id.toString(), reason });
  return getById(organizationId, offboarding._id, user);
}

async function getTimeline(organizationId, id, user) {
  const offboarding = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!offboarding) throw new AppError('Offboarding record not found', 404);
  await offboardingAccess.authorizeView(offboarding, user);

  const logs = await auditLogService.getEntityHistory(organizationId, 'Offboarding', offboarding._id);
  return logs;
}

async function updateClearance(organizationId, id, clearanceId, payload, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (!['NOTICE_PERIOD', 'CLEARANCE_IN_PROGRESS'].includes(record.status)) {
      throw new AppError('Clearances can only be updated once the offboarding has been approved', 400);
    }

    const clearance = record.clearances.id(clearanceId);
    if (!clearance) throw new AppError('Clearance item not found', 404);
    await offboardingAccess.canEditClearance(clearance, user);

    if (payload.status !== undefined) {
      if (!CLEARANCE_STATUSES.includes(payload.status)) throw new AppError('Invalid clearance status', 400);
      clearance.status = payload.status;
      if (['CLEARED', 'NOT_APPLICABLE'].includes(payload.status)) {
        clearance.completedAt = new Date();
        clearance.completedBy = user._id;
      } else {
        clearance.completedAt = undefined;
        clearance.completedBy = undefined;
      }
    }
    if (payload.comments !== undefined) clearance.comments = payload.comments;
    if (payload.dueDate !== undefined) clearance.dueDate = payload.dueDate ? new Date(payload.dueDate) : undefined;

    record.clearanceStatus = recalcClearanceStatus(record);
    maybeAdvanceStatus(record);
    await record.save(opts);

    await recordAudit(organizationId, user._id, 'CLEARANCE_UPDATED', record._id,
      { clearanceId, department: clearance.department, status: clearance.status }, reqMeta, session);

    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_CLEARANCE_UPDATED, { offboardingId: offboarding._id.toString(), status: offboarding.status });

  if (offboarding.status === 'FINAL_REVIEW') {
    await notifyRoles(organizationId, offboardingAccess.FULL_ROLES, 'OFFBOARDING_FINAL_REVIEW', 'Offboarding ready for final review',
      'All clearances are complete — this offboarding is ready for final review.', offboarding._id);
  }

  return getById(organizationId, offboarding._id, user);
}

async function getEmployeeAssets(organizationId, id, user) {
  const offboarding = await getOffboardingDoc(organizationId, id);
  await offboardingAccess.authorizeView(offboarding, user);

  // Delegate to the existing Step 10C asset service — offboarding never
  // duplicates asset storage or return logic, only reads/reacts to it.
  const assetService = require('./assetService');
  return assetService.getEmployeeAssets(organizationId, offboarding.employeeId, user);
}

async function refreshAssetClearance(organizationId, id, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    await offboardingAccess.authorizeView(record, user);

    record.assetClearanceStatus = await computeAssetClearanceStatus(record.assetIds);
    maybeAdvanceStatus(record);
    await record.save(opts);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_ASSET_CLEARANCE_UPDATED, {
    offboardingId: offboarding._id.toString(), assetClearanceStatus: offboarding.assetClearanceStatus,
  });
  return getById(organizationId, offboarding._id, user);
}

async function scheduleExitInterview(organizationId, id, payload, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (!offboardingAccess.canEditRecord(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
    if (TERMINAL_STATUSES.includes(record.status)) throw new AppError('Cannot schedule an exit interview on a closed record', 400);

    record.exitInterview.status = 'SCHEDULED';
    record.exitInterview.scheduledDate = payload.scheduledDate ? new Date(payload.scheduledDate) : undefined;
    record.exitInterview.interviewerId = payload.interviewerId || user._id;
    record.exitInterviewStatus = 'SCHEDULED';
    await record.save(opts);

    await recordAudit(organizationId, user._id, 'EXIT_INTERVIEW_CREATED', record._id, { scheduledDate: payload.scheduledDate }, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_EXIT_INTERVIEW_UPDATED, { offboardingId: offboarding._id.toString(), status: 'SCHEDULED' });

  const employee = await Employee.findById(offboarding.employeeId).select('userId').lean();
  if (employee?.userId) {
    await notifyUser(employee.userId, organizationId, 'EXIT_INTERVIEW_SCHEDULED', 'Exit interview scheduled',
      'Your exit interview has been scheduled.', offboarding._id);
  }
  if (offboarding.exitInterview.interviewerId) {
    await notifyUser(offboarding.exitInterview.interviewerId, organizationId, 'EXIT_INTERVIEW_SCHEDULED', 'Exit interview assigned to you',
      'You have been assigned to conduct an exit interview.', offboarding._id);
  }

  return getById(organizationId, offboarding._id, user);
}

const EXIT_INTERVIEW_FIELDS = [
  'reasonForLeaving', 'feedback', 'suggestions', 'satisfactionRating',
  'managementFeedback', 'workplaceFeedback', 'rehireEligible', 'interviewerNotes',
];

async function updateExitInterview(organizationId, id, payload, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);

    if (payload.action === 'WAIVE') {
      if (!offboardingAccess.canAccessAll(user.role)) throw new AppError('Forbidden: only HR can waive an exit interview', 403);
      record.exitInterview.status = 'WAIVED';
      record.exitInterviewStatus = 'WAIVED';
    } else {
      offboardingAccess.canManageExitInterview(record, user);
      EXIT_INTERVIEW_FIELDS.forEach((field) => {
        if (payload[field] !== undefined) record.exitInterview[field] = payload[field];
      });
      if (payload.action === 'COMPLETE') {
        record.exitInterview.status = 'COMPLETED';
        record.exitInterview.completedAt = new Date();
        record.exitInterview.completedBy = user._id;
        record.exitInterviewStatus = 'COMPLETED';
      }
    }

    maybeAdvanceStatus(record);
    await record.save(opts);
    await recordAudit(organizationId, user._id, 'EXIT_INTERVIEW_UPDATED', record._id, { action: payload.action }, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_EXIT_INTERVIEW_UPDATED, {
    offboardingId: offboarding._id.toString(), status: offboarding.exitInterviewStatus,
  });
  return getById(organizationId, offboarding._id, user);
}

const KT_FIELDS = ['handoverOwnerId', 'replacementEmployeeId', 'projects', 'responsibilities', 'documentationLinks', 'pendingTasks', 'comments', 'status'];

async function updateKnowledgeTransfer(organizationId, id, payload, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);

    const isAssignedManager =
      record.knowledgeTransfer.handoverOwnerId && record.knowledgeTransfer.handoverOwnerId.toString() === user._id.toString();
    if (!offboardingAccess.canEditRecord(user.role) && user.role !== 'MANAGER' && !isAssignedManager) {
      throw new AppError('Forbidden: insufficient permissions', 403);
    }

    KT_FIELDS.forEach((field) => {
      if (payload[field] !== undefined) record.knowledgeTransfer[field] = payload[field];
    });
    if (payload.status === 'COMPLETED') record.knowledgeTransfer.completedAt = new Date();
    record.knowledgeTransferStatus = record.knowledgeTransfer.status;

    await record.save(opts);
    await recordAudit(organizationId, user._id, 'KNOWLEDGE_TRANSFER_UPDATED', record._id, { status: record.knowledgeTransferStatus }, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_KNOWLEDGE_TRANSFER_UPDATED, {
    offboardingId: offboarding._id.toString(), status: offboarding.knowledgeTransferStatus,
  });
  return getById(organizationId, offboarding._id, user);
}

const ACCESS_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];

async function requestAccessDeactivation(organizationId, id, payload, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (!ACCESS_ROLES.includes(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);

    record.accessDeactivation.requestedDate = new Date();
    if (payload.scheduledDate) {
      record.accessDeactivation.scheduledDate = new Date(payload.scheduledDate);
      record.accessDeactivation.status = 'SCHEDULED';
    } else {
      record.accessDeactivation.status = 'PENDING';
    }
    if (payload.comments !== undefined) record.accessDeactivation.comments = payload.comments;
    record.accessDeactivationStatus = record.accessDeactivation.status;

    await record.save(opts);
    await recordAudit(organizationId, user._id, 'ACCESS_DEACTIVATION_REQUESTED', record._id, { scheduledDate: payload.scheduledDate }, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_ACCESS_UPDATED, { offboardingId: offboarding._id.toString(), status: offboarding.accessDeactivationStatus });
  return getById(organizationId, offboarding._id, user);
}

async function updateAccessDeactivation(organizationId, id, payload, user, reqMeta = {}) {
  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);
    if (!ACCESS_ROLES.includes(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);
    if (!payload.status || !['SCHEDULED', 'DEACTIVATED', 'FAILED', 'NOT_REQUIRED'].includes(payload.status)) {
      throw new AppError('Invalid access deactivation status', 400);
    }

    record.accessDeactivation.status = payload.status;
    if (payload.comments !== undefined) record.accessDeactivation.comments = payload.comments;
    if (payload.status === 'DEACTIVATED') {
      record.accessDeactivation.completedDate = new Date();
      record.accessDeactivation.completedBy = user._id;
    }
    record.accessDeactivationStatus = payload.status;

    await record.save(opts);
    await recordAudit(organizationId, user._id, 'ACCESS_DEACTIVATED', record._id, { status: payload.status }, reqMeta, session);
    return record;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_ACCESS_UPDATED, { offboardingId: offboarding._id.toString(), status: offboarding.accessDeactivationStatus });
  return getById(organizationId, offboarding._id, user);
}

async function getSettlementPreparation(organizationId, id, user) {
  const offboarding = await getOffboardingDoc(organizationId, id);
  if (!offboardingAccess.canAccessAll(user.role) && user.role !== 'FINANCE') {
    throw new AppError('Forbidden: settlement preparation is only visible to HR and Finance', 403);
  }

  const leaveBalances = await LeaveBalance.find({ organizationId, employeeId: offboarding.employeeId })
    .populate('leaveTypeId', 'name')
    .lean();

  const isReady =
    offboarding.clearanceStatus === 'CLEARED' &&
    ['CLEARED', 'NOT_APPLICABLE'].includes(offboarding.assetClearanceStatus) &&
    ['CLEARED', 'NOT_APPLICABLE'].includes(offboarding.documentClearanceStatus);

  offboarding.finalSettlement = {
    ...offboarding.finalSettlement,
    status: isReady ? 'READY' : 'NOT_READY',
    leaveBalanceReference: leaveBalances.map((b) => ({
      leaveType: b.leaveTypeId?.name || 'Unknown', remainingDays: b.remainingDays, year: b.year,
    })),
    pendingDeductionsReference: {
      damagedOrLostAssets: offboarding.assetClearanceStatus !== 'CLEARED' && offboarding.assetClearanceStatus !== 'NOT_APPLICABLE',
    },
    preparedAt: new Date(),
    preparedBy: user._id,
  };
  offboarding.finalSettlementStatus = offboarding.finalSettlement.status;
  await offboarding.save();

  return {
    lastWorkingDate: offboarding.lastWorkingDate,
    noticePeriodStatus: offboarding.status,
    assetClearanceStatus: offboarding.assetClearanceStatus,
    documentClearanceStatus: offboarding.documentClearanceStatus,
    clearanceStatus: offboarding.clearanceStatus,
    ...offboarding.finalSettlement.toObject(),
  };
}

async function requestDocument(organizationId, id, payload, user, reqMeta = {}) {
  const record = await getOffboardingDoc(organizationId, id);
  if (!offboardingAccess.canEditRecord(user.role)) throw new AppError('Forbidden: insufficient permissions', 403);

  const request = await documentRequestService.createRequest(organizationId, {
    employeeId: record.employeeId.toString(),
    categoryId: payload.categoryId,
    title: payload.title,
    description: payload.description,
    priority: payload.priority,
    dueDate: payload.dueDate,
  }, user);

  record.documentRequestIds.push(request.id);
  record.documentClearanceStatus = await computeDocumentClearanceStatus(record.documentRequestIds);
  maybeAdvanceStatus(record);
  await record.save();

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_UPDATED, { offboardingId: record._id.toString() });
  return getById(organizationId, record._id, user);
}

async function getDocuments(organizationId, id, user) {
  const offboarding = await getOffboardingDoc(organizationId, id);
  await offboardingAccess.authorizeView(offboarding.toObject(), user);

  if (!offboarding.documentRequestIds.length) return { data: [] };
  const requests = await DocumentRequest.find({ _id: { $in: offboarding.documentRequestIds } })
    .populate('categoryId', 'name')
    .populate('reviewedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .lean();
  return { data: requests.map((r) => ({ ...r, id: r._id.toString() })) };
}

async function complete(organizationId, id, user, reqMeta = {}) {
  if (!offboardingAccess.canAccessAll(user.role)) throw new AppError('Forbidden: only HR can complete an offboarding', 403);

  const offboarding = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await Offboarding.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!record) throw new AppError('Offboarding record not found', 404);

    if (record.status !== 'FINAL_REVIEW') {
      throw new AppError('This offboarding is not yet ready for completion — all clearances, asset returns, documents and the exit interview must be finished first', 400);
    }
    if (!['DEACTIVATED', 'NOT_REQUIRED'].includes(record.accessDeactivationStatus)) {
      throw new AppError('System access must be deactivated (or marked not required) before completion', 400);
    }

    record.status = 'COMPLETED';
    record.completedAt = new Date();
    record.completedBy = user._id;
    await record.save(opts);

    await Employee.updateOne(
      { _id: record.employeeId, organizationId: new Types.ObjectId(organizationId) },
      { status: 'INACTIVE' },
      opts
    );

    await recordAudit(organizationId, user._id, 'OFFBOARDING_COMPLETED', record._id, { employeeId: record.employeeId.toString() }, reqMeta, session);
    return record;
  });

  const completedEmployee = await Employee.findById(offboarding.employeeId).select('userId').lean();
  if (completedEmployee?.userId) {
    disconnectUserSockets(completedEmployee.userId, 'Your account has been deactivated.');
  }

  emitToOrg(organizationId, SOCKET_EVENTS.OFFBOARDING_COMPLETED, { offboardingId: offboarding._id.toString(), employeeId: offboarding.employeeId.toString() });
  await notifyRoles(organizationId, offboardingAccess.FULL_ROLES, 'OFFBOARDING_COMPLETED', 'Offboarding completed',
    'An offboarding process has been completed.', offboarding._id);

  return getById(organizationId, offboarding._id, user);
}

module.exports = {
  list,
  getDashboardMetrics,
  getById,
  initiate,
  update,
  submit,
  approve,
  reject,
  cancel,
  getTimeline,
  updateClearance,
  getEmployeeAssets,
  refreshAssetClearance,
  scheduleExitInterview,
  updateExitInterview,
  updateKnowledgeTransfer,
  requestAccessDeactivation,
  updateAccessDeactivation,
  getSettlementPreparation,
  requestDocument,
  getDocuments,
  complete,
};
