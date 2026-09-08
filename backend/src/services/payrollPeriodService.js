const { Types } = require('mongoose');
const { PayrollPeriod, PayrollRun, Organization } = require('../models');
const AppError = require('../utils/AppError');
const auditLogService = require('./auditLogService');

function toDTO(period) {
  return { ...period, id: period._id.toString() };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Computes sensible default period dates when a run is created for a
// year/month with no explicit period yet: the full calendar month, paid on
// payDayOfMonth of the following month (capped to that month's day count).
function computeDefaultDates(year, month, payDayOfMonth = 1) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const payMonthDate = new Date(Date.UTC(year, month, 1));
  const payYear = payMonthDate.getUTCFullYear();
  const payMonth = payMonthDate.getUTCMonth() + 1;
  const payDay = Math.min(payDayOfMonth, daysInMonth(payYear, payMonth));
  const payDate = new Date(Date.UTC(payYear, payMonth - 1, payDay));
  return { startDate, endDate, payDate };
}

async function list(organizationId, filters = {}) {
  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (filters.status && PayrollPeriod.PERIOD_STATUSES.includes(filters.status)) query.status = filters.status;
  if (filters.year) query.year = parseInt(filters.year, 10);

  const periods = await PayrollPeriod.find(query).sort({ year: -1, month: -1 }).lean();
  return { data: periods.map(toDTO) };
}

async function getById(organizationId, id) {
  const period = await PayrollPeriod.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!period) throw new AppError('Payroll period not found', 404);
  return toDTO(period);
}

async function create(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const year = parseInt(payload.year, 10);
  const month = parseInt(payload.month, 10);
  if (!year || !month || month < 1 || month > 12) throw new AppError('A valid year and month (1-12) are required', 400);

  const exists = await PayrollPeriod.findOne({ organizationId: orgId, year, month });
  if (exists) throw new AppError('A payroll period already exists for this year and month', 409);

  const startDate = payload.startDate ? new Date(payload.startDate) : undefined;
  const endDate = payload.endDate ? new Date(payload.endDate) : undefined;
  const payDate = payload.payDate ? new Date(payload.payDate) : undefined;
  const defaults = (!startDate || !endDate || !payDate) ? computeDefaultDates(year, month) : {};

  const period = await PayrollPeriod.create({
    organizationId: orgId,
    year,
    month,
    startDate: startDate || defaults.startDate,
    endDate: endDate || defaults.endDate,
    payDate: payDate || defaults.payDate,
    createdBy: user._id,
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'PAYROLL_PERIOD_CREATED', entityType: 'PayrollPeriod', entityId: period._id,
    metadata: { year, month }, ...reqMeta,
  });

  return toDTO(period.toObject());
}

// Reused by payrollRunService.create() for REGULAR runs — resolves an
// existing period for {year, month} or transparently creates one using the
// organization's configured pay-day default.
async function getOrCreatePeriod(organizationId, { year, month, payrollPeriodId }, user) {
  const orgId = new Types.ObjectId(organizationId);

  if (payrollPeriodId) {
    const period = await PayrollPeriod.findOne({ _id: payrollPeriodId, organizationId: orgId });
    if (!period) throw new AppError('Payroll period not found', 404);
    return period;
  }

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!y || !m || m < 1 || m > 12) throw new AppError('A valid year and month (1-12), or a payrollPeriodId, is required', 400);

  const existing = await PayrollPeriod.findOne({ organizationId: orgId, year: y, month: m });
  if (existing) return existing;

  const organization = await Organization.findById(orgId).select('payrollSettings').lean();
  const { startDate, endDate, payDate } = computeDefaultDates(y, m, organization?.payrollSettings?.payDayOfMonth);

  return PayrollPeriod.create({
    organizationId: orgId, year: y, month: m, startDate, endDate, payDate, createdBy: user._id,
  });
}

async function close(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const period = await PayrollPeriod.findOne({ _id: id, organizationId: orgId });
  if (!period) throw new AppError('Payroll period not found', 404);
  if (period.status !== 'FINALIZED') throw new AppError('Only a finalized payroll period can be closed', 400);

  period.status = 'CLOSED';
  period.closedAt = new Date();
  await period.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'PAYROLL_PERIOD_CLOSED', entityType: 'PayrollPeriod', entityId: period._id,
    metadata: {}, ...reqMeta,
  });

  return toDTO(period.toObject());
}

async function remove(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const period = await PayrollPeriod.findOne({ _id: id, organizationId: orgId });
  if (!period) throw new AppError('Payroll period not found', 404);
  if (period.status !== 'OPEN') throw new AppError('Only an open payroll period with no runs can be deleted', 400);

  const hasRun = await PayrollRun.findOne({ organizationId: orgId, payrollPeriodId: period._id }).select('_id').lean();
  if (hasRun) throw new AppError('This payroll period already has one or more runs and cannot be deleted', 409);

  await period.deleteOne();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'PAYROLL_PERIOD_DELETED', entityType: 'PayrollPeriod', entityId: period._id,
    metadata: { year: period.year, month: period.month }, ...reqMeta,
  });

  return { success: true, message: 'Payroll period deleted' };
}

module.exports = { list, getById, create, getOrCreatePeriod, close, remove, computeDefaultDates };
