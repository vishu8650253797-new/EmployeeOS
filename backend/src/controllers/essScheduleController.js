const employeeScheduleService = require('../services/employeeScheduleService');

exports.getMySchedule = async (req, res) => {
  const data = await employeeScheduleService.getMySchedule(req.organizationId, req.user);
  res.json({ success: true, data });
};
