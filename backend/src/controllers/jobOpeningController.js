const jobOpeningService = require('../services/jobOpeningService');
const { requestMeta } = require('../services/auditLogService');

exports.getJobs = async (req, res) => {
  const { data, pagination } = await jobOpeningService.getJobs(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getJobById = async (req, res) => {
  const data = await jobOpeningService.getJobById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createJob = async (req, res) => {
  const data = await jobOpeningService.createJob(req.organizationId, req.body, req.user, requestMeta(req));
  res.status(201).json({ success: true, message: 'Job created', data });
};

exports.updateJob = async (req, res) => {
  const data = await jobOpeningService.updateJob(req.organizationId, req.params.id, req.body, req.user, requestMeta(req));
  res.json({ success: true, message: 'Job updated', data });
};

exports.deleteJob = async (req, res) => {
  const result = await jobOpeningService.deleteJob(req.organizationId, req.params.id, req.user, requestMeta(req));
  res.json(result);
};

exports.publishJob = async (req, res) => {
  const data = await jobOpeningService.changeJobStatus(req.organizationId, req.params.id, 'PUBLISHED', req.user, requestMeta(req));
  res.json({ success: true, message: 'Job published', data });
};

exports.pauseJob = async (req, res) => {
  const data = await jobOpeningService.changeJobStatus(req.organizationId, req.params.id, 'PAUSED', req.user, requestMeta(req));
  res.json({ success: true, message: 'Job paused', data });
};

exports.closeJob = async (req, res) => {
  const data = await jobOpeningService.changeJobStatus(req.organizationId, req.params.id, 'CLOSED', req.user, requestMeta(req));
  res.json({ success: true, message: 'Job closed', data });
};

exports.reopenJob = async (req, res) => {
  const data = await jobOpeningService.changeJobStatus(req.organizationId, req.params.id, 'PUBLISHED', req.user, requestMeta(req));
  res.json({ success: true, message: 'Job reopened', data });
};
