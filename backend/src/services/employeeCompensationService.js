const { Types } = require('mongoose');
const { EmployeeCompensation, Employee, SalaryStructure } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const { withTransaction } = require('../utils/withTransaction');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const payrollAccess = require('../utils/payrollAccess');

const DEFAULTS = { page: 1, limit: 20 };

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[payroll] socket emit failed:', err);
  }
}

// Best-effort — a notification failure must never roll back or fail a
// mutation that already succeeded. Message text intentionally contains no
// amounts, matching the socket-payload minimal-data rule.
async function notifyUser(userId, organizationId, type, title, message, entityId) {
  if (!userId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: userId, type, title, message, entityType: 'EmployeeCompensation', entityId,
    });
  } catch (err) {
    console.error('[payroll] notifyUser failed:', err);
  }
}

function toDTO(compensation) {
  return { ...compensation, id: compensation._id.toString() };
}

// Merges structure.components with this compensation's overrides into the
// final effective value per component — for display only, never persisted.
function mergeEffectiveComponents(structure, compensation) {
  if (!structure) return [];
  const overridesById = new Map((compensation.componentOverrides || []).map((o) => [o.componentId.toString(), o.value]));
  return structure.components.map((c) => ({
    componentId: c.componentId,
    value: overridesById.has(c.componentId.toString()) ? overridesById.get(c.componentId.toString()) : c.value,
    isOverridden: overridesById.has(c.componentId.toString()),
  }));
}

async function enrich(organizationId, compensation) {
  const structure = await SalaryStructure.findOne({
    _id: compensation.structureId, organizationId: new Types.ObjectId(organizationId),
  }).lean();
  return { ...toDTO(compensation), effectiveComponents: mergeEffectiveComponents(structure, compensation) };
}

