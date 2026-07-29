const { Types } = require('mongoose');
const { TaskComment, Employee, Task } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getProjectRoom } = require('../socket/socketRooms');

const DEFAULTS = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };

async function getTaskComments(organizationId, taskId, filters = {}) {
  const { page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {
    organizationId: new Types.ObjectId(organizationId),
    taskId: new Types.ObjectId(taskId),
  };

  const [data, total] = await Promise.all([
    TaskComment.find(query)
      .populate('authorId', 'firstName lastName email employeeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    TaskComment.countDocuments(query),
  ]);

  const items = data.map((i) => ({ ...i, id: i._id.toString() }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getCommentById(organizationId, id) {
  const item = await TaskComment.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
  })
    .populate('authorId', 'firstName lastName email employeeId')
    .populate('taskId', 'taskKey title')
    .lean();
  if (!item) throw new AppError('Comment not found', 404);
  return { ...item, id: item._id.toString() };
}

async function createTaskComment(organizationId, taskId, payload, authorEmployeeId) {
  const task = await Task.findOne({
    _id: taskId,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!task) throw new AppError('Task not found', 404);

  const employee = await Employee.findOne({
    _id: new Types.ObjectId(authorEmployeeId),
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!employee) throw new AppError('Employee not found', 404);

  const item = await TaskComment.create({
    organizationId: new Types.ObjectId(organizationId),
    taskId: new Types.ObjectId(taskId),
    authorId: new Types.ObjectId(authorEmployeeId),
    content: payload.content,
  });

  const populated = await getCommentById(organizationId, item._id);
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(taskId)).emit(SOCKET_EVENTS.TASK_COMMENT_ADDED, populated);
  }
  return populated;
}

async function updateTaskComment(organizationId, id, payload, authorEmployeeId) {
  const item = await TaskComment.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!item) throw new AppError('Comment not found', 404);

  if (item.authorId.toString() !== authorEmployeeId) {
    throw new AppError('You can only edit your own comments', 403);
  }

  if (payload.content) item.content = payload.content;
  await item.save();

  return getCommentById(organizationId, item._id);
}

async function deleteTaskComment(organizationId, id, authorEmployeeId, userRole) {
  const item = await TaskComment.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!item) throw new AppError('Comment not found', 404);

  const isOwner = item.authorId.toString() === authorEmployeeId;
  const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(userRole);

  if (!isOwner && !isAdmin) {
    throw new AppError('You can only delete your own comments', 403);
  }

  await TaskComment.deleteOne({ _id: id });
  return { success: true, message: 'Comment deleted' };
}

module.exports = {
  getTaskComments,
  getCommentById,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
};
