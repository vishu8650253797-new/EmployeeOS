const { Types } = require('mongoose');
const { TimeEntry } = require('../models');
const { TIME_ENTRY_STATUSES } = require('../models/TimeEntry');
const AppError = require('../utils/AppError');
const essAccess = require('../utils/essAccess');
const { getOrgDate, getAttendanceSettings } = require('../utils/attendanceUtils');
const auditLogService = require('./auditLogService');

const DEFAULTS = { page: 1, limit: 20 };

function toDTO(entry) {
  return { ...entry, id: entry._id.toString() };
}

async function paginate(query, page, limit) {
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    TimeEntry.find(query).sort({ startTime: -1 }).skip(skip).limit(limitNum).lean(),
    TimeEntry.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

// Start a new time entry for the authenticated employee. Ownership
// (employeeId/organizationId) is always server-resolved — never taken from
// the client — mirroring every other ESS "create" function in this codebase.
async function startEntry(organizationId, user, reqMeta = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const orgId = new Types.ObjectId(organizationId);

  const existingActive = await TimeEntry.findOne({ organizationId: orgId, employeeId: employee._id, status: 'ACTIVE' }).lean();
  if (existingActive) throw new AppError('You already have an active time entry. End it before starting a new one.', 409);

  const { timeZone } = await getAttendanceSettings(organizationId);
  const now = new Date();

  let entry;
  try {
    entry = await TimeEntry.create({
      organizationId: orgId,
      employeeId: employee._id,
      entryDate: getOrgDate(timeZone, now),
      startTime: now,
      timezone: timeZone,
      status: 'ACTIVE',
      createdBy: user._id,
    });
  } catch (err) {
    // The partial unique index is the real guarantee under concurrent
    // requests; the pre-check above just gives a friendlier message for the
    // common (non-racing) case.
    if (err && err.code === 11000) {
      throw new AppError('You already have an active time entry. End it before starting a new one.', 409);
    }
    throw err;
  }

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'TIME_ENTRY_STARTED', entityType: 'TimeEntry', entityId: entry._id, ...reqMeta,
  });

  return toDTO(entry.toObject());
}

// End the caller's own active entry, computing duration server-side.
async function endEntry(organizationId, user, id, payload = {}, reqMeta = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const orgId = new Types.ObjectId(organizationId);

  const entry = await TimeEntry.findOne({ _id: id, organizationId: orgId, employeeId: employee._id });
  if (!entry) throw new AppError('Time entry not found', 404);
  if (entry.status !== 'ACTIVE') throw new AppError('This time entry has already ended', 409);

  const endTime = new Date();
  const elapsedMinutes = Math.max(0, Math.round((endTime - entry.startTime) / 60000));

  entry.endTime = endTime;
  entry.durationMinutes = Math.max(0, elapsedMinutes - (entry.breakMinutes || 0));
  entry.status = 'COMPLETED';
  entry.updatedBy = user._id;
  if (payload.notes !== undefined) entry.notes = String(payload.notes).slice(0, 500);
  await entry.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'TIME_ENTRY_ENDED', entityType: 'TimeEntry', entityId: entry._id,
    metadata: { durationMinutes: entry.durationMinutes }, ...reqMeta,
  });

  return toDTO(entry.toObject());
}

async function getMyEntries(organizationId, user, filters = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const query = {
    organizationId: new Types.ObjectId(organizationId),
    employeeId: employee._id,
  };
  if (filters.startDate && filters.endDate) {
    query.entryDate = { $gte: filters.startDate, $lte: filters.endDate };
  }
  if (filters.status && TIME_ENTRY_STATUSES.includes(filters.status)) {
    query.status = filters.status;
  }
  return paginate(query, filters.page, filters.limit);
}

async function getMyEntryById(organizationId, user, id) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const entry = await TimeEntry.findOne({
    _id: id, organizationId: new Types.ObjectId(organizationId), employeeId: employee._id,
  }).lean();
  if (!entry) throw new AppError('Time entry not found', 404);
  return toDTO(entry);
}

module.exports = { startEntry, endEntry, getMyEntries, getMyEntryById };
