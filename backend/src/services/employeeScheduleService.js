const { Types } = require('mongoose');
const { EmployeeSchedule, Employee, Shift, Department, LeaveRequest } = require('../models');
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

// Narrows an in-progress query.employeeId filter (undefined, a single
// ObjectId, or an {$in:[...]}) down to only ids also present in
// candidateIds — used to combine manager-scope, department, and search
// filters without any of them being able to widen another's scope.
function intersectEmployeeFilter(existing, candidateIds) {
  const candidateSet = new Set(candidateIds.map((id) => id.toString()));
  if (existing === undefined) return { $in: candidateIds };
  if (existing instanceof Types.ObjectId) {
    return candidateSet.has(existing.toString()) ? existing : { $in: [] };
  }
  return { $in: (existing.$in || []).filter((id) => candidateSet.has(id.toString())) };
}

async function getSchedules(organizationId, actor, filters = {}) {
  if (!MANAGER_SCOPED_ROLES.includes(actor.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);
  const pageNum = Math.max(parseInt(filters.page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: orgId };
  if (filters.status) query.status = filters.status;
  // Filters by effective date range — an assignment "occurs" on/overlaps a
  // given window when it starts on/before the window ends and (has no end,
  // or) ends on/after the window starts.
  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateTo) query.effectiveFrom = { $lte: new Date(filters.dateTo) };
    if (filters.dateFrom) {
      query.$and = (query.$and || []).concat([
        { $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: new Date(filters.dateFrom) } }] },
      ]);
    }
  }

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
  if (filters.shiftId && Types.ObjectId.isValid(filters.shiftId)) query.shiftId = new Types.ObjectId(filters.shiftId);

  if (filters.departmentId && Types.ObjectId.isValid(filters.departmentId)) {
    const dept = await Department.findOne({ _id: filters.departmentId, organizationId: orgId, isDeleted: false }).select('_id').lean();
    const deptEmployeeIds = dept
      ? (await Employee.find({ organizationId: orgId, departmentId: dept._id, isDeleted: false }).select('_id').lean()).map((e) => e._id)
      : [];
    query.employeeId = intersectEmployeeFilter(query.employeeId, deptEmployeeIds);
  }

  if (filters.search && filters.search.trim()) {
    // Employee name/code search — same escaped-regex-then-resolve pattern
    // already used by timesheetService.js and shiftService.js.
    const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const matches = await Employee.find({ organizationId: orgId, isDeleted: false, $or: [{ firstName: regex }, { lastName: regex }, { employeeId: regex }] }).select('_id').lean();
    query.employeeId = intersectEmployeeFilter(query.employeeId, matches.map((m) => m._id));
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

// Shared by assign/updateSchedule/validateAssignment so the three entry
// points can't drift on what counts as a valid effective date range.
function parseEffectiveDates(payload, { requireFrom = true } = {}) {
  let effectiveFrom;
  if (payload.effectiveFrom !== undefined) {
    effectiveFrom = new Date(payload.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) throw new AppError('A valid effectiveFrom date is required', 400);
  } else if (requireFrom) {
    throw new AppError('A valid effectiveFrom date is required', 400);
  }

  let effectiveTo;
  if (payload.effectiveTo) {
    effectiveTo = new Date(payload.effectiveTo);
    if (Number.isNaN(effectiveTo.getTime())) throw new AppError('Invalid effectiveTo date', 400);
    if (effectiveFrom && effectiveTo < effectiveFrom) throw new AppError('effectiveTo cannot be before effectiveFrom', 400);
  }
  return { effectiveFrom, effectiveTo };
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

  const { effectiveFrom, effectiveTo } = parseEffectiveDates(payload);
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

async function updateSchedule(organizationId, id, payload, actor, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const schedule = await EmployeeSchedule.findOne({ _id: id, organizationId: orgId });
  if (!schedule) throw new AppError('Schedule assignment not found', 404);
  await assertManagerScope(actor, schedule.employeeId);

  // Historical integrity: an assignment that has already taken effect (or
  // isn't the current ACTIVE row any more) cannot be rewritten — only a
  // still-upcoming change can. Cancelling-and-reassigning is the supported
  // path for anything already in effect, matching how assign() itself
  // never edits an existing row in place either.
  if (schedule.status !== 'ACTIVE' || schedule.effectiveFrom <= new Date()) {
    throw new AppError('Only a future assignment that has not started yet can be updated', 409);
  }

  let shift = null;
  if (payload.shiftId) {
    shift = await Shift.findOne({ _id: payload.shiftId, organizationId: orgId, isDeleted: false });
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'ACTIVE') throw new AppError('Cannot assign an inactive shift', 400);
  }

  const { effectiveFrom, effectiveTo } = parseEffectiveDates(
    { effectiveFrom: payload.effectiveFrom ?? schedule.effectiveFrom, effectiveTo: payload.effectiveTo },
    { requireFrom: true }
  );
  if (effectiveFrom <= new Date()) throw new AppError('effectiveFrom must still be in the future', 400);
  validateDaysOfWeek(payload.daysOfWeek);

  if (shift) schedule.shiftId = shift._id;
  schedule.effectiveFrom = effectiveFrom;
  if (payload.effectiveTo !== undefined) schedule.effectiveTo = effectiveTo;
  if (payload.daysOfWeek !== undefined) schedule.daysOfWeek = payload.daysOfWeek;
  if (payload.reason !== undefined) schedule.reason = payload.reason;
  schedule.updatedBy = actor._id;
  await schedule.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: actor._id, action: 'EMPLOYEE_SCHEDULE_UPDATED', entityType: 'EmployeeSchedule', entityId: schedule._id,
    metadata: { changed: Object.keys(payload) }, ...reqMeta,
  });

  return getScheduleById(organizationId, schedule._id, actor);
}

