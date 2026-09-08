const payrollAnalyticsService = require('../services/payrollAnalyticsService');

exports.getOverview = async (req, res) => {
  const data = await payrollAnalyticsService.getOverview(req.organizationId);
  res.json({ success: true, data });
};

exports.getTrends = async (req, res) => {
  const { data } = await payrollAnalyticsService.getTrends(req.organizationId, req.query.periods);
  res.json({ success: true, data });
};

exports.getDepartmentCost = async (req, res) => {
  const { data } = await payrollAnalyticsService.getDepartmentCost(req.organizationId, req.query.payrollPeriodId);
  res.json({ success: true, data });
};
