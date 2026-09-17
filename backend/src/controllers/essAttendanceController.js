const essAttendanceService = require('../services/essAttendanceService');

exports.getMyHistory = async (req, res) => {
  const { records, pagination } = await essAttendanceService.getMyHistory(req.organizationId, req.user, req.query);
  res.json({ success: true, data: records, pagination });
};

exports.getMySummary = async (req, res) => {
  const data = await essAttendanceService.getMySummary(req.organizationId, req.user, req.query);
  res.json({ success: true, data });
};

exports.getRecordById = async (req, res) => {
  const data = await essAttendanceService.getMyRecordById(req.organizationId, req.user, req.params.id);
  res.json({ success: true, data });
};
