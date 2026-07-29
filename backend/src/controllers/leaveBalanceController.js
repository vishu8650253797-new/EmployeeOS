const { Types } = require('mongoose');
const { Employee } = require('../models');
const leaveBalanceService = require('../services/leaveBalanceService');
const AppError = require('../utils/AppError');

async function resolveEmployeeId(req) {
  if (req.user.employeeId) return req.user.employeeId;
  const employee = await Employee.findOne({ userId: req.user._id }).lean();
  return employee ? employee._id : null;
}

exports.getLeaveBalances = async (req, res) => {
  const { data, pagination } = await leaveBalanceService.getBalances(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getMyLeaveBalances = async (req, res) => {
  const employeeId = await resolveEmployeeId(req);
  if (!employeeId) throw new AppError('Employee profile not linked', 400);
  const data = await leaveBalanceService.getMyBalances(req.organizationId, employeeId, req.query.year);
  res.json({ success: true, data });
};

exports.getEmployeeLeaveBalances = async (req, res) => {
  const data = await leaveBalanceService.getMyBalances(req.organizationId, req.params.employeeId, req.query.year);
  res.json({ success: true, data });
};

exports.updateLeaveBalance = async (req, res) => {
  const result = await leaveBalanceService.updateBalance(req.organizationId, req.params.id, req.body);
  res.json(result);
};
