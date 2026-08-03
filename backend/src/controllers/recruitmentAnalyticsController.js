const recruitmentAnalyticsService = require('../services/recruitmentAnalyticsService');

exports.getOverview = async (req, res) => {
  const data = await recruitmentAnalyticsService.getOverview(req.organizationId);
  res.json({ success: true, data });
};

exports.getFunnel = async (req, res) => {
  const data = await recruitmentAnalyticsService.getFunnel(req.organizationId, req.query);
  res.json({ success: true, data });
};

exports.getSources = async (req, res) => {
  const data = await recruitmentAnalyticsService.getSources(req.organizationId, req.query);
  res.json({ success: true, data });
};

exports.getJobs = async (req, res) => {
  const data = await recruitmentAnalyticsService.getJobsAnalytics(req.organizationId);
  res.json({ success: true, data });
};

exports.getTimeToHire = async (req, res) => {
  const data = await recruitmentAnalyticsService.getTimeToHire(req.organizationId, req.query);
  res.json({ success: true, data });
};
