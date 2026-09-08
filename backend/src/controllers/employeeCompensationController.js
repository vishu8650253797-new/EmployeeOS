const employeeCompensationService = require('../services/employeeCompensationService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getHistory = async (req, res) => {
  const { data, pagination } = await employeeCompensationService.getHistory(req.organizationId, req.query.employeeId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getById = async (req, res) => {
  const data = await employeeCompensationService.getById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.getCurrent = async (req, res) => {
  const data = await employeeCompensationService.getCurrent(req.organizationId, req.params.employeeId, req.user);
  res.json({ success: true, data });
};

exports.assign = async (req, res) => {
  const data = await employeeCompensationService.assign(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Compensation assigned', data });
};

exports.update = async (req, res) => {
  const data = await employeeCompensationService.update(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Compensation updated', data });
};

exports.cancel = async (req, res) => {
  const result = await employeeCompensationService.cancel(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json(result);
};
