const { Types } = require('mongoose');
const { Task, Employee, Project } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getProjectRoom } = require('../socket/socketRooms');

const DEFAULTS = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };

function safeSort(sortBy) {
  const allowed = ['createdAt', 'title', 'taskKey', 'dueDate', 'priority', 'status'];
  return allowed.includes(sortBy) ? sortBy : 'createdAt';
}

async function getTasks(organizationId, filters = {}) {
  const {
    projectId,
    status,
    priority,
    assignee,
    reporter,
    label,
    dueDate,
    search,
    sortBy,
    sortOrder,
    page,
    limit,
  } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (projectId) query.projectId = new Types.ObjectId(projectId);
  if (status && ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'].includes(status)) {
    query.status = status;
  }
  if (priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
    query.priority = priority;
  }
  if (assignee) query.assigneeIds = new Types.ObjectId(assignee);
  if (reporter) query.reporterId = new Types.ObjectId(reporter);
  if (label) query.labels = label;
  if (dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate === 'overdue') {
      query.dueDate = { $lt: today };
      query.status = { $ne: 'DONE' };
    } else if (dueDate === 'today') {
      query.dueDate = { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    } else if (dueDate === 'week') {
      const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      query.dueDate = { $gte: today, $lte: weekEnd };
    }
  }
  if (search && search.trim()) {
    const q = new RegExp(search.trim(), 'i');
    query.$or = [{ title: q }, { taskKey: q }, { description: q }];
  }

  const sort = { [safeSort(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    Task.find(query)
      .populate('projectId', 'name key')
      .populate('assigneeIds', 'firstName lastName email employeeId')
      .populate('reporterId', 'firstName lastName email employeeId')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Task.countDocuments(query),
  ]);

  const items = data.map((i) => ({ ...i, id: i._id.toString() }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getTaskById(organizationId, id) {
  const item = await Task.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('projectId', 'name key status')
    .populate('assigneeIds', 'firstName lastName email employeeId')
    .populate('reporterId', 'firstName lastName email employeeId')
    .populate('parentTaskId', 'taskKey title')
    .lean();
  if (!item) throw new AppError('Task not found', 404);
  return { ...item, id: item._id.toString() };
}

async function generateTaskKey(organizationId, projectId) {
  const project = await Project.findOne({
    _id: projectId,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!project) throw new AppError('Project not found', 404);

  const count = await Task.countDocuments({
    organizationId: new Types.ObjectId(organizationId),
    projectId: new Types.ObjectId(projectId),
  });
  const taskNumber = String(count + 1).padStart(3, '0');
  return `${project.key}-TASK-${taskNumber}`;
}

async function createTask(organizationId, payload, userId, reporterEmployeeId) {
  const project = await Project.findOne({
    _id: payload.projectId,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!project) throw new AppError('Project not found', 404);

  if (payload.startDate && payload.dueDate && new Date(payload.dueDate) < new Date(payload.startDate)) {
    throw new AppError('Due date cannot be before start date', 400);
  }

  if (payload.assigneeIds && payload.assigneeIds.length > 0) {
    const employees = await Employee.find({
      _id: { $in: payload.assigneeIds },
      organizationId: new Types.ObjectId(organizationId),
      status: 'active',
    });
    if (employees.length !== payload.assigneeIds.length) {
      throw new AppError('One or more assignees not found or inactive', 404);
    }
  }

  const taskKey = await generateTaskKey(organizationId, payload.projectId);

  const item = await Task.create({
    organizationId: new Types.ObjectId(organizationId),
    projectId: new Types.ObjectId(payload.projectId),
    title: payload.title,
    description: payload.description || '',
    taskKey,
    status: payload.status || 'TODO',
    priority: payload.priority || 'MEDIUM',
    assigneeIds: payload.assigneeIds ? payload.assigneeIds.map((id) => new Types.ObjectId(id)) : [],
    reporterId: new Types.ObjectId(reporterEmployeeId),
    createdBy: new Types.ObjectId(userId),
    startDate: payload.startDate,
    dueDate: payload.dueDate,
    estimatedHours: payload.estimatedHours || 0,
    actualHours: 0,
    labels: payload.labels || [],
    parentTaskId: payload.parentTaskId ? new Types.ObjectId(payload.parentTaskId) : null,
  });

  const populated = await getTaskById(organizationId, item._id);
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(payload.projectId)).emit(SOCKET_EVENTS.TASK_CREATED, populated);
  }
  return populated;
}

async function updateTask(organizationId, id, payload) {
  const item = await Task.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!item) throw new AppError('Task not found', 404);

  if (payload.startDate && payload.dueDate && new Date(payload.dueDate) < new Date(payload.startDate)) {
    throw new AppError('Due date cannot be before start date', 400);
  }

  if (payload.assigneeIds) {
    const employees = await Employee.find({
      _id: { $in: payload.assigneeIds },
      organizationId: new Types.ObjectId(organizationId),
      status: 'active',
    });
    if (employees.length !== payload.assigneeIds.length) {
      throw new AppError('One or more assignees not found or inactive', 404);
    }
    item.assigneeIds = payload.assigneeIds.map((id) => new Types.ObjectId(id));
  }

  if (payload.title) item.title = payload.title;
  if (payload.description !== undefined) item.description = payload.description;
  if (payload.status && ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'].includes(payload.status)) {
    const oldStatus = item.status;
    item.status = payload.status;
    if (payload.status === 'DONE' && !item.completedAt) {
      item.completedAt = new Date();
    } else if (payload.status !== 'DONE') {
      item.completedAt = null;
    }
  }
  if (payload.priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(payload.priority)) {
    item.priority = payload.priority;
  }
  if (payload.startDate !== undefined) item.startDate = payload.startDate;
  if (payload.dueDate !== undefined) item.dueDate = payload.dueDate;
  if (payload.estimatedHours !== undefined) item.estimatedHours = payload.estimatedHours;
  if (payload.actualHours !== undefined) item.actualHours = payload.actualHours;
  if (payload.labels) item.labels = payload.labels;
  if (payload.parentTaskId !== undefined) {
    item.parentTaskId = payload.parentTaskId ? new Types.ObjectId(payload.parentTaskId) : null;
  }

  await item.save();
  const populated = await getTaskById(organizationId, item._id);
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(item.projectId.toString())).emit(SOCKET_EVENTS.TASK_UPDATED, populated);
  }
  return populated;
}

async function deleteTask(organizationId, id) {
  const item = await Task.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!item) throw new AppError('Task not found', 404);
  const projectId = item.projectId.toString();
  await Task.deleteOne({ _id: id });
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(projectId)).emit(SOCKET_EVENTS.TASK_DELETED, { id });
  }
  return { success: true, message: 'Task deleted' };
}

