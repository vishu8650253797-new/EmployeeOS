const assetAnalyticsService = require('../services/assetAnalyticsService');

exports.getOverview = async (req, res) => {
  const data = await assetAnalyticsService.getOverview(req.organizationId);
  res.json({ success: true, data });
};

exports.getStatusBreakdown = async (req, res) => {
  const data = await assetAnalyticsService.getStatusBreakdown(req.organizationId);
  res.json({ success: true, data });
};

exports.getCategoryBreakdown = async (req, res) => {
  const data = await assetAnalyticsService.getCategoryBreakdown(req.organizationId);
  res.json({ success: true, data });
};

exports.getDepartmentBreakdown = async (req, res) => {
  const data = await assetAnalyticsService.getDepartmentBreakdown(req.organizationId);
  res.json({ success: true, data });
};

exports.getMaintenanceAnalytics = async (req, res) => {
  const data = await assetAnalyticsService.getMaintenanceAnalytics(req.organizationId);
  res.json({ success: true, data });
};

exports.getWarrantyAnalytics = async (req, res) => {
  const data = await assetAnalyticsService.getWarrantyAnalytics(req.organizationId);
  res.json({ success: true, data });
};
