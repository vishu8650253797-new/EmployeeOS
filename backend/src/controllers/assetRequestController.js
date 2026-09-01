const assetRequestService = require('../services/assetRequestService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getRequests = async (req, res) => {
  const { data, pagination } = await assetRequestService.getRequests(req.organizationId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getRequestById = async (req, res) => {
  const data = await assetRequestService.getRequestById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.createRequest = async (req, res) => {
  const data = await assetRequestService.createRequest(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Asset request submitted', data });
};

exports.approveRequest = async (req, res) => {
  const data = await assetRequestService.approveRequest(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset request approved', data });
};

exports.rejectRequest = async (req, res) => {
  const data = await assetRequestService.rejectRequest(req.organizationId, req.params.id, req.body.rejectionReason, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset request rejected', data });
};

exports.cancelRequest = async (req, res) => {
  const data = await assetRequestService.cancelRequest(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset request cancelled', data });
};

exports.fulfillRequest = async (req, res) => {
  const data = await assetRequestService.fulfillRequest(req.organizationId, req.params.id, req.body.assetId, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset request fulfilled', data });
};
