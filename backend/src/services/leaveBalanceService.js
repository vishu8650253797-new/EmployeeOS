const { Types } = require('mongoose');
const { LeaveBalance, LeaveType, Employee } = require('../models');
const AppError = require('../utils/AppError');

const CURRENT_YEAR = new Date().getFullYear();

async function getBalances(organizationId, filters = {}) {
  const { employeeId, year = CURRENT_YEAR, page = 1, limit = 50 } = filters;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId), year: parseInt(year, 10) };
  if (employeeId) query.employeeId = new Types.ObjectId(employeeId);

  const [data, total] = await Promise.all([
    LeaveBalance.find(query)
      .populate('employeeId', 'firstName lastName employeeId email')
      .populate('leaveTypeId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    LeaveBalance.countDocuments(query),
  ]);

  const items = data.map((b) => {
    const emp = b.employeeId || {};
    const lt = b.leaveTypeId || {};
    return {
      ...b,
      id: b._id.toString(),
      employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      employeeCode: emp.employeeId || '',
      leaveTypeName: lt.name || '',
      leaveTypeCode: lt.code || '',
    };
  });

  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getMyBalances(organizationId, employeeId, year = CURRENT_YEAR) {
  const balances = await LeaveBalance.find({
    organizationId: new Types.ObjectId(organizationId),
    employeeId: new Types.ObjectId(employeeId),
    year: parseInt(year, 10),
  })
    .populate('leaveTypeId', 'name code')
    .lean();

  return balances.map((b) => {
    const lt = b.leaveTypeId || {};
    return {
      id: b._id.toString(),
      leaveTypeId: lt._id ? lt._id.toString() : null,
      type: lt.name || 'Leave',
      code: lt.code || '',
      year: b.year,
      allocated: b.allocatedDays,
      used: b.usedDays,
      pending: b.pendingDays,
      remaining: b.remainingDays,
      carriedForward: b.carriedForwardDays,
    };
  });
}

async function upsertBalance(organizationId, employeeId, leaveTypeId, year, days) {
  const balance = await LeaveBalance.findOneAndUpdate(
    {
      organizationId: new Types.ObjectId(organizationId),
      employeeId: new Types.ObjectId(employeeId),
      leaveTypeId: new Types.ObjectId(leaveTypeId),
      year: parseInt(year, 10),
    },
    {
      $set: {
        organizationId: new Types.ObjectId(organizationId),
        employeeId: new Types.ObjectId(employeeId),
        leaveTypeId: new Types.ObjectId(leaveTypeId),
        year: parseInt(year, 10),
        allocatedDays: days,
        remainingDays: days,
      },
    },
    { upsert: true, new: true }
  );
  return balance;
}

async function ensureBalancesForEmployee(organizationId, employeeId, year = CURRENT_YEAR) {
  const types = await LeaveType.find({ organizationId: new Types.ObjectId(organizationId), status: 'ACTIVE' }).lean();
  for (const type of types) {
    const existing = await LeaveBalance.findOne({
      organizationId: new Types.ObjectId(organizationId),
      employeeId: new Types.ObjectId(employeeId),
      leaveTypeId: type._id,
      year,
    });
    if (!existing) {
      await LeaveBalance.create({
        organizationId: new Types.ObjectId(organizationId),
        employeeId: new Types.ObjectId(employeeId),
        leaveTypeId: type._id,
        year,
        allocatedDays: type.totalDays,
        usedDays: 0,
        pendingDays: 0,
        remainingDays: type.totalDays,
        carriedForwardDays: 0,
      });
    }
  }
}

async function updateBalance(organizationId, id, payload) {
  const balance = await LeaveBalance.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!balance) throw new AppError('Leave balance not found', 404);

  if (payload.allocatedDays !== undefined) {
    const diff = payload.allocatedDays - balance.allocatedDays;
    balance.allocatedDays = payload.allocatedDays;
    balance.remainingDays = Math.max(balance.remainingDays + diff, 0);
  }
  if (payload.usedDays !== undefined) balance.usedDays = payload.usedDays;
  if (payload.pendingDays !== undefined) balance.pendingDays = payload.pendingDays;
  if (payload.carriedForwardDays !== undefined) balance.carriedForwardDays = payload.carriedForwardDays;

  balance.remainingDays = balance.allocatedDays + balance.carriedForwardDays - balance.usedDays - balance.pendingDays;
  if (balance.remainingDays < 0) balance.remainingDays = 0;

  await balance.save();
  return { success: true, message: 'Leave balance updated' };
}

module.exports = { getBalances, getMyBalances, upsertBalance, ensureBalancesForEmployee, updateBalance };
