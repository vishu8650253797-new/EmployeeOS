const AppError = require('./AppError');

const PAYROLL_VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const PAYROLL_PREPARE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
// Deliberately narrower than PREPARE: HR_ADMIN can build/submit a payroll run
// but cannot unilaterally approve/finalize it — a lightweight separation of
// duties for the module's most sensitive step. This is a considered deviation
// from every other module's single "full access" role group (e.g.
// offboardingAccess.FULL_ROLES); if separation of duties isn't wanted here,
// this can simply be set equal to PAYROLL_PREPARE_ROLES.
const PAYROLL_APPROVE_ROLES = ['SUPER_ADMIN', 'FINANCE'];

function canViewPayroll(role) {
  return PAYROLL_VIEW_ROLES.includes(role);
}

function canPreparePayroll(role) {
  return PAYROLL_PREPARE_ROLES.includes(role);
}

function canApprovePayroll(role) {
  return PAYROLL_APPROVE_ROLES.includes(role);
}

// Lets an employee view only their own compensation/payslip records; elevated
// (PAYROLL_VIEW) roles may view any employee's.
function assertSelfOrElevated(user, employeeId) {
  if (canViewPayroll(user.role)) return true;
  if (user.employeeId && employeeId && user.employeeId.toString() === employeeId.toString()) return true;
  throw new AppError('Forbidden: you do not have access to this employee\'s payroll data', 403);
}

// Immutability guard — called at the top of every payrollRunService function
// that mutates a run or its records.
function assertRunMutable(run) {
  if (['FINALIZED', 'CANCELLED'].includes(run.status)) {
    throw new AppError(`Cannot modify a payroll run that is already ${run.status.toLowerCase()}`, 409);
  }
}

module.exports = {
  PAYROLL_VIEW_ROLES,
  PAYROLL_PREPARE_ROLES,
  PAYROLL_APPROVE_ROLES,
  canViewPayroll,
  canPreparePayroll,
  canApprovePayroll,
  assertSelfOrElevated,
  assertRunMutable,
};
