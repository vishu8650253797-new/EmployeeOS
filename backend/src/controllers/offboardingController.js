const offboardingService = require('../services/offboardingService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.list = async (req, res) => {
  const { data, pagination } = await offboardingService.list(req.organizationId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getDashboard = async (req, res) => {
  const data = await offboardingService.getDashboardMetrics(req.organizationId, req.user);
  res.json({ success: true, data });
};

exports.getById = async (req, res) => {
  const data = await offboardingService.getById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.initiate = async (req, res) => {
  const data = await offboardingService.initiate(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Offboarding initiated', data });
};

exports.update = async (req, res) => {
  const data = await offboardingService.update(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Offboarding record updated', data });
};

exports.submit = async (req, res) => {
  const data = await offboardingService.submit(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Submitted for approval', data });
};

exports.approve = async (req, res) => {
  const data = await offboardingService.approve(req.organizationId, req.params.id, req.body.level, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Approval recorded', data });
};

exports.reject = async (req, res) => {
  const data = await offboardingService.reject(req.organizationId, req.params.id, req.body.level, req.body.reason, req.user, reqMeta(req));
  res.json({ success: true, message: 'Offboarding rejected', data });
};

exports.cancel = async (req, res) => {
  const data = await offboardingService.cancel(req.organizationId, req.params.id, req.body.reason, req.user, reqMeta(req));
  res.json({ success: true, message: 'Offboarding cancelled', data });
};

exports.getTimeline = async (req, res) => {
  const data = await offboardingService.getTimeline(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.getClearances = async (req, res) => {
  const data = await offboardingService.getById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data: data.clearances });
};

exports.updateClearance = async (req, res) => {
  const data = await offboardingService.updateClearance(req.organizationId, req.params.id, req.params.clearanceId, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Clearance updated', data });
};

exports.getAssets = async (req, res) => {
  const data = await offboardingService.getEmployeeAssets(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data: data.data });
};

exports.refreshAssetClearance = async (req, res) => {
  const data = await offboardingService.refreshAssetClearance(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset clearance status refreshed', data });
};

exports.scheduleExitInterview = async (req, res) => {
  const data = await offboardingService.scheduleExitInterview(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Exit interview scheduled', data });
};

exports.updateExitInterview = async (req, res) => {
  const data = await offboardingService.updateExitInterview(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Exit interview updated', data });
};

exports.updateKnowledgeTransfer = async (req, res) => {
  const data = await offboardingService.updateKnowledgeTransfer(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Knowledge transfer updated', data });
};

exports.requestAccessDeactivation = async (req, res) => {
  const data = await offboardingService.requestAccessDeactivation(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Access deactivation requested', data });
};

exports.updateAccessDeactivation = async (req, res) => {
  const data = await offboardingService.updateAccessDeactivation(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Access status updated', data });
};

exports.getSettlementPreparation = async (req, res) => {
  const data = await offboardingService.getSettlementPreparation(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.requestDocument = async (req, res) => {
  const data = await offboardingService.requestDocument(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Document requested', data });
};

exports.getDocuments = async (req, res) => {
  const data = await offboardingService.getDocuments(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data: data.data });
};

exports.complete = async (req, res) => {
  const data = await offboardingService.complete(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Offboarding completed', data });
};
