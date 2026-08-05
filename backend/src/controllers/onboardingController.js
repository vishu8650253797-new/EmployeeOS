const onboardingService = require('../services/onboardingService');

exports.getProcesses = async (req, res) => {
  const { data, pagination } = await onboardingService.getProcesses(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getProcessById = async (req, res) => {
  const data = await onboardingService.getProcessById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createProcess = async (req, res) => {
  const data = await onboardingService.createProcess(req.organizationId, req.body, req.user);
  res.status(201).json({ success: true, message: 'Process created', data });
};

exports.updateProcess = async (req, res) => {
  const data = await onboardingService.updateProcess(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'Process updated', data });
};

exports.cancelProcess = async (req, res) => {
  const data = await onboardingService.cancelProcess(req.organizationId, req.params.id, req.user, req.body.reason);
  res.json({ success: true, message: 'Process cancelled', data });
};

exports.addTask = async (req, res) => {
  const data = await onboardingService.addTask(req.organizationId, req.params.id, req.body);
  res.status(201).json({ success: true, message: 'Task added', data });
};

exports.updateTask = async (req, res) => {
  const data = await onboardingService.updateTask(req.organizationId, req.params.taskId, req.body);
  res.json({ success: true, message: 'Task updated', data });
};

exports.updateTaskStatus = async (req, res) => {
  const data = await onboardingService.updateTaskStatus(req.organizationId, req.params.taskId, req.body.status, req.user);
  res.json({ success: true, message: 'Task status updated', data });
};

exports.deleteTask = async (req, res) => {
  const data = await onboardingService.deleteTask(req.organizationId, req.params.taskId);
  res.json({ success: true, message: 'Task removed', data });
};

exports.getMyTasks = async (req, res) => {
  const { data, pagination } = await onboardingService.getMyTasks(req.organizationId, req.user._id, req.query);
  res.json({ success: true, data, pagination });
};
