const salaryStructureService = require('../services/salaryStructureService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getStructures = async (req, res) => {
  const { data } = await salaryStructureService.getStructures(req.organizationId, req.query);
  res.json({ success: true, data });
};

exports.getStructureById = async (req, res) => {
  const data = await salaryStructureService.getStructureById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createStructure = async (req, res) => {
  const data = await salaryStructureService.createStructure(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Salary structure created', data });
};

exports.updateStructure = async (req, res) => {
  const data = await salaryStructureService.updateStructure(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Salary structure updated', data });
};

exports.deleteStructure = async (req, res) => {
  const result = await salaryStructureService.deleteStructure(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json(result);
};
