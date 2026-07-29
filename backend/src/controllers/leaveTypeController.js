const leaveTypeService = require('../services/leaveTypeService');

exports.getLeaveTypes = async (req, res) => {
  const { data, pagination } = await leaveTypeService.getLeaveTypes(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getLeaveTypeById = async (req, res) => {
  const data = await leaveTypeService.getLeaveTypeById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createLeaveType = async (req, res) => {
  const data = await leaveTypeService.createLeaveType(req.organizationId, req.body);
  res.status(201).json({ success: true, message: 'Leave type created', data });
};

exports.updateLeaveType = async (req, res) => {
  const data = await leaveTypeService.updateLeaveType(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'Leave type updated', data });
};

exports.deleteLeaveType = async (req, res) => {
  const result = await leaveTypeService.deleteLeaveType(req.organizationId, req.params.id);
  res.json(result);
};
