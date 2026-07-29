const taskService = require('../services/taskService');

exports.getTasks = async (req, res) => {
  const { data, pagination } = await taskService.getTasks(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getTaskById = async (req, res) => {
  const data = await taskService.getTaskById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createTask = async (req, res) => {
  const reporterEmployeeId = req.employeeId;
  const data = await taskService.createTask(req.organizationId, req.body, req.user._id, reporterEmployeeId);
  res.status(201).json({ success: true, message: 'Task created', data });
};

exports.updateTask = async (req, res) => {
  const data = await taskService.updateTask(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'Task updated', data });
};

exports.deleteTask = async (req, res) => {
  const result = await taskService.deleteTask(req.organizationId, req.params.id);
  res.json(result);
};

exports.updateTaskStatus = async (req, res) => {
  const { status } = req.body;
  const data = await taskService.updateTaskStatus(req.organizationId, req.params.id, status);
  res.json({ success: true, message: 'Task status updated', data });
};

exports.assignTask = async (req, res) => {
  const { assigneeIds } = req.body;
  const data = await taskService.assignTask(req.organizationId, req.params.id, assigneeIds);
  res.json({ success: true, message: 'Task assigned', data });
};
