const payrollRunService = require('../services/payrollRunService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.list = async (req, res) => {
  const { data, pagination } = await payrollRunService.list(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getById = async (req, res) => {
  const data = await payrollRunService.getById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.getRecords = async (req, res) => {
  const { data, pagination } = await payrollRunService.getRecords(req.organizationId, req.params.id, req.query);
  res.json({ success: true, data, pagination });
};

exports.create = async (req, res) => {
  const data = await payrollRunService.create(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Payroll run created', data });
};

exports.process = async (req, res) => {
  const data = await payrollRunService.process(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll run processed', data });
};

exports.recalculate = async (req, res) => {
  const data = await payrollRunService.recalculate(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll run recalculated', data });
};

exports.updateRecord = async (req, res) => {
  const data = await payrollRunService.updateRecord(req.organizationId, req.params.id, req.params.recordId, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll record adjusted', data });
};

exports.submit = async (req, res) => {
  const data = await payrollRunService.submit(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll run submitted for approval', data });
};

exports.approve = async (req, res) => {
  const data = await payrollRunService.approve(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll run approved', data });
};

exports.reject = async (req, res) => {
  const data = await payrollRunService.reject(req.organizationId, req.params.id, req.body.reason, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll run rejected', data });
};

exports.finalize = async (req, res) => {
  const data = await payrollRunService.finalize(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll run finalized', data });
};

exports.cancel = async (req, res) => {
  const data = await payrollRunService.cancel(req.organizationId, req.params.id, req.body.reason, req.user, reqMeta(req));
  res.json({ success: true, message: 'Payroll run cancelled', data });
};
