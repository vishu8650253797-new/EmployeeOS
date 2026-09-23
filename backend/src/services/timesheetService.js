const { Types } = require('mongoose');
const { Timesheet, TimeEntry, Employee } = require('../models');
const { LOCKED_STATUSES } = require('../models/Timesheet');
const AppError = require('../utils/AppError');
const essAccess = require('../utils/essAccess');
const { getOrgDate, getAttendanceSettings } = require('../utils/attendanceUtils');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getUserRoom, getOrganizationRoom } = require('../socket/socketRooms');

const DEFAULTS = { page: 1, limit: 20 };
const LONG_DURATION_MINUTES = 720; // 12 hours — a single entry beyond this is worth flagging, not blocking

// ---- Pure date/period helpers (no DB, no I/O — easy to unit test) --------

// Monday of the week containing dateStr (a YYYY-MM-DD calendar string,
// already resolved into the organization's local calendar day via
// attendanceUtils.getOrgDate). Arithmetic is done on a UTC-anchored Date
// purely as a calendar calculator — no timezone conversion happens here,
// the string is already the correct local calendar date.
function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt;
}

function addDays(dt, n) {
  const copy = new Date(dt);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

function toDateStr(dt) {
  return dt.toISOString().slice(0, 10);
}

// The weekly (Monday-Sunday) period containing "today" in the org's timezone.
function getCurrentPeriodBounds(timeZone) {
  const monday = mondayOf(getOrgDate(timeZone));
  return { periodStart: toDateStr(monday), periodEnd: toDateStr(addDays(monday, 6)) };
}

// Validates and normalizes a caller-supplied period anchor date into its
// containing Monday-Sunday week. Rejects a period that hasn't started yet —
// there's nothing to prepare for a future week.
function resolvePeriodBounds(timeZone, anchorDateStr) {
  if (!anchorDateStr) return getCurrentPeriodBounds(timeZone);
  const monday = mondayOf(anchorDateStr);
  const periodStart = toDateStr(monday);
  const periodEnd = toDateStr(addDays(monday, 6));
  if (periodStart > getOrgDate(timeZone)) {
    throw new AppError('Cannot prepare a timesheet for a period that has not started yet', 400);
  }
  return { periodStart, periodEnd };
}

// ---- Validation snapshot (pure over a list of TimeEntry docs) ------------

function buildSnapshot(entries) {
  const errors = [];
  const warnings = [];

  if (entries.length === 0) {
    errors.push({ code: 'NO_ENTRIES', message: 'This period has no time entries to submit.' });
  }

  let totalMinutes = 0;
  for (const entry of entries) {
    if (entry.status === 'ACTIVE' || !entry.endTime) {
      errors.push({ code: 'MISSING_CLOCKOUT', message: `The entry starting ${new Date(entry.startTime).toLocaleString()} is missing a clock-out.` });
      continue;
    }
    if (new Date(entry.endTime) < new Date(entry.startTime)) {
      errors.push({ code: 'INVALID_TIME_RANGE', message: 'An entry has a clock-out time before its clock-in time.' });
      continue;
    }
    const duration = entry.durationMinutes ?? 0;
    if (duration < 0) {
      errors.push({ code: 'INVALID_DURATION', message: 'An entry has a negative duration.' });
      continue;
    }
    if (duration > LONG_DURATION_MINUTES) {
      warnings.push({ code: 'LONG_DURATION', message: `The entry on ${entry.entryDate} is unusually long (${Math.round(duration / 60)}+ hours).` });
    }
    if (!entry.notes) {
      warnings.push({ code: 'MISSING_NOTES', message: `The entry on ${entry.entryDate} has no notes.` });
    }
    totalMinutes += duration;
  }

  return {
    totalMinutes,
    entryCount: entries.length,
    validationErrors: errors,
    validationWarnings: warnings,
    isReadyForSubmission: errors.length === 0,
  };
}

async function getEntriesForPeriod(organizationId, employeeId, periodStart, periodEnd) {
  return TimeEntry.find({
    organizationId, employeeId, entryDate: { $gte: periodStart, $lte: periodEnd },
  }).sort({ startTime: 1 }).lean();
}

function toDTO(doc) {
  return { ...doc, id: doc._id.toString() };
}

// ---- Service functions -----------------------------------------------

// Find-or-create the DRAFT for (employee, period) and refresh its snapshot
// from live entries. Idempotent and safe to call repeatedly — this is the
// "prepare" operation, and it never overwrites a SUBMITTED timesheet.
async function prepareTimesheet(organizationId, user, payload = {}, reqMeta = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const orgId = new Types.ObjectId(organizationId);
  const { timeZone } = await getAttendanceSettings(organizationId);
  const { periodStart, periodEnd } = resolvePeriodBounds(timeZone, payload.periodStart);

  let timesheet = await Timesheet.findOne({ organizationId: orgId, employeeId: employee._id, periodStart });

  // Once submitted (or reviewed), a timesheet is a finalized declaration —
  // there is no "returned for correction" workflow in this codebase (leave
  // doesn't have one either), so re-preparing is blocked, not just re-submitting.
  if (timesheet && LOCKED_STATUSES.includes(timesheet.status)) {
    throw new AppError(`This period has already been ${timesheet.status.toLowerCase()} and can no longer be prepared`, 409);
  }

  const entries = await getEntriesForPeriod(orgId, employee._id, periodStart, periodEnd);
  const snapshot = buildSnapshot(entries);

  if (!timesheet) {
    try {
      timesheet = await Timesheet.create({
        organizationId: orgId, employeeId: employee._id, periodStart, periodEnd, timezone: timeZone,
        totalMinutes: snapshot.totalMinutes, entryCount: snapshot.entryCount,
        validationErrors: snapshot.validationErrors, validationWarnings: snapshot.validationWarnings,
        createdBy: user._id,
      });
    } catch (err) {
      // Two concurrent "prepare" calls racing to create the same period —
      // the unique index is the real guarantee; fall back to reading what
      // the other request created.
      if (err && err.code === 11000) {
        timesheet = await Timesheet.findOne({ organizationId: orgId, employeeId: employee._id, periodStart });
      } else {
        throw err;
      }
    }
  } else {
    timesheet.totalMinutes = snapshot.totalMinutes;
    timesheet.entryCount = snapshot.entryCount;
    timesheet.validationErrors = snapshot.validationErrors;
    timesheet.validationWarnings = snapshot.validationWarnings;
    timesheet.updatedBy = user._id;
    await timesheet.save();
  }

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'TIMESHEET_PREPARED', entityType: 'Timesheet', entityId: timesheet._id,
    metadata: { periodStart, periodEnd, entryCount: snapshot.entryCount }, ...reqMeta,
  });

  return { ...toDTO(timesheet.toObject()), isReadyForSubmission: snapshot.isReadyForSubmission };
}