async function getHistory(organizationId, employeeId, filters, user) {
  await payrollAccess.assertSelfOrElevated(user, employeeId);
  const orgId = new Types.ObjectId(organizationId);
  const pageNum = Math.max(parseInt(filters.page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: orgId, employeeId: new Types.ObjectId(employeeId) };
  const [data, total] = await Promise.all([
    EmployeeCompensation.find(query).sort({ effectiveFrom: -1 }).skip(skip).limit(limitNum).lean(),
    EmployeeCompensation.countDocuments(query),
  ]);

  return {
    data: await Promise.all(data.map((c) => enrich(organizationId, c))),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getById(organizationId, id, user) {
  const compensation = await EmployeeCompensation.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!compensation) throw new AppError('Compensation record not found', 404);
  await payrollAccess.assertSelfOrElevated(user, compensation.employeeId);
  return enrich(organizationId, compensation);
}

async function getCurrent(organizationId, employeeId, user) {
  await payrollAccess.assertSelfOrElevated(user, employeeId);
  const compensation = await EmployeeCompensation.findOne({
    organizationId: new Types.ObjectId(organizationId), employeeId: new Types.ObjectId(employeeId), status: 'ACTIVE',
  }).lean();
  if (!compensation) throw new AppError('This employee has no active compensation assigned', 404);
  return enrich(organizationId, compensation);
}

function validateOverrides(structure, overrides) {
  if (!overrides || overrides.length === 0) return;
  const structureById = new Map(structure.components.map((c) => [c.componentId.toString(), c]));
  for (const override of overrides) {
    const structureComponent = structureById.get(override.componentId.toString());
    if (!structureComponent) {
      throw new AppError('componentOverrides may only reference components already present in the salary structure', 400);
    }
    if (structureComponent.isOverridable === false) {
      throw new AppError('One or more overridden components are not marked as overridable in the salary structure', 400);
    }
  }
}

async function assign(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const employee = await Employee.findOne({ _id: payload.employeeId, organizationId: orgId, isDeleted: false });
  if (!employee) throw new AppError('Employee not found', 404);

  const structure = await SalaryStructure.findOne({ _id: payload.structureId, organizationId: orgId, isDeleted: false });
  if (!structure) throw new AppError('Salary structure not found', 404);

  const effectiveFrom = new Date(payload.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) throw new AppError('A valid effectiveFrom date is required', 400);

  validateOverrides(structure, payload.componentOverrides);

  const compensation = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;

    const previous = await EmployeeCompensation.findOne(
      { organizationId: orgId, employeeId: employee._id, status: 'ACTIVE' },
      null,
      opts
    );
    if (previous) {
      previous.status = 'SUPERSEDED';
      previous.effectiveTo = effectiveFrom;
      await previous.save(opts);
    }

    const [created] = await EmployeeCompensation.create(
      [{
        organizationId: orgId,
        employeeId: employee._id,
        structureId: structure._id,
        currency: payload.currency || structure.currency,
        componentOverrides: payload.componentOverrides || [],
        ctcAnnualMinorUnits: payload.ctcAnnualMinorUnits,
        effectiveFrom,
        status: 'ACTIVE',
        revisionReason: payload.revisionReason || '',
        createdBy: user._id,
        approvedBy: user._id,
      }],
      opts
    );

    await auditLogService.recordAction({
      organizationId: orgId, userId: user._id, action: 'EMPLOYEE_COMPENSATION_ASSIGNED', entityType: 'EmployeeCompensation', entityId: created._id,
      metadata: { employeeId: employee._id.toString(), structureId: structure._id.toString() }, session, ...reqMeta,
    });

    return created;
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_COMPENSATION_UPDATED, { employeeId: employee._id.toString(), compensationId: compensation._id.toString() });
  if (employee.userId) {
    await notifyUser(employee.userId, organizationId, 'PAYROLL_COMPENSATION_UPDATED', 'Compensation updated',
      'Your compensation details have been updated.', compensation._id);
  }

  return getById(organizationId, compensation._id, user);
}

async function update(organizationId, id, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const compensation = await EmployeeCompensation.findOne({ _id: id, organizationId: orgId });
  if (!compensation) throw new AppError('Compensation record not found', 404);
  if (compensation.status !== 'ACTIVE') throw new AppError('Only an active, not-yet-effective compensation record can be edited', 400);
  if (compensation.effectiveFrom <= new Date()) {
    throw new AppError('This compensation record is already effective and can no longer be edited — assign a new revision instead', 400);
  }

  const structure = await SalaryStructure.findOne({ _id: compensation.structureId, organizationId: orgId });
  if (payload.componentOverrides !== undefined) {
    validateOverrides(structure, payload.componentOverrides);
    compensation.componentOverrides = payload.componentOverrides;
  }
  if (payload.effectiveFrom !== undefined) {
    const effectiveFrom = new Date(payload.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) throw new AppError('Invalid effectiveFrom date', 400);
    compensation.effectiveFrom = effectiveFrom;
  }
  if (payload.ctcAnnualMinorUnits !== undefined) compensation.ctcAnnualMinorUnits = payload.ctcAnnualMinorUnits;
  if (payload.revisionReason !== undefined) compensation.revisionReason = payload.revisionReason;

  await compensation.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'EMPLOYEE_COMPENSATION_UPDATED', entityType: 'EmployeeCompensation', entityId: compensation._id,
    metadata: { changed: Object.keys(payload) }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_COMPENSATION_UPDATED, { employeeId: compensation.employeeId.toString(), compensationId: compensation._id.toString() });
  return getById(organizationId, compensation._id, user);
}

async function cancel(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const compensation = await EmployeeCompensation.findOne({ _id: id, organizationId: orgId });
  if (!compensation) throw new AppError('Compensation record not found', 404);
  if (compensation.status !== 'ACTIVE') throw new AppError('Only an active, not-yet-effective compensation record can be cancelled', 400);
  if (compensation.effectiveFrom <= new Date()) {
    throw new AppError('This compensation record is already effective and can no longer be cancelled', 400);
  }

  compensation.status = 'CANCELLED';
  await compensation.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'EMPLOYEE_COMPENSATION_CANCELLED', entityType: 'EmployeeCompensation', entityId: compensation._id,
    metadata: {}, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_COMPENSATION_UPDATED, { employeeId: compensation.employeeId.toString(), compensationId: compensation._id.toString() });
  return { success: true, message: 'Compensation revision cancelled' };
}

module.exports = { getHistory, getById, getCurrent, assign, update, cancel };
