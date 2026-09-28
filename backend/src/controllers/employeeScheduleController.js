const employeeScheduleService = require('../services/employeeScheduleService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getSchedules = async (req, res) => {
  const { data, pagination } = await employeeScheduleService.getSchedules(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getScheduleById = async (req, res) => {
  const data = await employeeScheduleService.getScheduleById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.assign = async (req, res) => {
  const data = await employeeScheduleService.assign(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Schedule assigned', data });
};

exports.cancel = async (req, res) => {
  const data = await employeeScheduleService.cancel(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Schedule assignment cancelled', data });
};
