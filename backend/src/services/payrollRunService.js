const { Types } = require('mongoose');
const {
  PayrollRun, PayrollPeriod, PayrollRecord, EmployeeCompensation, SalaryStructure, SalaryComponent,
  Employee, Department, Organization, User,
} = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const { withTransaction } = require('../utils/withTransaction');
const { sumMinorUnits } = require('../utils/payrollMoney');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const payrollAccess = require('../utils/payrollAccess');
const payrollPeriodService = require('./payrollPeriodService');
const payrollCalculationEngine = require('./payrollCalculationEngine');

const DEFAULTS = { page: 1, limit: 20 };
const PROCESS_BATCH_SIZE = 200;

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
async function notifyUser(userId, organizationId, type, title, message, entityId, entityType = 'PayrollRun') {
  if (!userId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: userId, type, title, message, entityType, entityId,
    });
  } catch (err) {
    console.error('[payroll] notifyUser failed:', err);
  }
}

async function notifyRoles(organizationId, roles, type, title, message, entityId) {
  try {
    const users = await User.find({ organizationId: new Types.ObjectId(organizationId), role: { $in: roles }, status: 'active' })
      .select('_id').lean();
    await Promise.all(users.map((u) => notifyUser(u._id, organizationId, type, title, message, entityId)));
  } catch (err) {
    console.error('[payroll] notifyRoles failed:', err);
  }
}

function toDTO(run) {
  return { ...run, id: run._id.toString() };
}

