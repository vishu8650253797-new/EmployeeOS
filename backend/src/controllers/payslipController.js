const payslipService = require('../services/payslipService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getMyPayslips = async (req, res) => {
  const { data, pagination } = await payslipService.getMyPayslips(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getMyPayrollOverview = async (req, res) => {
  const data = await payslipService.getMyPayrollOverview(req.organizationId, req.user);
  res.json({ success: true, data });
};

exports.getMyPayslipById = async (req, res) => {
  const data = await payslipService.getMyPayslipById(req.organizationId, req.user, req.params.id, reqMeta(req));
  res.json({ success: true, data });
};

exports.getPayslips = async (req, res) => {
  const { data, pagination } = await payslipService.getPayslips(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getPayslipById = async (req, res) => {
  const data = await payslipService.getPayslipById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};
