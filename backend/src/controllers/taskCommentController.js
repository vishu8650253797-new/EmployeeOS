const taskCommentService = require('../services/taskCommentService');
const { Employee } = require('../models');
const AppError = require('../utils/AppError');

// Comments are attributed to an Employee record. A user account isn't always
// linked to one directly (e.g. a SUPER_ADMIN created at org signup) — fall
// back to looking up the Employee by its own userId link before giving up,
// mirroring the same pattern used for asset requests.
async function resolveAuthorEmployeeId(req) {
  if (req.user.employeeId) return req.user.employeeId;
  const employee = await Employee.findOne({ userId: req.user._id, organizationId: req.organizationId, isDeleted: false }).select('_id');
  if (!employee) throw new AppError('Your account is not linked to an employee profile, so it cannot post comments', 400);
  return employee._id;
}

exports.getTaskComments = async (req, res) => {
  const { data, pagination } = await taskCommentService.getTaskComments(req.organizationId, req.params.taskId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getCommentById = async (req, res) => {
  const data = await taskCommentService.getCommentById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createTaskComment = async (req, res) => {
  const authorEmployeeId = await resolveAuthorEmployeeId(req);
  const data = await taskCommentService.createTaskComment(req.organizationId, req.params.taskId, req.body, authorEmployeeId);
  res.status(201).json({ success: true, message: 'Comment added', data });
};

exports.updateTaskComment = async (req, res) => {
  const authorEmployeeId = await resolveAuthorEmployeeId(req);
  const data = await taskCommentService.updateTaskComment(req.organizationId, req.params.id, req.body, authorEmployeeId);
  res.json({ success: true, message: 'Comment updated', data });
};

exports.deleteTaskComment = async (req, res) => {
  const authorEmployeeId = await resolveAuthorEmployeeId(req);
  const userRole = req.user.role;
  const result = await taskCommentService.deleteTaskComment(req.organizationId, req.params.id, authorEmployeeId, userRole);
  res.json(result);
};
