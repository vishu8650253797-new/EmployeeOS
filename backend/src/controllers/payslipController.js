const payslipService = require('../services/payslipService');

exports.getMyPayslips = async (req, res) => {
  const { data, pagination } = await payslipService.getMyPayslips(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getMyPayslipById = async (req, res) => {
  const data = await payslipService.getMyPayslipById(req.organizationId, req.user, req.params.id);
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
