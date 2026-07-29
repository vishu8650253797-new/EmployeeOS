const { Employee } = require('../models');
const leaveRequestService = require('../services/leaveRequestService');

async function resolveEmployeeId(req) {
  if (req.user.employeeId) return req.user.employeeId;
  const employee = await Employee.findOne({ userId: req.user._id }).lean();
  return employee ? employee._id : null;
}

exports.getLeaveRequests = async (req, res) => {
  const { data, pagination } = await leaveRequestService.getLeaveRequests(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getMyLeaveRequests = async (req, res) => {
  const employeeId = await resolveEmployeeId(req);
  if (!employeeId) throw new Error('Employee profile not linked');
  const { data } = await leaveRequestService.getMyLeaveRequests(req.organizationId, employeeId, req.query);
  res.json({ success: true, data });
};

exports.getEmployeeLeaveRequests = async (req, res) => {
  const { data } = await leaveRequestService.getMyLeaveRequests(req.organizationId, req.params.employeeId, req.query);
  res.json({ success: true, data });
};

exports.getLeaveRequestById = async (req, res) => {
  const data = await leaveRequestService.getLeaveRequestById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createLeaveRequest = async (req, res) => {
  const data = await leaveRequestService.createLeaveRequest(req.organizationId, req.body, req.user);
  res.status(201).json({ success: true, message: 'Leave request submitted', data });
};

exports.approveLeaveRequest = async (req, res) => {
  const data = await leaveRequestService.approveLeaveRequest(req.organizationId, req.params.id, req.user);
  res.json({ success: true, message: 'Leave request approved', data });
};

exports.rejectLeaveRequest = async (req, res) => {
  const data = await leaveRequestService.rejectLeaveRequest(req.organizationId, req.params.id, req.user, req.body.rejectionReason);
  res.json({ success: true, message: 'Leave request rejected', data });
};

exports.cancelLeaveRequest = async (req, res) => {
  const data = await leaveRequestService.cancelLeaveRequest(req.organizationId, req.params.id, req.user);
  res.json({ success: true, message: 'Leave request cancelled', data });
};
