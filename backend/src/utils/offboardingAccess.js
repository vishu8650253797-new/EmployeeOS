const { Types } = require('mongoose');
const { Employee } = require('../models');
const AppError = require('./AppError');

// Roles that can fully manage the offboarding lifecycle (initiate termination/layoff,
// approve on behalf of HR, edit any record, force-complete).
const FULL_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];
// Offboarding types a plain employee may self-initiate. Termination/layoff/retirement
// must always be initiated by HR — an employee must never be able to terminate themselves.
const SELF_INITIATE_TYPES = ['RESIGNATION'];
// Roles allowed to action a department clearance beyond their own assigned item.
const CLEARANCE_OVERRIDE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

function canAccessAll(role) {
  return FULL_ROLES.includes(role);
}

// Safely extracts a comparable id string whether the field is a raw ObjectId
// or has been populated into a sub-document (e.g. via .populate('clearances.assignedTo')).
function idOf(value) {
  if (!value) return null;
  return (value._id || value).toString();
}

async function getEmployeeLinks(employeeId) {
  return Employee.findById(employeeId).select('userId managerId').lean();
}

// View access: HR/SuperAdmin, the departing employee themselves, their manager,
// anyone assigned a clearance item, or the assigned exit interviewer.
async function authorizeView(offboarding, user) {
  if (!offboarding) throw new AppError('Offboarding record not found', 404);
  if (canAccessAll(user.role)) return true;

  const employee = await getEmployeeLinks(offboarding.employeeId);
  if (employee?.userId && employee.userId.toString() === user._id.toString()) return true;
  if (
    user.role === 'MANAGER' &&
    employee?.managerId &&
    user.employeeId &&
    employee.managerId.toString() === user.employeeId.toString()
  ) {
    return true;
  }

  const clearances = offboarding.clearances || [];
  if (clearances.some((c) => idOf(c.assignedTo) === user._id.toString())) return true;

  if (idOf(offboarding.exitInterview?.interviewerId) === user._id.toString()) {
    return true;
  }

  throw new AppError('Forbidden: you do not have access to this offboarding record', 403);
}

// Edit access for lifecycle-level fields (initiation details, approvals, cancellation) —
// HR/SuperAdmin only. Individual sub-workflows (clearances, exit interview) have their
// own, narrower checks below.
function canEditRecord(role) {
  return FULL_ROLES.includes(role);
}

function canInitiate(role, offboardingType) {
  if (FULL_ROLES.includes(role)) return true;
  return SELF_INITIATE_TYPES.includes(offboardingType);
}

async function canEditClearance(clearance, user) {
  if (CLEARANCE_OVERRIDE_ROLES.includes(user.role)) return true;
  if (idOf(clearance.assignedTo) === user._id.toString()) return true;
  throw new AppError('Forbidden: you are not assigned to this clearance item', 403);
}

function canManageExitInterview(offboarding, user) {
  if (FULL_ROLES.includes(user.role)) return true;
  if (idOf(offboarding.exitInterview?.interviewerId) === user._id.toString()) {
    return true;
  }
  throw new AppError('Forbidden: insufficient permissions', 403);
}

// Sensitive exit-interview content (feedback, ratings, notes) is only visible to
// HR/SuperAdmin and the assigned interviewer — never to the employee's manager or the
// employee themselves, to keep candid feedback safe to give.
function canViewExitInterviewDetails(offboarding, user) {
  if (FULL_ROLES.includes(user.role)) return true;
  return idOf(offboarding.exitInterview?.interviewerId) === user._id.toString();
}

async function restrictEmployeeIdQuery(query, user) {
  if (canAccessAll(user.role)) return query;

  if (user.role === 'MANAGER') {
    if (!user.employeeId) throw new AppError('Forbidden: insufficient permissions', 403);
    const reports = await Employee.find({ managerId: new Types.ObjectId(user.employeeId), isDeleted: false })
      .select('_id')
      .lean();
    const reportIds = reports.map((r) => r._id);
    if (query.employeeId) {
      if (!reportIds.some((id) => id.equals(query.employeeId))) {
        throw new AppError('Forbidden: you do not have access to this employee\'s offboarding records', 403);
      }
      return query;
    }
    return { ...query, employeeId: { $in: reportIds } };
  }

  if (user.employeeId) {
    return { ...query, employeeId: new Types.ObjectId(user.employeeId) };
  }
  throw new AppError('Forbidden: insufficient permissions', 403);
}

module.exports = {
  FULL_ROLES,
  SELF_INITIATE_TYPES,
  CLEARANCE_OVERRIDE_ROLES,
  canAccessAll,
  idOf,
  authorizeView,
  canEditRecord,
  canInitiate,
  canEditClearance,
  canManageExitInterview,
  canViewExitInterviewDetails,
  restrictEmployeeIdQuery,
};
