const salaryComponentService = require('../services/salaryComponentService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getComponents = async (req, res) => {
  const { data } = await salaryComponentService.getComponents(req.organizationId, req.query);
  res.json({ success: true, data });
};

exports.getComponentById = async (req, res) => {
  const data = await salaryComponentService.getComponentById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createComponent = async (req, res) => {
  const data = await salaryComponentService.createComponent(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Salary component created', data });
};

exports.updateComponent = async (req, res) => {
  const data = await salaryComponentService.updateComponent(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Salary component updated', data });
};

exports.deleteComponent = async (req, res) => {
  const result = await salaryComponentService.deleteComponent(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json(result);
};
