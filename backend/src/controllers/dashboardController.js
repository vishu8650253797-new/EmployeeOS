const dashboardService = require('../services/dashboardService');

exports.getStats = async (req, res) => {
  const stats = await dashboardService.getDashboardStats(req.organizationId);
  res.json({ success: true, data: stats });
};
