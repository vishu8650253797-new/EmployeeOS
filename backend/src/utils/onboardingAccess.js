const { Types } = require('mongoose');
const { Employee, OnboardingProcess } = require('../models');
const AppError = require('./AppError');

const FULL_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

function canAccessAll(role) {
  return FULL_ROLES.includes(role);
}

async function getEmployeeUserId(employeeId) {
  const employee = await Employee.findById(employeeId).select('userId managerId').lean();
  return employee || null;
}

async function getProcessOwnerIds(processId) {
  const process = await OnboardingProcess.findById(processId).select('employeeId').lean();
  if (!process) return null;
  const employee = await Employee.findById(process.employeeId).select('userId managerId').lean();
  if (!employee) return null;
  return { employeeId: process.employeeId, employeeUserId: employee.userId, managerId: employee.managerId };
}

async function getDirectReportIds(managerEmployeeId) {
  const reports = await Employee.find({ managerId: managerEmployeeId, isDeleted: false }).select('_id').lean();
  return reports.map((r) => r._id);
}

async function authorizeProcess(process, user) {
  if (!process) throw new AppError('Process not found', 404);
  if (canAccessAll(user.role)) return true;
  const employee = await getEmployeeUserId(process.employeeId);
  if (employee && employee.userId && employee.userId.toString() === user._id.toString()) return true;
  if (
    user.role === 'MANAGER' &&
    employee && employee.managerId && user.employeeId &&
    employee.managerId.toString() === user.employeeId.toString()
  ) {
    return true;
  }
  throw new AppError('Forbidden: you do not have access to this process', 403);
}

async function canEditProcess(process, user) {
  if (FULL_ROLES.includes(user.role)) return true;
  throw new AppError('Forbidden: insufficient permissions', 403);
}

async function canEditTask(task, user) {
  if (FULL_ROLES.includes(user.role)) return true;
  if (task.assigneeId && task.assigneeId.toString() === user._id.toString()) return true;
  const owner = await getProcessOwnerIds(task.processId);
  if (owner && owner.employeeUserId && owner.employeeUserId.toString() === user._id.toString()) return true;
  throw new AppError('Forbidden: you do not have access to this task', 403);
}

async function restrictEmployeeIdQuery(query, user) {
  if (canAccessAll(user.role)) return query;

  if (user.role === 'MANAGER') {
    if (!user.employeeId) throw new AppError('Forbidden: insufficient permissions', 403);
    const reportIds = await getDirectReportIds(new Types.ObjectId(user.employeeId));
    if (query.employeeId) {
      if (!reportIds.some((id) => id.equals(query.employeeId))) {
        throw new AppError('Forbidden: you do not have access to this employee\'s processes', 403);
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
  canAccessAll,
  getEmployeeUserId,
  getProcessOwnerIds,
  getDirectReportIds,
  authorizeProcess,
  canEditProcess,
  canEditTask,
  restrictEmployeeIdQuery,
};
