const { Types } = require('mongoose');
const { PayrollRecord } = require('../models');
const AppError = require('../utils/AppError');
const payrollAccess = require('../utils/payrollAccess');

const DEFAULTS = { page: 1, limit: 20 };

function toDTO(record) {
  return { ...record, id: record._id.toString() };
}

async function paginate(query, page, limit) {
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    PayrollRecord.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    PayrollRecord.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

// An employee must never see a draft/unapproved calculation of their own pay
// — only FINALIZED records are ever exposed through the self-service views.
async function getMyPayslips(organizationId, user, filters = {}) {
  if (!user.employeeId) throw new AppError('No employee record is linked to this account', 400);
  const query = {
    organizationId: new Types.ObjectId(organizationId),
    employeeId: new Types.ObjectId(user.employeeId),
    status: 'FINALIZED',
  };
  return paginate(query, filters.page, filters.limit);
}

async function getMyPayslipById(organizationId, user, recordId) {
  if (!user.employeeId) throw new AppError('No employee record is linked to this account', 400);
  const record = await PayrollRecord.findOne({
    _id: recordId, organizationId: new Types.ObjectId(organizationId),
    employeeId: new Types.ObjectId(user.employeeId), status: 'FINALIZED',
  }).lean();
  if (!record) throw new AppError('Payslip not found', 404);
  return toDTO(record);
}

async function getPayslips(organizationId, filters = {}) {
  const query = { organizationId: new Types.ObjectId(organizationId), status: 'FINALIZED' };
  if (filters.employeeId && Types.ObjectId.isValid(filters.employeeId)) query.employeeId = filters.employeeId;
  if (filters.payrollPeriodId && Types.ObjectId.isValid(filters.payrollPeriodId)) query.payrollPeriodId = filters.payrollPeriodId;
  return paginate(query, filters.page, filters.limit);
}

async function getPayslipById(organizationId, recordId, user) {
  const record = await PayrollRecord.findOne({ _id: recordId, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!record) throw new AppError('Payslip not found', 404);
  await payrollAccess.assertSelfOrElevated(user, record.employeeId);
  if (record.status !== 'FINALIZED' && !payrollAccess.canViewPayroll(user.role)) {
    throw new AppError('Payslip not found', 404);
  }
  return toDTO(record);
}

module.exports = { getMyPayslips, getMyPayslipById, getPayslips, getPayslipById };