async function updateTaskStatus(organizationId, id, status) {
  const item = await Task.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!item) throw new AppError('Task not found', 404);

  if (!['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const oldStatus = item.status;
  item.status = status;
  if (status === 'DONE' && !item.completedAt) {
    item.completedAt = new Date();
  } else if (status !== 'DONE') {
    item.completedAt = null;
  }

  await item.save();
  const populated = { ...item, id: item._id.toString(), oldStatus };
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(item.projectId.toString())).emit(SOCKET_EVENTS.TASK_STATUS_CHANGED, {
      taskId: id,
      projectId: item.projectId.toString(),
      oldStatus,
      newStatus: status,
    });
  }
  return populated;
}

async function assignTask(organizationId, id, assigneeIds) {
  const item = await Task.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!item) throw new AppError('Task not found', 404);

  const employees = await Employee.find({
    _id: { $in: assigneeIds },
    organizationId: new Types.ObjectId(organizationId),
    status: 'active',
  });
  if (employees.length !== assigneeIds.length) {
    throw new AppError('One or more assignees not found or inactive', 404);
  }

  const oldAssigneeIds = [...item.assigneeIds];
  item.assigneeIds = assigneeIds.map((id) => new Types.ObjectId(id));
  await item.save();

  const populated = { ...item, id: item._id.toString(), oldAssigneeIds };
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(item.projectId.toString())).emit(SOCKET_EVENTS.TASK_ASSIGNED, {
      taskId: id,
      projectId: item.projectId.toString(),
      assigneeIds,
    });
  }
  return populated;
}

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  assignTask,
};
