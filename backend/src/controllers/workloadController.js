const workloadService = require('../services/workloadService');

exports.getWorkload = async (req, res) => {
  const data = await workloadService.getWorkload(req.organizationId, req.query);
  res.json({ success: true, data });
};

exports.getMyWorkload = async (req, res) => {
  const employeeId = req.user.employeeId;
  const data = await workloadService.getMyWorkload(req.organizationId, employeeId);
  res.json({ success: true, data });
};