// Dry-run check the UI calls before submitting an assignment. Structural
// problems (missing/cross-org employee or shift, inactive shift, out-of-
// scope manager, bad dates) throw the same AppErrors assign() itself would
// — there's nothing "soft" about those. What this adds beyond assign()'s
// own validation is a set of non-blocking warnings about things assign()
// will do anyway (supersede the employee's current assignment) or things
// it has no way to know about on its own (an overlapping approved leave
// request) — surfaced so the user can decide before committing.
async function validateAssignment(organizationId, payload, actor) {
  const orgId = new Types.ObjectId(organizationId);

  const employee = await Employee.findOne({ _id: payload.employeeId, organizationId: orgId, isDeleted: false });
  if (!employee) throw new AppError('Employee not found', 404);
  await assertManagerScope(actor, employee._id);

  const shift = await Shift.findOne({ _id: payload.shiftId, organizationId: orgId, isDeleted: false });
  if (!shift) throw new AppError('Shift not found', 404);
  if (shift.status !== 'ACTIVE') throw new AppError('Cannot assign an inactive shift', 400);

  const { effectiveFrom, effectiveTo } = parseEffectiveDates(payload);
  validateDaysOfWeek(payload.daysOfWeek);

  const warnings = [];

  const current = await EmployeeSchedule.findOne({ organizationId: orgId, employeeId: employee._id, status: 'ACTIVE' })
    .populate('shiftId', 'name code').lean();
  if (current) {
    warnings.push({
      type: 'SUPERSEDE',
      message: `This will replace ${employee.firstName} ${employee.lastName}'s current assignment (${current.shiftId?.name || 'a shift'}, active since ${new Date(current.effectiveFrom).toISOString().slice(0, 10)}).`,
    });
  }

  // Approved-leave overlap — informational only; leave data itself is
  // never touched, matching Step 13/leave module boundaries.
  const leaveQuery = {
    organizationId: orgId, employeeId: employee._id, status: 'APPROVED',
    startDate: { $lte: effectiveTo || new Date(8640000000000000) },
  };
  leaveQuery.$or = [{ endDate: { $exists: false } }, { endDate: { $gte: effectiveFrom } }];
  const overlappingLeave = await LeaveRequest.find(leaveQuery).select('startDate endDate').limit(5).lean();
  for (const leave of overlappingLeave) {
    warnings.push({
      type: 'LEAVE_OVERLAP',
      message: `${employee.firstName} ${employee.lastName} has approved leave from ${new Date(leave.startDate).toISOString().slice(0, 10)} to ${new Date(leave.endDate).toISOString().slice(0, 10)} overlapping this assignment period.`,
    });
  }

  return { valid: true, warnings };
}

