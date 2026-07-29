const taskCommentService = require('../services/taskCommentService');

exports.getTaskComments = async (req, res) => {
  const { data, pagination } = await taskCommentService.getTaskComments(req.organizationId, req.params.taskId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getCommentById = async (req, res) => {
  const data = await taskCommentService.getCommentById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createTaskComment = async (req, res) => {
  const authorEmployeeId = req.employeeId;
  const data = await taskCommentService.createTaskComment(req.organizationId, req.params.taskId, req.body, authorEmployeeId);
  res.status(201).json({ success: true, message: 'Comment added', data });
};

exports.updateTaskComment = async (req, res) => {
  const authorEmployeeId = req.employeeId;
  const data = await taskCommentService.updateTaskComment(req.organizationId, req.params.id, req.body, authorEmployeeId);
  res.json({ success: true, message: 'Comment updated', data });
};

exports.deleteTaskComment = async (req, res) => {
  const authorEmployeeId = req.employeeId;
  const userRole = req.user.role;
  const result = await taskCommentService.deleteTaskComment(req.organizationId, req.params.id, authorEmployeeId, userRole);
  res.json(result);
};
