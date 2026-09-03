const { Types } = require('mongoose');
const { LeaveRequest, LeaveType, LeaveBalance, Employee, User } = require('../models');
const AppError = require('../utils/AppError');
const { countWorkingDays, hasOverlap } = require('../utils/leaveUtils');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const leaveBalanceService = require('./leaveBalanceService');
const notificationService = require('./notificationService');

const CURRENT_YEAR = new Date().getFullYear();
const ELEVATED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

function assertOwnerOrElevated(actor, employeeId) {
  if (ELEVATED_ROLES.includes(actor.role)) return;
  if (actor.employeeId && actor.employeeId.toString() === employeeId.toString()) return;
  throw new AppError('You are not authorized to access this leave request', 403);
}

async function getDirectReportIds(managerEmployeeId) {
  const reports = await Employee.find({ managerId: managerEmployeeId, isDeleted: false }).select('_id').lean();
  return reports.map((r) => r._id.toString());
}

// A MANAGER's reach is scoped to their own direct reports — unlike
// assertOwnerOrElevated, which (correctly, for read access) treats any
// MANAGER as elevated, this guards the manager-facing list/approve/reject
// actions so one manager can't approve/reject/browse another manager's team.
async function assertManagerScope(actor, employeeId) {
  if (['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role)) return;
  if (actor.role === 'MANAGER') {
    if (!actor.employeeId) throw new AppError('Forbidden: insufficient permissions', 403);
    const reportIds = await getDirectReportIds(actor.employeeId);
    if (reportIds.includes(employeeId.toString())) return;
    throw new AppError('You can only manage leave requests for your direct reports', 403);
  }
  throw new AppError('Forbidden: insufficient permissions', 403);
}

function toLeaveDTO(request, employee, leaveType, reviewer) {
  const emp = employee || {};
  const lt = leaveType || {};
  const rev = reviewer || {};
  return {
    id: request._id.toString(),
    organizationId: request.organizationId.toString(),
    employeeId: request.employeeId.toString(),
    employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown',
    employeeCode: emp.employeeId || '',
    departmentId: emp.departmentId ? emp.departmentId.toString() : null,
    leaveTypeId: request.leaveTypeId.toString(),
    leaveType: lt.name || 'Leave',
    startDate: request.startDate.toISOString().slice(0, 10),
    endDate: request.endDate.toISOString().slice(0, 10),
    numberOfDays: request.numberOfDays,
    durationType: request.durationType,
    reason: request.reason || '',
    status: request.status,
    approvalLevel: request.approvalLevel,
    submittedAt: request.submittedAt,
    reviewedAt: request.reviewedAt,
    reviewedBy: rev._id ? { id: rev._id.toString(), name: `${rev.firstName || ''} ${rev.lastName || ''}`.trim() } : null,
    rejectionReason: request.rejectionReason || '',
    cancelledAt: request.cancelledAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

async function populateRequest(request) {
  const [employee, leaveType, reviewer] = await Promise.all([
    Employee.findById(request.employeeId).lean(),
    LeaveType.findById(request.leaveTypeId).lean(),
    request.reviewedBy ? User.findById(request.reviewedBy).lean() : null,
  ]);
  return toLeaveDTO(request, employee, leaveType, reviewer);
}

// Batched counterpart of populateRequest for list endpoints — 3 $in queries
// total instead of 3 queries per request, which otherwise multiplies with
// page size (up to 100 requests/page => up to 300 queries).
async function populateRequests(requests) {
  if (requests.length === 0) return [];

  const employeeIds = [...new Set(requests.map((r) => r.employeeId.toString()))];
  const leaveTypeIds = [...new Set(requests.map((r) => r.leaveTypeId.toString()))];
  const reviewerIds = [...new Set(requests.filter((r) => r.reviewedBy).map((r) => r.reviewedBy.toString()))];

  const [employees, leaveTypes, reviewers] = await Promise.all([
    Employee.find({ _id: { $in: employeeIds } }).lean(),
    LeaveType.find({ _id: { $in: leaveTypeIds } }).lean(),
    reviewerIds.length ? User.find({ _id: { $in: reviewerIds } }).lean() : [],
  ]);

  const employeeMap = new Map(employees.map((e) => [e._id.toString(), e]));
  const leaveTypeMap = new Map(leaveTypes.map((t) => [t._id.toString(), t]));
  const reviewerMap = new Map(reviewers.map((u) => [u._id.toString(), u]));

  return requests.map((r) => toLeaveDTO(
    r,
    employeeMap.get(r.employeeId.toString()),
    leaveTypeMap.get(r.leaveTypeId.toString()),
    r.reviewedBy ? reviewerMap.get(r.reviewedBy.toString()) : null
  ));
}

async function findEmployeesToNotify(organizationId, requestEmployeeId) {
  const employee = await Employee.findById(requestEmployeeId).lean();
  if (!employee) return [];

  const recipients = [];

  // manager of the same department
  if (employee.departmentId) {
    const managers = await Employee.find({
      organizationId: new Types.ObjectId(organizationId),
      departmentId: new Types.ObjectId(employee.departmentId),
      $or: [{ role: 'MANAGER' }, { role: 'SUPER_ADMIN' }, { role: 'HR_ADMIN' }],
    }).lean();
    recipients.push(...managers);
  }

  // HR admins + super admins
  const hrUsers = await User.find({
    organizationId: new Types.ObjectId(organizationId),
    role: { $in: ['HR_ADMIN', 'SUPER_ADMIN'] },
    status: 'active',
  }).lean();
  recipients.push(...hrUsers);

  // dedupe by userId, and only include recipients with a linked user account
  const seen = new Set();
  return recipients
    .filter((r) => r.userId)
    .filter((r) => {
      const key = r.userId.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function createLeaveRequest(organizationId, payload, actor) {
  assertOwnerOrElevated(actor, payload.employeeId);

  const employee = await Employee.findById(payload.employeeId).lean();
  if (!employee || employee.organizationId.toString() !== organizationId.toString()) throw new AppError('Employee not found', 404);

  const leaveType = await LeaveType.findById(payload.leaveTypeId).lean();
  if (!leaveType || leaveType.organizationId.toString() !== organizationId.toString()) throw new AppError('Leave type not found', 404);

  const halfDay = payload.durationType === 'HALF_DAY' && leaveType.allowHalfDay;
  const numberOfDays = countWorkingDays(payload.startDate, payload.endDate, halfDay);
  if (numberOfDays <= 0) throw new AppError('Selected dates do not contain any working days', 400);

  const overlap = await hasOverlap(organizationId, payload.employeeId, payload.startDate, payload.endDate);
  if (overlap > 0) throw new AppError('Leave request overlaps with an existing request', 400);

  await leaveBalanceService.ensureBalancesForEmployee(
    organizationId,
    payload.employeeId,
    CURRENT_YEAR
  );

  const balanceQuery = {
    organizationId: new Types.ObjectId(organizationId),
    employeeId: new Types.ObjectId(payload.employeeId),
    leaveTypeId: new Types.ObjectId(payload.leaveTypeId),
    year: CURRENT_YEAR,
  };
  const required = halfDay ? numberOfDays : numberOfDays;

  // Atomically reserve the days: the `remainingDays: { $gte }` guard makes this
  // safe against concurrent submissions racing on the same balance (e.g. a
  // double-click), which a separate read-then-write could overdraw.
  const reservedBalance = await LeaveBalance.findOneAndUpdate(
    { ...balanceQuery, remainingDays: { $gte: required } },
    { $inc: { pendingDays: numberOfDays, remainingDays: -numberOfDays } },
    { new: true }
  );
  if (!reservedBalance) {
    const exists = await LeaveBalance.exists(balanceQuery);
    if (!exists) throw new AppError('Leave balance not found for this leave type', 400);
    throw new AppError('Insufficient leave balance', 400);
  }

  let request;
  try {
    request = await LeaveRequest.create({
      organizationId: new Types.ObjectId(organizationId),
      employeeId: new Types.ObjectId(payload.employeeId),
      leaveTypeId: new Types.ObjectId(payload.leaveTypeId),
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      numberOfDays,
      durationType: halfDay ? 'HALF_DAY' : 'FULL_DAY',
      reason: payload.reason || '',
      status: 'PENDING',
      approvalLevel: 'MANAGER',
      submittedAt: new Date(),
    });
  } catch (err) {
    // roll back the reservation if request creation failed
    await LeaveBalance.updateOne(balanceQuery, { $inc: { pendingDays: -numberOfDays, remainingDays: numberOfDays } });
    throw err;
  }

  const populated = await populateRequest(request);

  // notify managers / HR
  const io = getSocketInstance();
  const recipients = await findEmployeesToNotify(organizationId, payload.employeeId);
  for (const r of recipients) {
    const userId = r.userId ? r.userId.toString() : r._id.toString();
    await notificationService.createNotification({
      organizationId,
      recipientId: userId,
      type: 'LEAVE_REQUEST_SUBMITTED',
      title: 'New leave request',
      message: `${populated.employeeName} requested ${numberOfDays} ${numberOfDays === 1 ? 'day' : 'days'} of ${populated.leaveType}`,
      entityType: 'LEAVE_REQUEST',
      entityId: request._id,
    });
    if (io) {
      io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.LEAVE_REQUEST_CREATED, populated);
      io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DASHBOARD_LEAVE_UPDATED, { pendingCount: await LeaveRequest.countDocuments({ organizationId: new Types.ObjectId(organizationId), status: 'PENDING' }) });
    }
  }

  if (io && employee.userId) {
    io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.LEAVE_REQUEST_CREATED, populated);
    io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.LEAVE_BALANCE_UPDATED);
  }

  return populated;
}

async function getLeaveRequests(organizationId, filters = {}, actor) {
  const { status, employeeId, page = 1, limit = 20 } = filters;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (status && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) query.status = status;
  if (employeeId) query.employeeId = new Types.ObjectId(employeeId);

  if (actor && actor.role === 'MANAGER') {
    if (!actor.employeeId) throw new AppError('Forbidden: insufficient permissions', 403);
    const reportIds = await getDirectReportIds(actor.employeeId);
    if (employeeId) {
      if (!reportIds.includes(employeeId.toString())) {
        throw new AppError('You can only view leave requests for your direct reports', 403);
      }
    } else {
      query.employeeId = { $in: reportIds.map((id) => new Types.ObjectId(id)) };
    }
  }

  const [data, total] = await Promise.all([
    LeaveRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    LeaveRequest.countDocuments(query),
  ]);

  const populated = await populateRequests(data);
  return {
    data: populated,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getMyLeaveRequests(organizationId, employeeId, filters = {}) {
  const query = {
    organizationId: new Types.ObjectId(organizationId),
    employeeId: new Types.ObjectId(employeeId),
  };
  if (filters.status && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(filters.status)) {
    query.status = filters.status;
  }
  const data = await LeaveRequest.find(query).sort({ createdAt: -1 }).lean();
  const populated = await populateRequests(data);
  return { data: populated };
}

async function getLeaveRequestById(organizationId, id, actor) {
  const request = await LeaveRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!request) throw new AppError('Leave request not found', 404);
  assertOwnerOrElevated(actor, request.employeeId);
  return populateRequest(request);
}

async function approveLeaveRequest(organizationId, id, actor) {
  const request = await LeaveRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!request) throw new AppError('Leave request not found', 404);
  await assertManagerScope(actor, request.employeeId);
  if (request.status !== 'PENDING') throw new AppError('Only pending requests can be approved', 400);

  await LeaveBalance.updateOne(
    {
      organizationId: new Types.ObjectId(organizationId),
      employeeId: new Types.ObjectId(request.employeeId),
      leaveTypeId: new Types.ObjectId(request.leaveTypeId),
      year: CURRENT_YEAR,
    },
    { $inc: { pendingDays: -request.numberOfDays, usedDays: request.numberOfDays } }
  );

  request.status = 'APPROVED';
  request.reviewedAt = new Date();
  request.reviewedBy = actor._id;
  await request.save();

  const populated = await populateRequest(request.toObject());
  const employee = await Employee.findById(request.employeeId).lean();
  const io = getSocketInstance();
  if (io) {
    if (employee && employee.userId) {
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.LEAVE_REQUEST_APPROVED, populated);
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.LEAVE_BALANCE_UPDATED);
    }
    io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DASHBOARD_LEAVE_UPDATED, { pendingCount: await LeaveRequest.countDocuments({ organizationId: new Types.ObjectId(organizationId), status: 'PENDING' }) });
  }

  if (employee && employee.userId) {
    await notificationService.createNotification({
      organizationId,
      recipientId: employee.userId,
      type: 'LEAVE_REQUEST_APPROVED',
      title: 'Leave approved',
      message: `Your ${populated.leaveType} request from ${populated.startDate} to ${populated.endDate} was approved.`,
      entityType: 'LEAVE_REQUEST',
      entityId: request._id,
    });
  }

  return populated;
}

