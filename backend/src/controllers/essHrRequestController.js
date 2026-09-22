const hrRequestService = require('../services/hrRequestService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getRequests = async (req, res) => {
  const { data, pagination } = await hrRequestService.getMyRequests(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getRequestById = async (req, res) => {
  const data = await hrRequestService.getMyRequestById(req.organizationId, req.user, req.params.id);
  res.json({ success: true, data });
};

exports.createRequest = async (req, res) => {
  const data = await hrRequestService.createRequest(req.organizationId, req.user, req.body, reqMeta(req));
  res.status(201).json({ success: true, message: 'HR request submitted', data });
};

exports.addMessage = async (req, res) => {
  const data = await hrRequestService.addMyMessage(req.organizationId, req.user, req.params.id, req.body.message, reqMeta(req));
  res.status(201).json({ success: true, message: 'Message added', data });
};

exports.cancelRequest = async (req, res) => {
  const data = await hrRequestService.cancelRequest(req.organizationId, req.user, req.params.id, reqMeta(req));
  res.json({ success: true, message: 'Request cancelled', data });
};
