const hrRequestService = require('../services/hrRequestService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getRequests = async (req, res) => {
  const { data, pagination } = await hrRequestService.getRequests(req.organizationId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getRequestById = async (req, res) => {
  const data = await hrRequestService.getRequestById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.addMessage = async (req, res) => {
  const data = await hrRequestService.addAdminMessage(req.organizationId, req.user, req.params.id, req.body.message, reqMeta(req));
  res.status(201).json({ success: true, message: 'Message added', data });
};

exports.updateStatus = async (req, res) => {
  const data = await hrRequestService.updateStatus(req.organizationId, req.user, req.params.id, req.body, reqMeta(req));
  res.json({ success: true, message: 'Request updated', data });
};