function countDaysInclusive(start, end) {
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

// Proration for a mid-period joiner only. Leaver proration is intentionally
// out of scope for this phase: Employee carries no reliable termination/last-
// working date of its own (that lives on the separate Offboarding record),
// and wiring payroll to the offboarding module is a future integration, not
// part of this step.
function computePaidDays(employee, period, totalDaysInPeriod) {
  if (employee.joiningDate && employee.joiningDate > period.startDate) {
    if (employee.joiningDate > period.endDate) return 0;
    return countDaysInclusive(employee.joiningDate, period.endDate);
  }
  return totalDaysInPeriod;
}

// Merges a structure's own component values with this compensation's
// overrides into a flat { componentId, value } list.
function mergeEffectiveComponentValues(structure, compensation) {
  const overridesById = new Map((compensation.componentOverrides || []).map((o) => [o.componentId.toString(), o.value]));
  return structure.components.map((c) => ({
    componentId: c.componentId,
    value: overridesById.has(c.componentId.toString()) ? overridesById.get(c.componentId.toString()) : c.value,
  }));
}

// Attaches each merged component's catalog metadata from a prefetched
// componentId -> SalaryComponent map (built once per run, not per employee —
// see the batch prefetch in processRun below).
function buildEngineComponents(mergedComponents, componentDocsById) {
  return mergedComponents.map((c) => {
    const doc = componentDocsById.get(c.componentId.toString());
    if (!doc) throw new AppError('One or more salary components referenced by this structure no longer exist', 400);
    return {
      componentId: doc._id,
      code: doc.code,
      name: doc.name,
      type: doc.type,
      calculationType: doc.calculationType,
      percentageOfComponentId: doc.percentageOfComponentId,
      isProratable: doc.isProratable,
      value: c.value,
    };
  });
}

async function list(organizationId, filters = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const pageNum = Math.max(parseInt(filters.page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: orgId };
  if (filters.payrollPeriodId && Types.ObjectId.isValid(filters.payrollPeriodId)) query.payrollPeriodId = filters.payrollPeriodId;
  if (filters.status && PayrollRun.RUN_STATUSES.includes(filters.status)) query.status = filters.status;

  const [data, total] = await Promise.all([
    PayrollRun.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    PayrollRun.countDocuments(query),
  ]);

  return { data: data.map(toDTO), pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
}

async function getById(organizationId, id) {
  const run = await PayrollRun.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!run) throw new AppError('Payroll run not found', 404);
  return toDTO(run);
}

async function getRecords(organizationId, runId, filters = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const run = await PayrollRun.findOne({ _id: runId, organizationId: orgId }).select('_id').lean();
  if (!run) throw new AppError('Payroll run not found', 404);

  const pageNum = Math.max(parseInt(filters.page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: orgId, payrollRunId: run._id };
  if (filters.status && PayrollRecord.RECORD_STATUSES.includes(filters.status)) query.status = filters.status;
  if (filters.departmentId && Types.ObjectId.isValid(filters.departmentId)) query['employeeSnapshot.departmentId'] = new Types.ObjectId(filters.departmentId);
  if (filters.search && filters.search.trim()) {
    const regex = new RegExp(filters.search.trim(), 'i');
    query.$or = [
      { 'employeeSnapshot.firstName': regex },
      { 'employeeSnapshot.lastName': regex },
      { 'employeeSnapshot.employeeCode': regex },
    ];
  }

  const [data, total] = await Promise.all([
    PayrollRecord.find(query).sort({ 'employeeSnapshot.firstName': 1 }).skip(skip).limit(limitNum).lean(),
    PayrollRecord.countDocuments(query),
  ]);

  return {
    data: data.map((r) => ({ ...r, id: r._id.toString() })),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function create(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const runType = payload.runType && PayrollRun.RUN_TYPES.includes(payload.runType) ? payload.runType : 'REGULAR';

  if (runType === 'SUPPLEMENTARY' && (!payload.employeeScope || payload.employeeScope.length === 0)) {
    throw new AppError('employeeScope is required for a supplementary run', 400);
  }

  const period = await payrollPeriodService.getOrCreatePeriod(organizationId, payload, user);

  if (runType === 'REGULAR') {
    // Atomic claim — race-safe duplicate-run prevention without needing a
    // unique index on PayrollRun itself (which would otherwise block the
    // legitimate cancelled-and-redone or REGULAR+SUPPLEMENTARY cases).
    const claimed = await PayrollPeriod.findOneAndUpdate(
      { _id: period._id, organizationId: orgId, status: 'OPEN' },
      { status: 'PROCESSING' }
    );
    if (!claimed) throw new AppError('This payroll period already has an active run or has been finalized', 409);
  } else if (!['FINALIZED', 'CLOSED'].includes(period.status)) {
    throw new AppError('A supplementary run can only be created for an already-finalized payroll period', 400);
  }

  const organization = await Organization.findById(orgId).select('payrollSettings').lean();

  const run = await PayrollRun.create({
    organizationId: orgId,
    payrollPeriodId: period._id,
    runType,
    employeeScope: runType === 'SUPPLEMENTARY' ? payload.employeeScope : [],
    currency: organization?.payrollSettings?.defaultCurrency || 'INR',
    createdBy: user._id,
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'PAYROLL_RUN_CREATED', entityType: 'PayrollRun', entityId: run._id,
    metadata: { payrollPeriodId: period._id.toString(), runType }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_RUN_CREATED, { runId: run._id.toString(), payrollPeriodId: period._id.toString() });
  return getById(organizationId, run._id);
}

async function resolveEligibleEmployees(orgId, run) {
  if (run.runType === 'SUPPLEMENTARY') {
    return Employee.find({ _id: { $in: run.employeeScope }, organizationId: orgId, isDeleted: false }).lean();
  }
  return Employee.find({ organizationId: orgId, isDeleted: false, status: 'ACTIVE' }).lean();
}

// Shared by process() and recalculate() — calculates payroll for every
// eligible employee, isolating per-employee failures into run.failedEmployees
// rather than aborting the whole batch. Not wrapped in a single Mongo
// transaction: a transaction is all-or-nothing, which doesn't fit "continue
// past a single employee's failure" semantics, and would also risk exceeding
// transaction time/oplog-size limits on a large organization. Employees are
// processed in bounded batches instead, with structures/components prefetched
// once for the whole run (not per employee) to avoid an N+1 query pattern.
async function processRun(organizationId, id, user, reqMeta, { isRecalculate }) {
  const orgId = new Types.ObjectId(organizationId);
  const run = await PayrollRun.findOne({ _id: id, organizationId: orgId });
  if (!run) throw new AppError('Payroll run not found', 404);
  payrollAccess.assertRunMutable(run);

  const allowedFrom = isRecalculate ? ['CALCULATED', 'FAILED', 'REJECTED'] : ['DRAFT', 'FAILED', 'REJECTED'];
  if (!allowedFrom.includes(run.status)) {
    throw new AppError(`Cannot ${isRecalculate ? 'recalculate' : 'process'} a run that is ${run.status.toLowerCase()}`, 400);
  }

  const period = await PayrollPeriod.findOne({ _id: run.payrollPeriodId, organizationId: orgId });
  if (!period) throw new AppError('Payroll period not found', 404);

  run.status = 'PROCESSING';
  run.processingError = undefined;
  await run.save();

  if (isRecalculate) {
    // Safe against the {organizationId, employeeId, payrollPeriodId} unique
    // index: this run's own prior records are cleared before regenerating.
    await PayrollRecord.deleteMany({ organizationId: orgId, payrollRunId: run._id });
  }

  const employees = await resolveEligibleEmployees(orgId, run);
  const employeeIds = employees.map((e) => e._id);
  const totalDaysInPeriod = countDaysInclusive(period.startDate, period.endDate);

  const compensations = await EmployeeCompensation.find({
    organizationId: orgId, employeeId: { $in: employeeIds }, status: 'ACTIVE', effectiveFrom: { $lte: period.endDate },
  }).lean();
  const compensationByEmployeeId = new Map(compensations.map((c) => [c.employeeId.toString(), c]));

  const structureIds = [...new Set(compensations.map((c) => c.structureId.toString()))];
  const structures = await SalaryStructure.find({ _id: { $in: structureIds }, organizationId: orgId }).lean();
  const structureById = new Map(structures.map((s) => [s._id.toString(), s]));

  const componentIds = new Set();
  structures.forEach((s) => {
    if (s.basicComponentId) componentIds.add(s.basicComponentId.toString());
    s.components.forEach((c) => componentIds.add(c.componentId.toString()));
  });
  const componentDocs = await SalaryComponent.find({ _id: { $in: [...componentIds] }, organizationId: orgId }).lean();
  const componentDocsById = new Map(componentDocs.map((d) => [d._id.toString(), d]));

  const departmentIds = [...new Set(employees.filter((e) => e.departmentId).map((e) => e.departmentId.toString()))];
  const departments = await Department.find({ _id: { $in: departmentIds } }).select('name').lean();
  const departmentNameById = new Map(departments.map((d) => [d._id.toString(), d.name]));

  const failedEmployees = [];
  const totals = { gross: 0, deductions: 0, net: 0, employerCost: 0 };
  let createdCount = 0;

  for (let i = 0; i < employees.length; i += PROCESS_BATCH_SIZE) {
    const batch = employees.slice(i, i + PROCESS_BATCH_SIZE);
    const batchDocs = [];

    for (const employee of batch) {
      try {
        const compensation = compensationByEmployeeId.get(employee._id.toString());
        if (!compensation) throw new AppError('No active compensation assigned for this employee', 400);

        const structure = structureById.get(compensation.structureId.toString());
        if (!structure) throw new AppError('The assigned salary structure could not be found', 400);

        const mergedComponents = mergeEffectiveComponentValues(structure, compensation);
        const engineComponents = buildEngineComponents(mergedComponents, componentDocsById);

        const paidDays = computePaidDays(employee, period, totalDaysInPeriod);

        const result = payrollCalculationEngine.calculate({
          earningComponents: engineComponents.filter((c) => c.type === 'EARNING'),
          deductionComponents: engineComponents.filter((c) => c.type === 'DEDUCTION'),
          employerContributionComponents: engineComponents.filter((c) => c.type === 'EMPLOYER_CONTRIBUTION'),
          basicComponentId: structure.basicComponentId ? structure.basicComponentId.toString() : null,
          paidDays,
          totalDaysInPeriod,
        });

        batchDocs.push({
          organizationId: orgId,
          payrollRunId: run._id,
          payrollPeriodId: period._id,
          employeeId: employee._id,
          employeeSnapshot: {
            employeeCode: employee.employeeId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            jobTitle: employee.jobTitle,
            departmentId: employee.departmentId,
            departmentName: employee.departmentId ? departmentNameById.get(employee.departmentId.toString()) : undefined,
          },
          structureId: structure._id,
          compensationId: compensation._id,
          currency: compensation.currency || structure.currency,
          paidDays,
          totalDaysInPeriod,
          earnings: result.earnings,
          deductions: result.deductions,
          employerContributions: result.employerContributions,
          grossMinorUnits: result.grossMinorUnits,
          totalDeductionsMinorUnits: result.totalDeductionsMinorUnits,
          netPayMinorUnits: result.netPayMinorUnits,
          totalEmployerCostMinorUnits: result.totalEmployerCostMinorUnits,
          status: 'CALCULATED',
          createdBy: user._id,
        });

        totals.gross += result.grossMinorUnits;
        totals.deductions += result.totalDeductionsMinorUnits;
        totals.net += result.netPayMinorUnits;
        totals.employerCost += result.totalEmployerCostMinorUnits;
      } catch (err) {
        failedEmployees.push({ employeeId: employee._id, error: err.message || 'Calculation failed' });
      }
    }

    if (batchDocs.length > 0) {
      await PayrollRecord.insertMany(batchDocs, { ordered: false });
      createdCount += batchDocs.length;
    }
  }

  run.employeeCount = createdCount;
  run.failedEmployees = failedEmployees;
  run.totalGrossMinorUnits = totals.gross;
  run.totalDeductionsMinorUnits = totals.deductions;
  run.totalNetPayMinorUnits = totals.net;
  run.totalEmployerCostMinorUnits = totals.employerCost;
  run.processedAt = new Date();
  run.status = failedEmployees.length > 0 ? 'FAILED' : 'CALCULATED';
  await run.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: isRecalculate ? 'PAYROLL_RUN_RECALCULATED' : 'PAYROLL_RUN_PROCESSED',
    entityType: 'PayrollRun', entityId: run._id,
    metadata: { employeeCount: createdCount, failedCount: failedEmployees.length }, ...reqMeta,
  });

  emitToOrg(orgId, run.status === 'FAILED' ? SOCKET_EVENTS.PAYROLL_RUN_FAILED : SOCKET_EVENTS.PAYROLL_RUN_CALCULATED, {
    runId: run._id.toString(), status: run.status, employeeCount: createdCount, failedCount: failedEmployees.length,
  });

  return getById(organizationId, run._id);
}

function process(organizationId, id, user, reqMeta = {}) {
  return processRun(organizationId, id, user, reqMeta, { isRecalculate: false });
}

function recalculate(organizationId, id, user, reqMeta = {}) {
  return processRun(organizationId, id, user, reqMeta, { isRecalculate: true });
}

async function recalculateRunTotals(orgId, run) {
  const agg = await PayrollRecord.aggregate([
    { $match: { organizationId: orgId, payrollRunId: run._id } },
    {
      $group: {
        _id: null,
        gross: { $sum: '$grossMinorUnits' },
        deductions: { $sum: '$totalDeductionsMinorUnits' },
        net: { $sum: '$netPayMinorUnits' },
        employerCost: { $sum: '$totalEmployerCostMinorUnits' },
        count: { $sum: 1 },
      },
    },
  ]);
  const totals = agg[0] || { gross: 0, deductions: 0, net: 0, employerCost: 0, count: 0 };
  run.totalGrossMinorUnits = totals.gross;
  run.totalDeductionsMinorUnits = totals.deductions;
  run.totalNetPayMinorUnits = totals.net;
  run.totalEmployerCostMinorUnits = totals.employerCost;
  run.employeeCount = totals.count;
  await run.save();
}

async function updateRecord(organizationId, runId, recordId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const run = await PayrollRun.findOne({ _id: runId, organizationId: orgId });
  if (!run) throw new AppError('Payroll run not found', 404);
  payrollAccess.assertRunMutable(run);
  if (run.status !== 'CALCULATED') throw new AppError('Records can only be adjusted while the run is in CALCULATED status', 400);

  const record = await PayrollRecord.findOne({ _id: recordId, organizationId: orgId, payrollRunId: run._id });
  if (!record) throw new AppError('Payroll record not found', 404);
  if (!payload.adjustmentNote || !payload.adjustmentNote.trim()) {
    throw new AppError('adjustmentNote is required when manually adjusting a payroll record', 400);
  }

  if (payload.earnings !== undefined) record.earnings = payload.earnings;
  if (payload.deductions !== undefined) record.deductions = payload.deductions;

  record.grossMinorUnits = sumMinorUnits(record.earnings, (e) => e.amountMinorUnits);
  record.totalDeductionsMinorUnits = sumMinorUnits(record.deductions, (d) => d.amountMinorUnits);
  record.netPayMinorUnits = record.grossMinorUnits - record.totalDeductionsMinorUnits;
  record.totalEmployerCostMinorUnits = record.grossMinorUnits + sumMinorUnits(record.employerContributions, (e) => e.amountMinorUnits);
  record.status = 'ADJUSTED';
  record.adjustmentNote = payload.adjustmentNote;
  record.updatedBy = user._id;
  await record.save();

  await recalculateRunTotals(orgId, run);

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'PAYROLL_RECORD_ADJUSTED', entityType: 'PayrollRecord', entityId: record._id,
    metadata: { runId: run._id.toString(), note: payload.adjustmentNote }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_RUN_CALCULATED, { runId: run._id.toString(), status: run.status });
  return { ...record.toObject(), id: record._id.toString() };
}

async function submit(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const run = await PayrollRun.findOne({ _id: id, organizationId: orgId });
  if (!run) throw new AppError('Payroll run not found', 404);
  payrollAccess.assertRunMutable(run);
  if (run.status !== 'CALCULATED') throw new AppError(`Cannot submit a run that is ${run.status.toLowerCase()}`, 400);
  if (run.failedEmployees.length > 0) {
    throw new AppError('This run has employees that failed calculation and cannot be submitted — resolve and recalculate first', 400);
  }

  run.status = 'SUBMITTED';
  run.submittedBy = user._id;
  run.submittedAt = new Date();
  await run.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'PAYROLL_RUN_SUBMITTED', entityType: 'PayrollRun', entityId: run._id, metadata: {}, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_RUN_SUBMITTED, { runId: run._id.toString() });
  await notifyRoles(orgId, payrollAccess.PAYROLL_APPROVE_ROLES, 'PAYROLL_RUN_SUBMITTED', 'Payroll awaiting approval',
    'A payroll run has been submitted and is awaiting your approval.', run._id);

  return getById(organizationId, run._id);
}

async function approve(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const run = await PayrollRun.findOne({ _id: id, organizationId: orgId });
  if (!run) throw new AppError('Payroll run not found', 404);
  payrollAccess.assertRunMutable(run);
  if (run.status !== 'SUBMITTED') throw new AppError(`Cannot approve a run that is ${run.status.toLowerCase()}`, 400);

  run.status = 'APPROVED';
  run.approvedBy = user._id;
  run.approvedAt = new Date();
  await run.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'PAYROLL_RUN_APPROVED', entityType: 'PayrollRun', entityId: run._id, metadata: {}, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_RUN_APPROVED, { runId: run._id.toString() });
  await notifyUser(run.submittedBy, orgId, 'PAYROLL_RUN_APPROVED', 'Payroll run approved', 'A payroll run you submitted has been approved.', run._id);

  return getById(organizationId, run._id);
}

async function reject(organizationId, id, reason, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const run = await PayrollRun.findOne({ _id: id, organizationId: orgId });
  if (!run) throw new AppError('Payroll run not found', 404);
  payrollAccess.assertRunMutable(run);
  if (run.status !== 'SUBMITTED') throw new AppError(`Cannot reject a run that is ${run.status.toLowerCase()}`, 400);
  if (!reason || !reason.trim()) throw new AppError('A rejection reason is required', 400);

  run.status = 'REJECTED';
  run.rejectedBy = user._id;
  run.rejectedAt = new Date();
  run.rejectionReason = reason;
  await run.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'PAYROLL_RUN_REJECTED', entityType: 'PayrollRun', entityId: run._id, metadata: { reason }, ...reqMeta,
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_RUN_REJECTED, { runId: run._id.toString(), reason });
  await notifyUser(run.submittedBy, orgId, 'PAYROLL_RUN_REJECTED', 'Payroll run rejected', reason, run._id);

  return getById(organizationId, run._id);
}

