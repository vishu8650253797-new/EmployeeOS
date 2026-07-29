const { Types } = require('mongoose');
const { TaskActivity, Employee } = require('../models');
const AppError = require('../utils/AppError');

const DEFAULTS = { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' };

async function getTaskActivities(organizationId, taskId, filters = {}) {
  const { page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {
    organizationId: new Types.ObjectId(organizationId),
    taskId: new Types.ObjectId(taskId),
  };

  const [data, total] = await Promise.all([
    TaskActivity.find(query)
      .populate('actorId', 'firstName lastName email employeeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    TaskActivity.countDocuments(query),
  ]);

  const items = data.map((i) => ({ ...i, id: i._id.toString() }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function createTaskActivity(organizationId, taskId, actorEmployeeId, action, metadata = {}) {
  const employee = await Employee.findOne({
    _id: new Types.ObjectId(actorEmployeeId),
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!employee) throw new AppError('Employee not found', 404);

  const validActions = [
    'TASK_CREATED',
    'TASK_UPDATED',
    'TASK_ASSIGNED',
    'TASK_UNASSIGNED',
    'STATUS_CHANGED',
    'PRIORITY_CHANGED',
    'COMMENT_ADDED',
    'COMMENT_UPDATED',
    'COMMENT_DELETED',
    'TASK_COMPLETED',
  ];

  if (!validActions.includes(action)) {
    throw new AppError('Invalid action', 400);
  }

  const item = await TaskActivity.create({
    organizationId: new Types.ObjectId(organizationId),
    taskId: new Types.ObjectId(taskId),
    actorId: new Types.ObjectId(actorEmployeeId),
    action,
    metadata,
  });

  return item;
}

module.exports = {
  getTaskActivities,
  createTaskActivity,
};
