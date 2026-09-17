const essLeaveService = require('../services/essLeaveService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getLeaveTypes = async (req, res) => {
  const data = await essLeaveService.getLeaveTypes(req.organizationId, req.user);
  res.json({ success: true, data });
};

exports.getBalance = async (req, res) => {
  const data = await essLeaveService.getBalance(req.organizationId, req.user, req.query.year);
  res.json({ success: true, data });
};

exports.getRequests = async (req, res) => {
  const { data, pagination } = await essLeaveService.getRequests(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getRequestById = async (req, res) => {
  const data = await essLeaveService.getRequestById(req.organizationId, req.user, req.params.id);
  res.json({ success: true, data });
};

exports.createRequest = async (req, res) => {
  const data = await essLeaveService.createRequest(req.organizationId, req.user, req.body, reqMeta(req));
  res.status(201).json({ success: true, message: 'Leave request submitted', data });
};

exports.cancelRequest = async (req, res) => {
  const data = await essLeaveService.cancelRequest(req.organizationId, req.user, req.params.id, reqMeta(req));
  res.json({ success: true, message: 'Leave request cancelled', data });
};