async function finalize(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const run = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await PayrollRun.findOne({ _id: id, organizationId: orgId }, null, opts);
    if (!record) throw new AppError('Payroll run not found', 404);
    payrollAccess.assertRunMutable(record);
    if (record.status !== 'APPROVED') throw new AppError(`Cannot finalize a run that is ${record.status.toLowerCase()}`, 400);

    record.status = 'FINALIZED';
    record.finalizedBy = user._id;
    record.finalizedAt = new Date();
    await record.save(opts);

    await PayrollRecord.updateMany(
      { organizationId: orgId, payrollRunId: record._id },
      { status: 'FINALIZED', isLocked: true },
      opts
    );

    if (record.runType === 'REGULAR') {
      await PayrollPeriod.updateOne(
        { _id: record.payrollPeriodId, organizationId: orgId },
        { status: 'FINALIZED', finalizedAt: new Date(), currentRunId: record._id },
        opts
      );
    }

    await auditLogService.recordAction({
      organizationId: orgId, userId: user._id, action: 'PAYROLL_RUN_FINALIZED', entityType: 'PayrollRun', entityId: record._id,
      metadata: { employeeCount: record.employeeCount }, session, ...reqMeta,
    });

    return record;
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_RUN_FINALIZED, {
    runId: run._id.toString(), payrollPeriodId: run.payrollPeriodId.toString(), employeeCount: run.employeeCount,
  });

  // Best-effort, outside the already-committed transaction — a notification
  // failure here must never roll back a finalize that already succeeded.
  // Each employee gets one NOTIFICATION_NEW over their own user room for
  // free via notificationService's existing socket pipeline; no separate
  // per-payslip event is emitted.
  try {
    const records = await PayrollRecord.find({ organizationId: orgId, payrollRunId: run._id }).select('employeeId').lean();
    const employees = await Employee.find({ _id: { $in: records.map((r) => r.employeeId) } }).select('userId').lean();
    const userIdByEmployeeId = new Map(employees.filter((e) => e.userId).map((e) => [e._id.toString(), e.userId]));
    await Promise.all(
      records
        .filter((r) => userIdByEmployeeId.has(r.employeeId.toString()))
        .map((r) => notifyUser(
          userIdByEmployeeId.get(r.employeeId.toString()), orgId, 'PAYROLL_PAYSLIP_AVAILABLE', 'Payslip available',
          'Your payslip is now available to view.', r._id, 'PayrollRecord'
        ))
    );
  } catch (err) {
    console.error('[payroll] finalize notifications failed:', err);
  }

  return getById(organizationId, run._id);
}

