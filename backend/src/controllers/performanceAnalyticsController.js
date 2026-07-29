const performanceAnalyticsService = require('../services/performanceAnalyticsService');

exports.getOverviewAnalytics = async (req, res) => {
  const data = await performanceAnalyticsService.getOverviewAnalytics(req.organizationId, req.query.cycleId);
  res.json({ success: true, data });
};

exports.getDepartmentAnalytics = async (req, res) => {
  const data = await performanceAnalyticsService.getDepartmentAnalytics(req.organizationId, req.query.cycleId);
  res.json({ success: true, data });
};

exports.getPerformanceTrends = async (req, res) => {
  const data = await performanceAnalyticsService.getPerformanceTrends(req.organizationId, req.params.employeeId);
  res.json({ success: true, data });
};

exports.getTopPerformers = async (req, res) => {
  const data = await performanceAnalyticsService.getTopPerformers(req.organizationId, req.query.cycleId, req.query.limit);
  res.json({ success: true, data });
};

exports.getAtRiskEmployees = async (req, res) => {
  const data = await performanceAnalyticsService.getAtRiskEmployees(req.organizationId, req.query.cycleId);
  res.json({ success: true, data });
};

exports.getEmployeePerformanceSummary = async (req, res) => {
  const data = await performanceAnalyticsService.getEmployeePerformanceSummary(
    req.organizationId,
    req.params.employeeId,
    req.query.cycleId
  );
  res.json({ success: true, data });
};
