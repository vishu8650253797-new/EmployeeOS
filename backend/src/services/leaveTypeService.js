const { Types } = require('mongoose');
const { LeaveType } = require('../models');
const AppError = require('../utils/AppError');

const DEFAULTS = { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' };

function safeSort(sortBy) {
  const allowed = ['createdAt', 'name', 'code'];
  return allowed.includes(sortBy) ? sortBy : 'createdAt';
}

async function getLeaveTypes(organizationId, filters = {}) {
  const { search, status, sortBy, sortOrder, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) query.status = status;
  if (search && search.trim()) {
    const q = new RegExp(search.trim(), 'i');
    query.$or = [{ name: q }, { code: q }, { description: q }];
  }

  const sort = { [safeSort(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    LeaveType.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
    LeaveType.countDocuments(query),
  ]);

  const items = data.map((i) => ({ ...i, id: i._id.toString() }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getLeaveTypeById(organizationId, id) {
  const item = await LeaveType.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!item) throw new AppError('Leave type not found', 404);
  return { ...item, id: item._id.toString() };
}

async function createLeaveType(organizationId, payload) {
  const item = await LeaveType.create({
    organizationId: new Types.ObjectId(organizationId),
    name: payload.name,
    code: payload.code.toUpperCase(),
    description: payload.description || '',
    totalDays: payload.totalDays || 0,
    isPaid: payload.isPaid !== false,
    requiresApproval: payload.requiresApproval !== false,
    allowHalfDay: payload.allowHalfDay === true,
    allowCarryForward: payload.allowCarryForward === true,
    maxCarryForwardDays: payload.maxCarryForwardDays || 0,
    status: payload.status || 'ACTIVE',
  });
  return getLeaveTypeById(organizationId, item._id);
}

async function updateLeaveType(organizationId, id, payload) {
  const item = await LeaveType.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!item) throw new AppError('Leave type not found', 404);

  if (payload.name) item.name = payload.name;
  if (payload.code) item.code = payload.code.toUpperCase();
  if (payload.description !== undefined) item.description = payload.description;
  if (payload.totalDays !== undefined) item.totalDays = payload.totalDays;
  if (payload.isPaid !== undefined) item.isPaid = payload.isPaid;
  if (payload.requiresApproval !== undefined) item.requiresApproval = payload.requiresApproval;
  if (payload.allowHalfDay !== undefined) item.allowHalfDay = payload.allowHalfDay;
  if (payload.allowCarryForward !== undefined) item.allowCarryForward = payload.allowCarryForward;
  if (payload.maxCarryForwardDays !== undefined) item.maxCarryForwardDays = payload.maxCarryForwardDays;
  if (payload.status && ['ACTIVE', 'INACTIVE'].includes(payload.status)) item.status = payload.status;

  await item.save();
  return getLeaveTypeById(organizationId, item._id);
}

async function deleteLeaveType(organizationId, id) {
  const item = await LeaveType.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!item) throw new AppError('Leave type not found', 404);
  item.status = 'INACTIVE';
  await item.save();
  return { success: true, message: 'Leave type deactivated' };
}

module.exports = { getLeaveTypes, getLeaveTypeById, createLeaveType, updateLeaveType, deleteLeaveType };