async function rejectLeaveRequest(organizationId, id, actor, rejectionReason) {
  const request = await LeaveRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!request) throw new AppError('Leave request not found', 404);
  await assertManagerScope(actor, request.employeeId);
  if (request.status !== 'PENDING') throw new AppError('Only pending requests can be rejected', 400);

  await LeaveBalance.updateOne(
    {
      organizationId: new Types.ObjectId(organizationId),
      employeeId: new Types.ObjectId(request.employeeId),
      leaveTypeId: new Types.ObjectId(request.leaveTypeId),
      year: CURRENT_YEAR,
    },
    { $inc: { pendingDays: -request.numberOfDays, remainingDays: request.numberOfDays } }
  );

  request.status = 'REJECTED';
  request.reviewedAt = new Date();
  request.reviewedBy = actor._id;
  request.rejectionReason = rejectionReason || '';
  await request.save();

  const populated = await populateRequest(request.toObject());
  const employee = await Employee.findById(request.employeeId).lean();
  const io = getSocketInstance();
  if (io) {
    if (employee && employee.userId) {
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.LEAVE_REQUEST_REJECTED, populated);
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.LEAVE_BALANCE_UPDATED);
    }
    io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DASHBOARD_LEAVE_UPDATED, { pendingCount: await LeaveRequest.countDocuments({ organizationId: new Types.ObjectId(organizationId), status: 'PENDING' }) });
  }

  if (employee && employee.userId) {
    await notificationService.createNotification({
      organizationId,
      recipientId: employee.userId,
      type: 'LEAVE_REQUEST_REJECTED',
      title: 'Leave rejected',
      message: `Your ${populated.leaveType} request from ${populated.startDate} to ${populated.endDate} was rejected.`,
      entityType: 'LEAVE_REQUEST',
      entityId: request._id,
    });
  }

  return populated;
}

