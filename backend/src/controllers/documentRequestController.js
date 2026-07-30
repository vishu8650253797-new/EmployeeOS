const { Employee } = require('../models');
const documentRequestService = require('../services/documentRequestService');
const auditLogService = require('../services/auditLogService');

async function resolveEmployeeId(req) {
  if (req.user.employeeId) return req.user.employeeId;
  const employee = await Employee.findOne({ userId: req.user._id }).lean();
  return employee ? employee._id : null;
}

exports.getRequests = async (req, res) => {
  const { data, pagination } = await documentRequestService.getRequests(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getMyRequests = async (req, res) => {
  const employeeId = await resolveEmployeeId(req);
  if (!employeeId) throw new Error('Employee profile not linked');
  const { data, pagination } = await documentRequestService.getMyRequests(req.organizationId, employeeId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getRequestsByEmployee = async (req, res) => {
  const { data, pagination } = await documentRequestService.getRequestsByEmployee(req.organizationId, req.params.employeeId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getRequestById = async (req, res) => {
  const data = await documentRequestService.getRequestById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.createRequest = async (req, res) => {
  const data = await documentRequestService.createRequest(req.organizationId, req.body, req.user);
  res.status(201).json({ success: true, message: 'Document request created', data });
};

exports.updateRequest = async (req, res) => {
  const data = await documentRequestService.updateRequest(req.organizationId, req.params.id, req.body, req.user);
  res.json({ success: true, message: 'Document request updated', data });
};

exports.cancelRequest = async (req, res) => {
  const data = await documentRequestService.cancelRequest(req.organizationId, req.params.id, req.user);
  res.json({ success: true, message: 'Document request cancelled', data });
};

exports.uploadForRequest = async (req, res) => {
  const data = await documentRequestService.uploadForRequest(req.organizationId, req.params.id, req.file, req.body, req.user, auditLogService.requestMeta(req));
  res.status(201).json({ success: true, message: 'Document submitted for request', data });
};

exports.approveRequest = async (req, res) => {
  const data = await documentRequestService.approveRequest(req.organizationId, req.params.id, req.user, auditLogService.requestMeta(req));
  res.json({ success: true, message: 'Document request approved', data });
};

exports.rejectRequest = async (req, res) => {
  const data = await documentRequestService.rejectRequest(req.organizationId, req.params.id, req.user, req.body.rejectionReason, auditLogService.requestMeta(req));
  res.json({ success: true, message: 'Document request rejected', data });
};