// Re-reads and re-validates a DRAFT from live entries on every view, so the
// displayed readiness state is never stale — a SUBMITTED timesheet is
// returned as-is (its snapshot is frozen).
async function refreshIfDraft(timesheet) {
  if (timesheet.status !== 'DRAFT') {
    return { ...toDTO(timesheet), isReadyForSubmission: false };
  }
  const entries = await getEntriesForPeriod(timesheet.organizationId, timesheet.employeeId, timesheet.periodStart, timesheet.periodEnd);
  const snapshot = buildSnapshot(entries);
  return {
    ...toDTO(timesheet),
    totalMinutes: snapshot.totalMinutes,
    entryCount: snapshot.entryCount,
    validationErrors: snapshot.validationErrors,
    validationWarnings: snapshot.validationWarnings,
    isReadyForSubmission: snapshot.isReadyForSubmission,
  };
}

async function getMyTimesheets(organizationId, user, filters = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const pageNum = Math.max(parseInt(filters.page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;
  const query = { organizationId: new Types.ObjectId(organizationId), employeeId: employee._id };
  if (filters.status) query.status = filters.status;

  const [docs, total] = await Promise.all([
    Timesheet.find(query).populate('reviewedBy', 'firstName lastName').sort({ periodStart: -1 }).skip(skip).limit(limitNum).lean(),
    Timesheet.countDocuments(query),
  ]);

  return {
    data: docs.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

// The current week's period + whatever timesheet (if any) exists for it —
// `timesheet: null` tells the frontend nothing has been prepared yet.
async function getCurrentTimesheet(organizationId, user) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const { timeZone } = await getAttendanceSettings(organizationId);
  const { periodStart, periodEnd } = getCurrentPeriodBounds(timeZone);

  const timesheet = await Timesheet.findOne({
    organizationId: new Types.ObjectId(organizationId), employeeId: employee._id, periodStart,
  }).populate('reviewedBy', 'firstName lastName').lean();

  return {
    period: { periodStart, periodEnd, timezone: timeZone },
    timesheet: timesheet ? await refreshIfDraft(timesheet) : null,
  };
}

async function getMyTimesheetById(organizationId, user, id) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const timesheet = await Timesheet.findOne({
    _id: id, organizationId: new Types.ObjectId(organizationId), employeeId: employee._id,
  }).populate('reviewedBy', 'firstName lastName').lean();
  if (!timesheet) throw new AppError('Timesheet not found', 404);
  return refreshIfDraft(timesheet);
}

// The daily breakdown for a period — used by the review UI. Ownership is
// re-verified via the timesheet lookup, never trusted from the request.
async function getMyTimesheetEntries(organizationId, user, id) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const timesheet = await Timesheet.findOne({
    _id: id, organizationId: new Types.ObjectId(organizationId), employeeId: employee._id,
  }).lean();
  if (!timesheet) throw new AppError('Timesheet not found', 404);

  const entries = timesheet.status === 'SUBMITTED' && timesheet.timeEntryIds?.length
    ? await TimeEntry.find({ _id: { $in: timesheet.timeEntryIds } }).sort({ startTime: 1 }).lean()
    : await getEntriesForPeriod(timesheet.organizationId, timesheet.employeeId, timesheet.periodStart, timesheet.periodEnd);

  return entries.map((e) => ({ ...e, id: e._id.toString() }));
}

// Submit — the one function where correctness under concurrency actually
// matters (double-click, duplicate request). The status flip is an atomic
// findOneAndUpdate gated on status:'DRAFT'; if two requests race, exactly
// one succeeds and the other sees no matching document and gets a clean 409.
async function submitTimesheet(organizationId, user, id, reqMeta = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const orgId = new Types.ObjectId(organizationId);

  const timesheet = await Timesheet.findOne({ _id: id, organizationId: orgId, employeeId: employee._id });
  if (!timesheet) throw new AppError('Timesheet not found', 404);
  if (timesheet.status !== 'DRAFT') throw new AppError('This timesheet has already been submitted', 409);

  const entries = await getEntriesForPeriod(orgId, employee._id, timesheet.periodStart, timesheet.periodEnd);
  const snapshot = buildSnapshot(entries);
  if (!snapshot.isReadyForSubmission) {
    throw new AppError('This timesheet has unresolved errors and cannot be submitted', 422);
  }

  const updated = await Timesheet.findOneAndUpdate(
    { _id: id, organizationId: orgId, employeeId: employee._id, status: 'DRAFT' },
    {
      $set: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        totalMinutes: snapshot.totalMinutes,
        entryCount: snapshot.entryCount,
        validationErrors: [],
        validationWarnings: snapshot.validationWarnings,
        timeEntryIds: entries.map((e) => e._id),
        updatedBy: user._id,
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    // Lost the race to a concurrent submit — not our failure to report as one.
    throw new AppError('This timesheet has already been submitted', 409);
  }

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'TIMESHEET_SUBMITTED', entityType: 'Timesheet', entityId: updated._id,
    metadata: { periodStart: updated.periodStart, periodEnd: updated.periodEnd, totalMinutes: updated.totalMinutes }, ...reqMeta,
  });

  return { ...toDTO(updated), isReadyForSubmission: false };
}

