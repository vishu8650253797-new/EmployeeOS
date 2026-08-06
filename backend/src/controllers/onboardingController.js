const onboardingService = require('../services/onboardingService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getProcesses = async (req, res) => {
  const { data, pagination } = await onboardingService.getProcesses(req.organizationId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getProcessById = async (req, res) => {
  const data = await onboardingService.getProcessById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.createProcess = async (req, res) => {
  const data = await onboardingService.createProcess(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Process created', data });
};

exports.updateProcess = async (req, res) => {
  const data = await onboardingService.updateProcess(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Process updated', data });
};

exports.cancelProcess = async (req, res) => {
  const data = await onboardingService.cancelProcess(req.organizationId, req.params.id, req.user, req.body.reason, reqMeta(req));
  res.json({ success: true, message: 'Process cancelled', data });
};

exports.confirmJoiningDate = async (req, res) => {
  const data = await onboardingService.confirmJoiningDate(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Joining date confirmed', data });
};

exports.triggerDocumentCollection = async (req, res) => {
  const data = await onboardingService.triggerDocumentCollection(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Document collection triggered', data });
};

exports.addTask = async (req, res) => {
  const data = await onboardingService.addTask(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Task added', data });
};

exports.updateTask = async (req, res) => {
  const data = await onboardingService.updateTask(req.organizationId, req.params.taskId, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Task updated', data });
};

exports.updateTaskStatus = async (req, res) => {
  const data = await onboardingService.updateTaskStatus(req.organizationId, req.params.taskId, req.body.status, req.user, reqMeta(req));
  res.json({ success: true, message: 'Task status updated', data });
};

exports.deleteTask = async (req, res) => {
  const data = await onboardingService.deleteTask(req.organizationId, req.params.taskId, req.user, reqMeta(req));
  res.json({ success: true, message: 'Task removed', data });
};

exports.getMyTasks = async (req, res) => {
  const { data, pagination } = await onboardingService.getMyTasks(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};
