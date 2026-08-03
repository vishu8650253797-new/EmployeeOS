const applicationService = require('../services/applicationService');
const { requestMeta } = require('../services/auditLogService');

exports.getApplications = async (req, res) => {
  const { data, pagination } = await applicationService.getApplications(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getApplicationById = async (req, res) => {
  const data = await applicationService.getApplicationById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.updateStatus = async (req, res) => {
  const data = await applicationService.updateStatus(
    req.organizationId,
    req.params.id,
    req.body.status,
    req.user,
    { rejectionReason: req.body.rejectionReason, withdrawalReason: req.body.withdrawalReason },
    requestMeta(req)
  );
  res.json({ success: true, message: 'Application status updated', data });
};

exports.rejectApplication = async (req, res) => {
  const data = await applicationService.rejectApplication(
    req.organizationId, req.params.id, req.body.rejectionReason, req.user, requestMeta(req)
  );
  res.json({ success: true, message: 'Application rejected', data });
};

exports.withdrawApplication = async (req, res) => {
  const data = await applicationService.withdrawApplication(
    req.organizationId, req.params.id, req.body.withdrawalReason, req.user, requestMeta(req)
  );
  res.json({ success: true, message: 'Application withdrawn', data });
};
