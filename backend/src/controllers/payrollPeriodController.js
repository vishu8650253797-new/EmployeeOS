const payrollPeriodService = require('../services/payrollPeriodService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.list = async (req, res) => {
  const { data } = await payrollPeriodService.list(req.organizationId, req.query);
  res.json({ success: true, data });
};

exports.getById = async (req, res) => {
  const data = await payrollPeriodService.getById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  const data = await payrollPeriodService.create(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Payroll period created', data });
};

exports.close = async (req, res) => {
  const data = await payrollPeriodService.close(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll period closed', data });
};

exports.remove = async (req, res) => {
  const result = await payrollPeriodService.remove(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json(result);
};