async function cancelLeaveRequest(organizationId, id, actor) {
  const request = await LeaveRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!request) throw new AppError('Leave request not found', 404);
  assertOwnerOrElevated(actor, request.employeeId);
  if (request.status === 'CANCELLED') throw new AppError('Leave request already cancelled', 400);

  if (request.status === 'PENDING' || request.status === 'APPROVED') {
    const inc = request.status === 'PENDING'
      ? { pendingDays: -request.numberOfDays, remainingDays: request.numberOfDays }
      : { usedDays: -request.numberOfDays, remainingDays: request.numberOfDays };
    await LeaveBalance.updateOne(
      {
        organizationId: new Types.ObjectId(organizationId),
        employeeId: new Types.ObjectId(request.employeeId),
        leaveTypeId: new Types.ObjectId(request.leaveTypeId),
        year: CURRENT_YEAR,
      },
      { $inc: inc }
    );
  }

  request.status = 'CANCELLED';
  request.cancelledAt = new Date();
  request.cancelledBy = actor._id;
  await request.save();

  const populated = await populateRequest(request.toObject());
  const employee = await Employee.findById(request.employeeId).lean();
  const io = getSocketInstance();
  if (io) {
    if (employee && employee.userId) {
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.LEAVE_REQUEST_CANCELLED, populated);
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.LEAVE_BALANCE_UPDATED);
    }
    io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DASHBOARD_LEAVE_UPDATED, { pendingCount: await LeaveRequest.countDocuments({ organizationId: new Types.ObjectId(organizationId), status: 'PENDING' }) });
  }

  if (employee && employee.userId) {
    await notificationService.createNotification({
      organizationId,
      recipientId: employee.userId,
      type: 'LEAVE_REQUEST_CANCELLED',
      title: 'Leave cancelled',
      message: `Your ${populated.leaveType} request from ${populated.startDate} to ${populated.endDate} was cancelled.`,
      entityType: 'LEAVE_REQUEST',
      entityId: request._id,
    });
  }

  return populated;
}

module.exports = {
  createLeaveRequest,
  getLeaveRequests,
  getMyLeaveRequests,
  getLeaveRequestById,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  populateRequest,
  assertManagerScope,
};