async function cancel(organizationId, id, reason, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const run = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const record = await PayrollRun.findOne({ _id: id, organizationId: orgId }, null, opts);
    if (!record) throw new AppError('Payroll run not found', 404);
    payrollAccess.assertRunMutable(record);
    if (!['DRAFT', 'PROCESSING', 'CALCULATED', 'FAILED', 'REJECTED'].includes(record.status)) {
      throw new AppError(`Cannot cancel a run that is ${record.status.toLowerCase()}`, 400);
    }

    await PayrollRecord.deleteMany({ organizationId: orgId, payrollRunId: record._id }, opts);

    if (record.runType === 'REGULAR') {
      // Only releases the period if this run is still the one holding it in
      // PROCESSING — harmless no-op otherwise.
      await PayrollPeriod.updateOne(
        { _id: record.payrollPeriodId, organizationId: orgId, status: 'PROCESSING' },
        { status: 'OPEN' },
        opts
      );
    }

    record.status = 'CANCELLED';
    record.cancelledBy = user._id;
    record.cancelledAt = new Date();
    record.cancellationReason = reason || '';
    await record.save(opts);

    await auditLogService.recordAction({
      organizationId: orgId, userId: user._id, action: 'PAYROLL_RUN_CANCELLED', entityType: 'PayrollRun', entityId: record._id,
      metadata: { reason }, session, ...reqMeta,
    });

    return record;
  });

  emitToOrg(orgId, SOCKET_EVENTS.PAYROLL_RUN_CANCELLED, { runId: run._id.toString(), reason });
  return getById(organizationId, run._id);
}

module.exports = {
  list, getById, getRecords, create, process, recalculate, updateRecord, submit, approve, reject, finalize, cancel,
};