// ---- Manager review (Step 13D) --------------------------------------

const MANAGER_SCOPED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

function emitToUser(userId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getUserRoom(userId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[timesheets] socket emit failed:', err);
  }
}

async function notifyEmployee(organizationId, employeeUserId, type, title, message, entityId) {
  if (!employeeUserId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: employeeUserId, type, title, message, entityType: 'Timesheet', entityId,
    });
  } catch (err) {
    console.error('[timesheets] notifyEmployee failed:', err);
  }
}

// A MANAGER's reach is scoped to their own direct reports — mirrors
// leaveRequestService.js's assertManagerScope/getDirectReportIds exactly,
// the established, multiply-proven pattern in this codebase (also used by
// onboarding/offboarding). SUPER_ADMIN/HR_ADMIN are unscoped.
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
  throw new AppError('You can only review timesheets for your direct reports', 403);
}

// A manager may never approve/reject their own timesheet, even as
// SUPER_ADMIN/HR_ADMIN (assertManagerScope alone wouldn't catch this for
// those unscoped roles) — mirrors assetRequestService's explicit
// self-approval guard, which leaveRequestService notably lacks.
function assertNotSelf(actor, employee) {
  if (employee.userId && employee.userId.toString() === actor._id.toString()) {
    throw new AppError('You cannot review your own timesheet', 403);
  }
}

