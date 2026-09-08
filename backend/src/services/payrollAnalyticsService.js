const { Types } = require('mongoose');
const { PayrollRun, PayrollPeriod, PayrollRecord } = require('../models');
const AppError = require('../utils/AppError');

async function getOverview(organizationId) {
  const orgId = new Types.ObjectId(organizationId);
  const [latestRun, pendingApprovals] = await Promise.all([
    PayrollRun.findOne({ organizationId: orgId, status: 'FINALIZED' }).sort({ finalizedAt: -1 }).lean(),
    PayrollRun.countDocuments({ organizationId: orgId, status: 'SUBMITTED' }),
  ]);

  if (!latestRun) return { latestRun: null, pendingApprovals };

  const period = await PayrollPeriod.findById(latestRun.payrollPeriodId).lean();
  return {
    latestRun: {
      id: latestRun._id.toString(),
      payrollPeriodId: latestRun.payrollPeriodId.toString(),
      periodLabel: period ? `${period.year}-${String(period.month).padStart(2, '0')}` : null,
      employeeCount: latestRun.employeeCount,
      totalGrossMinorUnits: latestRun.totalGrossMinorUnits,
      totalDeductionsMinorUnits: latestRun.totalDeductionsMinorUnits,
      totalNetPayMinorUnits: latestRun.totalNetPayMinorUnits,
      totalEmployerCostMinorUnits: latestRun.totalEmployerCostMinorUnits,
      finalizedAt: latestRun.finalizedAt,
    },
    pendingApprovals,
  };
}

async function getTrends(organizationId, periodsCount = 12) {
  const orgId = new Types.ObjectId(organizationId);
  const limit = Math.min(Math.max(parseInt(periodsCount, 10) || 12, 1), 36);

  const runs = await PayrollRun.find({ organizationId: orgId, status: 'FINALIZED', runType: 'REGULAR' })
    .sort({ finalizedAt: -1 })
    .limit(limit)
    .lean();

  const periods = await PayrollPeriod.find({ _id: { $in: runs.map((r) => r.payrollPeriodId) } }).lean();
  const periodById = new Map(periods.map((p) => [p._id.toString(), p]));

  const data = runs
    .map((r) => {
      const period = periodById.get(r.payrollPeriodId.toString());
      return {
        payrollPeriodId: r.payrollPeriodId.toString(),
        year: period?.year,
        month: period?.month,
        totalGrossMinorUnits: r.totalGrossMinorUnits,
        totalDeductionsMinorUnits: r.totalDeductionsMinorUnits,
        totalNetPayMinorUnits: r.totalNetPayMinorUnits,
        totalEmployerCostMinorUnits: r.totalEmployerCostMinorUnits,
        employeeCount: r.employeeCount,
      };
    })
    .sort((a, b) => (a.year - b.year) || (a.month - b.month));

  return { data };
}

// Aggregated directly from PayrollRecord (payrollPeriodId is denormalized on
// every record) rather than from a single PayrollRun, so this naturally
// combines a REGULAR run with any later SUPPLEMENTARY run finalized for the
// same period.
async function getDepartmentCost(organizationId, payrollPeriodId) {
  const orgId = new Types.ObjectId(organizationId);
  if (!payrollPeriodId || !Types.ObjectId.isValid(payrollPeriodId)) {
    throw new AppError('A valid payrollPeriodId is required', 400);
  }

  const rows = await PayrollRecord.aggregate([
    { $match: { organizationId: orgId, payrollPeriodId: new Types.ObjectId(payrollPeriodId), status: 'FINALIZED' } },
    {
      $group: {
        _id: '$employeeSnapshot.departmentId',
        departmentName: { $first: '$employeeSnapshot.departmentName' },
        totalGrossMinorUnits: { $sum: '$grossMinorUnits' },
        totalNetPayMinorUnits: { $sum: '$netPayMinorUnits' },
        totalEmployerCostMinorUnits: { $sum: '$totalEmployerCostMinorUnits' },
        employeeCount: { $sum: 1 },
      },
    },
    { $sort: { totalGrossMinorUnits: -1 } },
  ]);

  return {
    data: rows.map((r) => ({
      departmentId: r._id ? r._id.toString() : null,
      departmentName: r.departmentName || 'Unassigned',
      totalGrossMinorUnits: r.totalGrossMinorUnits,
      totalNetPayMinorUnits: r.totalNetPayMinorUnits,
      totalEmployerCostMinorUnits: r.totalEmployerCostMinorUnits,
      employeeCount: r.employeeCount,
    })),
  };
}

module.exports = { getOverview, getTrends, getDepartmentCost };
