const documentAnalyticsService = require('../services/documentAnalyticsService');

exports.getOverview = async (req, res) => {
  const data = await documentAnalyticsService.getOverview(req.organizationId);
  res.json({ success: true, data });
};

exports.getExpiryAnalytics = async (req, res) => {
  const data = await documentAnalyticsService.getExpiryAnalytics(req.organizationId);
  res.json({ success: true, data });
};

exports.getCategoryAnalytics = async (req, res) => {
  const data = await documentAnalyticsService.getCategoryAnalytics(req.organizationId);
  res.json({ success: true, data });
};

exports.getDepartmentAnalytics = async (req, res) => {
  const data = await documentAnalyticsService.getDepartmentAnalytics(req.organizationId);
  res.json({ success: true, data });
};

exports.getComplianceReport = async (req, res) => {
  const data = await documentAnalyticsService.getComplianceReport(req.organizationId, req.query);
  res.json({ success: true, data });
};
