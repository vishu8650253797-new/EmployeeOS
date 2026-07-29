const performanceCycleService = require('../services/performanceCycleService');

exports.getCycles = async (req, res) => {
  const { data, pagination } = await performanceCycleService.getCycles(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getCycleById = async (req, res) => {
  const data = await performanceCycleService.getCycleById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createCycle = async (req, res) => {
  const data = await performanceCycleService.createCycle(req.organizationId, req.body, req.user._id);
  res.status(201).json({ success: true, message: 'Performance cycle created', data });
};

exports.updateCycle = async (req, res) => {
  const data = await performanceCycleService.updateCycle(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'Performance cycle updated', data });
};

exports.deleteCycle = async (req, res) => {
  const result = await performanceCycleService.deleteCycle(req.organizationId, req.params.id);
  res.json(result);
};

exports.getActiveCycle = async (req, res) => {
  const data = await performanceCycleService.getActiveCycle(req.organizationId);
  res.json({ success: true, data });
};
