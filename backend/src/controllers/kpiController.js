const kpiService = require('../services/kpiService');

exports.getKPIs = async (req, res) => {
  const { data, pagination } = await kpiService.getKPIs(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getKPIById = async (req, res) => {
  const data = await kpiService.getKPIById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.getEmployeeKPIs = async (req, res) => {
  const data = await kpiService.getEmployeeKPIs(req.organizationId, req.params.employeeId, req.query);
  res.json({ success: true, data });
};

exports.getCycleKPIs = async (req, res) => {
  const data = await kpiService.getCycleKPIs(req.organizationId, req.params.cycleId);
  res.json({ success: true, data });
};

exports.createKPI = async (req, res) => {
  const data = await kpiService.createKPI(req.organizationId, req.body, req.user._id);
  res.status(201).json({ success: true, message: 'KPI created', data });
};

exports.updateKPI = async (req, res) => {
  const data = await kpiService.updateKPI(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'KPI updated', data });
};

exports.deleteKPI = async (req, res) => {
  const result = await kpiService.deleteKPI(req.organizationId, req.params.id);
  res.json(result);
};

exports.updateKPIValue = async (req, res) => {
  const data = await kpiService.updateKPIValue(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'KPI value updated', data });
};
