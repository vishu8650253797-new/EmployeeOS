const { Types } = require('mongoose');
const { Shift } = require('../models');
const AppError = require('../utils/AppError');
const auditLogService = require('./auditLogService');

const DEFAULTS = { page: 1, limit: 20 };

function toDTO(shift) {
  return { ...shift, id: shift._id.toString() };
}

async function getShifts(organizationId, filters = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const pageNum = Math.max(parseInt(filters.page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: orgId, isDeleted: false };
  if (filters.status) query.status = filters.status;

  const [data, total] = await Promise.all([
    Shift.find(query).sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
    Shift.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getShiftById(organizationId, id) {
  const shift = await Shift.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false }).lean();
  if (!shift) throw new AppError('Shift not found', 404);
  return toDTO(shift);
}

function translateDuplicateCode(err) {
  if (err && err.code === 11000) throw new AppError('A shift with this code already exists', 409);
  throw err;
}

async function createShift(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  let shift;
  try {
    shift = await Shift.create({
      organizationId: orgId,
      name: payload.name,
      code: payload.code,
      description: payload.description || '',
      startTime: payload.startTime,
      endTime: payload.endTime,
      breakMinutes: payload.breakMinutes || 0,
      createdBy: user._id,
    });
  } catch (err) {
    translateDuplicateCode(err);
  }

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'SHIFT_CREATED', entityType: 'Shift', entityId: shift._id,
    metadata: { code: shift.code }, ...reqMeta,
  });

  return toDTO(shift.toObject());
}

async function updateShift(organizationId, id, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const shift = await Shift.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  if (!shift) throw new AppError('Shift not found', 404);

  const editable = ['name', 'code', 'description', 'startTime', 'endTime', 'breakMinutes'];
  for (const field of editable) {
    if (payload[field] !== undefined) shift[field] = payload[field];
  }
  shift.updatedBy = user._id;

  try {
    await shift.save();
  } catch (err) {
    translateDuplicateCode(err);
  }

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'SHIFT_UPDATED', entityType: 'Shift', entityId: shift._id,
    metadata: { changed: Object.keys(payload) }, ...reqMeta,
  });

  return toDTO(shift.toObject());
}

async function setShiftStatus(organizationId, id, status, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const shift = await Shift.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  if (!shift) throw new AppError('Shift not found', 404);

  shift.status = status;
  shift.updatedBy = user._id;
  await shift.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: status === 'ACTIVE' ? 'SHIFT_ACTIVATED' : 'SHIFT_DEACTIVATED',
    entityType: 'Shift', entityId: shift._id, metadata: {}, ...reqMeta,
  });

  return toDTO(shift.toObject());
}

module.exports = { getShifts, getShiftById, createShift, updateShift, setShiftStatus };
