const { Types } = require('mongoose');
const { EmployeeSchedule, Employee, Shift } = require('../models');
const AppError = require('../utils/AppError');
const essAccess = require('../utils/essAccess');
const auditLogService = require('./auditLogService');

const DEFAULTS = { page: 1, limit: 20 };
const MANAGER_SCOPED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

// Deliberately a private copy, not a shared import from timesheetService.js
// or leaveRequestService.js (which each already carry their own copy too —
// that's the established, if imperfect, precedent in this codebase). This
// keeps Step 14A's blast radius to its own new files only; refactoring
// Step 13's tested manager-scope code for this module's benefit is exactly
// the kind of "unnecessary" cross-module change the spec warns against.
async function getDirectReportIds(managerEmployeeId) {
  const reports = await Employee.find({ managerId: managerEmployeeId, isDeleted: false }).select('_id').lean();
  return reports.map((r) => r._id.toString());
}

async function assertManagerScope(actor, employeeId) {
  if (!MANAGER_SCOPED_ROLES.includes(actor.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  if (['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role)) return;
  if (!actor.employeeId) throw new AppError('Forbidden: insufficient permissions', 403);
  const reportIds = await getDirectReportIds(actor.employeeId);
  if (reportIds.includes(employeeId.toString())) return;
  throw new AppError('You can only manage schedules for your direct reports', 403);
}

function toDTO(doc) {
  return { ...doc, id: doc._id.toString() };
}

async function getSchedules(organizationId, actor, filters = {}) {
  if (!MANAGER_SCOPED_ROLES.includes(actor.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);
  const pageNum = Math.max(parseInt(filters.page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: orgId };
  if (filters.status) query.status = filters.status;

  const isUnscoped = ['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role);
  if (!isUnscoped) {
    if (!actor.employeeId) throw new AppError('Forbidden: insufficient permissions', 403);
    const reportIds = await getDirectReportIds(actor.employeeId);
    query.employeeId = { $in: reportIds.map((id) => new Types.ObjectId(id)) };
  }
  if (filters.employeeId && Types.ObjectId.isValid(filters.employeeId)) {
    // Narrows an already-scoped query only — mirrors timesheetService.js's
    // identical guard against a manager escaping their own scope.
    if (!isUnscoped && !(query.employeeId?.$in || []).some((id) => id.equals(filters.employeeId))) {
      query.employeeId = { $in: [] };
    } else {
      query.employeeId = new Types.ObjectId(filters.employeeId);
    }
  }

  const [data, total] = await Promise.all([
    EmployeeSchedule.find(query)
      .populate('employeeId', 'firstName lastName employeeId jobTitle departmentId')
      .populate('shiftId', 'name code startTime endTime isOvernight')
      .sort({ effectiveFrom: -1 })
      .skip(skip).limit(limitNum).lean(),
    EmployeeSchedule.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getScheduleById(organizationId, id, actor) {
  const schedule = await EmployeeSchedule.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('employeeId', 'firstName lastName employeeId jobTitle departmentId')
    .populate('shiftId', 'name code startTime endTime isOvernight breakMinutes')
    .lean();
  if (!schedule) throw new AppError('Schedule assignment not found', 404);
  await assertManagerScope(actor, schedule.employeeId._id);
  return toDTO(schedule);
}

function validateDaysOfWeek(daysOfWeek) {
  if (daysOfWeek === undefined) return;
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
    throw new AppError('daysOfWeek must be a non-empty array', 400);
  }
  if (daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new AppError('daysOfWeek values must be integers between 0 (Sunday) and 6 (Saturday)', 400);
  }
}

async function assign(organizationId, payload, actor, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const employee = await Employee.findOne({ _id: payload.employeeId, organizationId: orgId, isDeleted: false });
  if (!employee) throw new AppError('Employee not found', 404);
  await assertManagerScope(actor, employee._id);

  // Cross-organization reference protection — the shift must belong to the
  // same organization as the employee being scheduled.
  const shift = await Shift.findOne({ _id: payload.shiftId, organizationId: orgId, isDeleted: false });
  if (!shift) throw new AppError('Shift not found', 404);
  if (shift.status !== 'ACTIVE') throw new AppError('Cannot assign an inactive shift', 400);

  const effectiveFrom = new Date(payload.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) throw new AppError('A valid effectiveFrom date is required', 400);
  let effectiveTo;
  if (payload.effectiveTo) {
    effectiveTo = new Date(payload.effectiveTo);
    if (Number.isNaN(effectiveTo.getTime())) throw new AppError('Invalid effectiveTo date', 400);
    if (effectiveTo < effectiveFrom) throw new AppError('effectiveTo cannot be before effectiveFrom', 400);
  }
  validateDaysOfWeek(payload.daysOfWeek);

  // Supersede any existing active assignment first — the partial unique
  // index is the actual, race-safe guarantee; this pre-check just gives a
  // clean sequential flow instead of relying purely on a duplicate-key catch.
  const previous = await EmployeeSchedule.findOne({ organizationId: orgId, employeeId: employee._id, status: 'ACTIVE' });
  if (previous) {
    previous.status = 'SUPERSEDED';
    previous.effectiveTo = effectiveFrom;
    previous.updatedBy = actor._id;
    await previous.save();
  }

  let schedule;
  try {
    schedule = await EmployeeSchedule.create({
      organizationId: orgId,
      employeeId: employee._id,
      shiftId: shift._id,
      daysOfWeek: payload.daysOfWeek || undefined,
      effectiveFrom,
      effectiveTo,
      reason: payload.reason || '',
      assignedBy: actor._id,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      throw new AppError('This employee already has an active schedule assignment', 409);
    }
    throw err;
  }

  await auditLogService.recordAction({
    organizationId: orgId, userId: actor._id, action: 'EMPLOYEE_SCHEDULE_ASSIGNED', entityType: 'EmployeeSchedule', entityId: schedule._id,
    metadata: { employeeId: employee._id.toString(), shiftId: shift._id.toString() }, ...reqMeta,
  });

  return getScheduleById(organizationId, schedule._id, actor);
}

async function cancel(organizationId, id, actor, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const schedule = await EmployeeSchedule.findOne({ _id: id, organizationId: orgId });
  if (!schedule) throw new AppError('Schedule assignment not found', 404);
  await assertManagerScope(actor, schedule.employeeId);
  if (schedule.status !== 'ACTIVE') throw new AppError(`This assignment is already ${schedule.status.toLowerCase()}`, 409);

  schedule.status = 'CANCELLED';
  schedule.cancelledAt = new Date();
  schedule.cancelledBy = actor._id;
  await schedule.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: actor._id, action: 'EMPLOYEE_SCHEDULE_CANCELLED', entityType: 'EmployeeSchedule', entityId: schedule._id,
    metadata: {}, ...reqMeta,
  });

  return getScheduleById(organizationId, schedule._id, actor);
}

// ---- ESS self-service (minimal read-only foundation) ----------------------

async function getMySchedule(organizationId, user) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const schedule = await EmployeeSchedule.findOne({
    organizationId: new Types.ObjectId(organizationId), employeeId: employee._id, status: 'ACTIVE',
  }).populate('shiftId', 'name code startTime endTime isOvernight breakMinutes scheduledMinutes').lean();

  return schedule ? toDTO(schedule) : null;
}

module.exports = { getSchedules, getScheduleById, assign, cancel, getMySchedule };