function toManagerDTO(doc) {
  return {
    ...doc,
    id: doc._id.toString(),
    employee: doc.employeeId && typeof doc.employeeId === 'object'
      ? {
          id: doc.employeeId._id.toString(),
          firstName: doc.employeeId.firstName,
          lastName: doc.employeeId.lastName,
          employeeId: doc.employeeId.employeeId,
          jobTitle: doc.employeeId.jobTitle,
          department: doc.employeeId.departmentId?.name,
        }
      : undefined,
  };
}

async function getManagerTimesheets(organizationId, actor, filters = {}) {
  if (!MANAGER_SCOPED_ROLES.includes(actor.role)) throw new AppError('Forbidden: insufficient permissions', 403);
  const orgId = new Types.ObjectId(organizationId);
  const pageNum = Math.max(parseInt(filters.page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: orgId, status: { $ne: 'DRAFT' } };
  if (filters.status) query.status = filters.status;
  if (filters.periodStart) query.periodStart = filters.periodStart;

  const isUnscoped = ['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role);
  let reportIds = null;
  if (!isUnscoped) {
    if (!actor.employeeId) throw new AppError('Forbidden: insufficient permissions', 403);
    reportIds = await getDirectReportIds(actor.employeeId);
    query.employeeId = { $in: reportIds.map((rid) => new Types.ObjectId(rid)) };
  }

  if (filters.employeeId && Types.ObjectId.isValid(filters.employeeId)) {
    // A MANAGER filtering by employeeId must still land inside their own
    // direct-report set — this can only ever narrow results, never expand
    // access beyond what the scoping above already established.
    if (!isUnscoped && !reportIds.includes(filters.employeeId)) {
      query.employeeId = { $in: [] }; // not one of their reports — return nothing, not an error
    } else {
      query.employeeId = new Types.ObjectId(filters.employeeId);
    }
  }

  const [docs, total] = await Promise.all([
    Timesheet.find(query)
      .populate({ path: 'employeeId', select: 'firstName lastName employeeId jobTitle departmentId', populate: { path: 'departmentId', select: 'name' } })
      .sort({ submittedAt: -1 })
      .skip(skip).limit(limitNum).lean(),
    Timesheet.countDocuments(query),
  ]);

  return {
    data: docs.map(toManagerDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function loadForManager(organizationId, actor, id) {
  const orgId = new Types.ObjectId(organizationId);
  const timesheet = await Timesheet.findOne({ _id: id, organizationId: orgId })
    .populate({ path: 'employeeId', select: 'firstName lastName employeeId jobTitle departmentId userId', populate: { path: 'departmentId', select: 'name' } })
    .populate('reviewedBy', 'firstName lastName');
  if (!timesheet) throw new AppError('Timesheet not found', 404);
  await assertManagerScope(actor, timesheet.employeeId._id);
  if (timesheet.status === 'DRAFT') throw new AppError('This timesheet has not been submitted yet', 404);
  return timesheet;
}

async function getManagerTimesheetById(organizationId, actor, id) {
  const timesheet = await loadForManager(organizationId, actor, id);
  return toManagerDTO(timesheet.toObject());
}

async function getManagerTimesheetEntries(organizationId, actor, id) {
  const timesheet = await loadForManager(organizationId, actor, id);
  const entries = timesheet.timeEntryIds?.length
    ? await TimeEntry.find({ _id: { $in: timesheet.timeEntryIds } }).sort({ startTime: 1 }).lean()
    : await getEntriesForPeriod(timesheet.organizationId, timesheet.employeeId._id, timesheet.periodStart, timesheet.periodEnd);
  return entries.map((e) => ({ ...e, id: e._id.toString() }));
}

async function approveTimesheet(organizationId, actor, id, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const timesheet = await loadForManager(organizationId, actor, id);
  assertNotSelf(actor, timesheet.employeeId);
  if (timesheet.status !== 'SUBMITTED') throw new AppError(`This timesheet is already ${timesheet.status.toLowerCase()}`, 409);

  // Re-validate against exactly what was submitted (the frozen
  // timeEntryIds), not a fresh live date-range query — approval reviews the
  // declaration the employee actually made, not whatever they've clocked
  // since. Never trust the stored snapshot alone before this final gate.
  const entries = await TimeEntry.find({ _id: { $in: timesheet.timeEntryIds } }).lean();
  const snapshot = buildSnapshot(entries);
  if (!snapshot.isReadyForSubmission) {
    throw new AppError('This timesheet has validation errors and cannot be approved', 422);
  }

  const updated = await Timesheet.findOneAndUpdate(
    { _id: id, organizationId: orgId, status: 'SUBMITTED' },
    { $set: { status: 'APPROVED', reviewedBy: actor._id, reviewedAt: new Date(), rejectionReason: undefined, updatedBy: actor._id } },
    { new: true }
  ).populate('reviewedBy', 'firstName lastName').lean();

  if (!updated) throw new AppError('This timesheet is already approved or rejected', 409);

  await auditLogService.recordAction({
    organizationId: orgId, userId: actor._id, action: 'TIMESHEET_APPROVED', entityType: 'Timesheet', entityId: updated._id,
    metadata: { employeeId: timesheet.employeeId._id.toString(), periodStart: updated.periodStart, periodEnd: updated.periodEnd }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.TIMESHEET_APPROVED, { timesheetId: updated._id.toString() });
  if (timesheet.employeeId.userId) {
    emitToUser(timesheet.employeeId.userId, SOCKET_EVENTS.TIMESHEET_APPROVED, { timesheetId: updated._id.toString() });
    await notifyEmployee(orgId, timesheet.employeeId.userId, 'TIMESHEET_APPROVED', 'Timesheet approved',
      `Your timesheet for ${updated.periodStart} – ${updated.periodEnd} was approved.`, updated._id);
  }

  return toManagerDTO({ ...updated, employeeId: timesheet.employeeId });
}

async function rejectTimesheet(organizationId, actor, id, reason, reqMeta = {}) {
  if (!reason || !reason.trim()) throw new AppError('A rejection reason is required', 400);
  const orgId = new Types.ObjectId(organizationId);
  const timesheet = await loadForManager(organizationId, actor, id);
  assertNotSelf(actor, timesheet.employeeId);
  if (timesheet.status !== 'SUBMITTED') throw new AppError(`This timesheet is already ${timesheet.status.toLowerCase()}`, 409);

  const trimmedReason = reason.trim();

  const updated = await Timesheet.findOneAndUpdate(
    { _id: id, organizationId: orgId, status: 'SUBMITTED' },
    { $set: { status: 'REJECTED', reviewedBy: actor._id, reviewedAt: new Date(), rejectionReason: trimmedReason, updatedBy: actor._id } },
    { new: true }
  ).populate('reviewedBy', 'firstName lastName').lean();

  if (!updated) throw new AppError('This timesheet is already approved or rejected', 409);

  await auditLogService.recordAction({
    organizationId: orgId, userId: actor._id, action: 'TIMESHEET_REJECTED', entityType: 'Timesheet', entityId: updated._id,
    metadata: { employeeId: timesheet.employeeId._id.toString(), reason: trimmedReason }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.TIMESHEET_REJECTED, { timesheetId: updated._id.toString() });
  if (timesheet.employeeId.userId) {
    emitToUser(timesheet.employeeId.userId, SOCKET_EVENTS.TIMESHEET_REJECTED, { timesheetId: updated._id.toString() });
    await notifyEmployee(orgId, timesheet.employeeId.userId, 'TIMESHEET_REJECTED', 'Timesheet rejected',
      `Your timesheet for ${updated.periodStart} – ${updated.periodEnd} was rejected: ${trimmedReason}`, updated._id);
  }

  return toManagerDTO({ ...updated, employeeId: timesheet.employeeId });
}

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[timesheets] socket emit failed:', err);
  }
}

module.exports = {
  getCurrentPeriodBounds,
  prepareTimesheet,
  getMyTimesheets,
  getCurrentTimesheet,
  getMyTimesheetById,
  getMyTimesheetEntries,
  submitTimesheet,
  getManagerTimesheets,
  getManagerTimesheetById,
  getManagerTimesheetEntries,
  approveTimesheet,
  rejectTimesheet,
  // exported for unit testing the pure validation logic in isolation
  buildSnapshot,
  mondayOf,
};