async function resolveBulkTargetEmployeeIds(organizationId, payload) {
  const orgId = new Types.ObjectId(organizationId);
  const ids = new Set((payload.employeeIds || []).filter((id) => Types.ObjectId.isValid(id)));

  if (payload.departmentId) {
    if (!Types.ObjectId.isValid(payload.departmentId)) throw new AppError('Invalid department', 400);
    const dept = await Department.findOne({ _id: payload.departmentId, organizationId: orgId, isDeleted: false }).select('_id').lean();
    if (!dept) throw new AppError('Department not found', 404);
    const deptEmployees = await Employee.find({ organizationId: orgId, departmentId: dept._id, isDeleted: false }).select('_id').lean();
    deptEmployees.forEach((e) => ids.add(e._id.toString()));
  }

  return [...ids];
}

// Bulk assignment is deliberately a thin loop over the existing, already-
// tested assign() — not a parallel implementation. Each call gets its own
// try/catch so one employee's failure (out of manager scope, inactive
// shift already caught once but re-checked per call, etc.) is reported
// individually instead of aborting or silently dropping the rest. This is
// not wrapped in a single cross-employee transaction: each assign() is
// already atomic per employee (via the partial-unique-active index), and a
// bulk request spanning many employees is expected to partially succeed —
// an all-or-nothing transaction would make one unrelated employee's
// rejection undo everyone else's successful assignment, which the "clear
// success/failure summary" requirement explicitly argues against.
async function bulkAssign(organizationId, payload, actor, reqMeta = {}) {
  if (!payload.shiftId) throw new AppError('shiftId is required', 400);
  if (!payload.effectiveFrom) throw new AppError('effectiveFrom is required', 400);
  validateDaysOfWeek(payload.daysOfWeek);

  const employeeIds = await resolveBulkTargetEmployeeIds(organizationId, payload);
  if (employeeIds.length === 0) throw new AppError('No employees to assign — provide employeeIds and/or a departmentId', 400);

  const results = [];
  for (const employeeId of employeeIds) {
    try {
      const schedule = await assign(organizationId, {
        employeeId, shiftId: payload.shiftId, effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo, daysOfWeek: payload.daysOfWeek, reason: payload.reason,
      }, actor, reqMeta);
      results.push({ employeeId, success: true, scheduleId: schedule.id });
    } catch (err) {
      results.push({ employeeId, success: false, error: err.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  await auditLogService.recordAction({
    // Scoped to the Shift being assigned, not any single EmployeeSchedule
    // row — entityId is required on AuditLog and no one row represents a
    // bulk action across many employees, so the shift is the one entity
    // genuinely common to every row in the batch.
    organizationId: new Types.ObjectId(organizationId), userId: actor._id, action: 'EMPLOYEE_SCHEDULE_BULK_ASSIGNED', entityType: 'Shift', entityId: new Types.ObjectId(payload.shiftId),
    metadata: { employeeIds: results.map((r) => r.employeeId), totalRequested: employeeIds.length, successCount, failureCount }, ...reqMeta,
  });

  return { results, successCount, failureCount };
}

// ---- ESS self-service (minimal read-only foundation) ----------------------

async function getMySchedule(organizationId, user) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const schedule = await EmployeeSchedule.findOne({
    organizationId: new Types.ObjectId(organizationId), employeeId: employee._id, status: 'ACTIVE',
  }).populate('shiftId', 'name code startTime endTime isOvernight breakMinutes scheduledMinutes').lean();

  return schedule ? toDTO(schedule) : null;
}

module.exports = {
  getSchedules, getScheduleById, assign, updateSchedule, cancel, validateAssignment, bulkAssign, getMySchedule,
};
