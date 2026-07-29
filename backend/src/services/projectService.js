const { Types } = require('mongoose');
const { Project, Employee, Task } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getProjectRoom, getOrganizationRoom } = require('../socket/socketRooms');

const DEFAULTS = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };

function safeSort(sortBy) {
  const allowed = ['createdAt', 'name', 'key', 'dueDate', 'priority', 'status'];
  return allowed.includes(sortBy) ? sortBy : 'createdAt';
}

async function getProjects(organizationId, filters = {}) {
  const { search, status, priority, owner, department, sortBy, sortOrder, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (status && ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].includes(status)) {
    query.status = status;
  }
  if (priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
    query.priority = priority;
  }
  if (owner) query.ownerId = new Types.ObjectId(owner);
  if (department) query.departmentId = new Types.ObjectId(department);
  if (search && search.trim()) {
    const q = new RegExp(search.trim(), 'i');
    query.$or = [{ name: q }, { key: q }, { description: q }];
  }

  const sort = { [safeSort(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    Project.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
    Project.countDocuments(query),
  ]);

  const items = data.map((i) => ({ ...i, id: i._id.toString() }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getProjectById(organizationId, id) {
  const item = await Project.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('ownerId', 'firstName lastName email employeeId')
    .populate('members', 'firstName lastName email employeeId')
    .populate('departmentId', 'name')
    .lean();
  if (!item) throw new AppError('Project not found', 404);
  return { ...item, id: item._id.toString() };
}

async function createProject(organizationId, payload, userId) {
  const existing = await Project.findOne({
    organizationId: new Types.ObjectId(organizationId),
    key: payload.key.toUpperCase(),
  });
  if (existing) throw new AppError('Project key already exists in this organization', 409);

  if (payload.startDate && payload.dueDate && new Date(payload.dueDate) < new Date(payload.startDate)) {
    throw new AppError('Due date cannot be before start date', 400);
  }

  const owner = await Employee.findOne({
    _id: new Types.ObjectId(payload.ownerId),
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!owner) throw new AppError('Owner not found or does not belong to this organization', 404);

  const item = await Project.create({
    organizationId: new Types.ObjectId(organizationId),
    name: payload.name,
    key: payload.key.toUpperCase(),
    description: payload.description || '',
    status: payload.status || 'PLANNING',
    priority: payload.priority || 'MEDIUM',
    startDate: payload.startDate,
    dueDate: payload.dueDate,
    ownerId: new Types.ObjectId(payload.ownerId),
    createdBy: new Types.ObjectId(userId),
    members: [new Types.ObjectId(payload.ownerId)],
    departmentId: payload.departmentId ? new Types.ObjectId(payload.departmentId) : null,
    progress: 0,
  });

  const populated = await getProjectById(organizationId, item._id);
  const io = getSocketInstance();
  if (io) {
    io.to(getOrganizationRoom(organizationId)).emit(SOCKET_EVENTS.PROJECT_CREATED, populated);
  }
  return populated;
}

async function updateProject(organizationId, id, payload) {
  const item = await Project.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!item) throw new AppError('Project not found', 404);

  if (payload.key && payload.key.toUpperCase() !== item.key) {
    const existing = await Project.findOne({
      organizationId: new Types.ObjectId(organizationId),
      key: payload.key.toUpperCase(),
      _id: { $ne: id },
    });
    if (existing) throw new AppError('Project key already exists in this organization', 409);
  }

  if (payload.startDate && payload.dueDate && new Date(payload.dueDate) < new Date(payload.startDate)) {
    throw new AppError('Due date cannot be before start date', 400);
  }

  if (payload.name) item.name = payload.name;
  if (payload.key) item.key = payload.key.toUpperCase();
  if (payload.description !== undefined) item.description = payload.description;
  if (payload.status && ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].includes(payload.status)) {
    item.status = payload.status;
    if (payload.status === 'COMPLETED' && !item.completedAt) {
      item.completedAt = new Date();
    } else if (payload.status !== 'COMPLETED') {
      item.completedAt = null;
    }
  }
  if (payload.priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(payload.priority)) {
    item.priority = payload.priority;
  }
  if (payload.startDate !== undefined) item.startDate = payload.startDate;
  if (payload.dueDate !== undefined) item.dueDate = payload.dueDate;
  if (payload.ownerId) {
    const owner = await Employee.findOne({
      _id: new Types.ObjectId(payload.ownerId),
      organizationId: new Types.ObjectId(organizationId),
    });
    if (!owner) throw new AppError('Owner not found or does not belong to this organization', 404);
    item.ownerId = new Types.ObjectId(payload.ownerId);
  }
  if (payload.departmentId !== undefined) {
    item.departmentId = payload.departmentId ? new Types.ObjectId(payload.departmentId) : null;
  }

  await item.save();
  const populated = await getProjectById(organizationId, item._id);
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(id)).emit(SOCKET_EVENTS.PROJECT_UPDATED, populated);
  }
  return populated;
}

async function deleteProject(organizationId, id) {
  const item = await Project.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!item) throw new AppError('Project not found', 404);
  await Project.deleteOne({ _id: id });
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(id)).emit(SOCKET_EVENTS.PROJECT_DELETED, { id });
  }
  return { success: true, message: 'Project deleted' };
}

async function addProjectMember(organizationId, projectId, employeeId) {
  const project = await Project.findOne({
    _id: projectId,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!project) throw new AppError('Project not found', 404);

  const employee = await Employee.findOne({
    _id: new Types.ObjectId(employeeId),
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!employee) throw new AppError('Employee not found or does not belong to this organization', 404);

  if (project.members.includes(new Types.ObjectId(employeeId))) {
    throw new AppError('Employee is already a project member', 400);
  }

  project.members.push(new Types.ObjectId(employeeId));
  await project.save();
  const populated = await getProjectById(organizationId, projectId);
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(projectId)).emit(SOCKET_EVENTS.PROJECT_MEMBER_ADDED, { projectId, employeeId, member: employee });
  }
  return populated;
}

async function removeProjectMember(organizationId, projectId, employeeId) {
  const project = await Project.findOne({
    _id: projectId,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!project) throw new AppError('Project not found', 404);

  project.members = project.members.filter((m) => m.toString() !== employeeId);
  await project.save();
  const populated = await getProjectById(organizationId, projectId);
  const io = getSocketInstance();
  if (io) {
    io.to(getProjectRoom(projectId)).emit(SOCKET_EVENTS.PROJECT_MEMBER_REMOVED, { projectId, employeeId });
  }
  return populated;
}

async function calculateProjectProgress(organizationId, projectId) {
  const project = await Project.findOne({
    _id: projectId,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!project) throw new AppError('Project not found', 404);

  const totalTasks = await Task.countDocuments({
    organizationId: new Types.ObjectId(organizationId),
    projectId: new Types.ObjectId(projectId),
  });
  const completedTasks = await Task.countDocuments({
    organizationId: new Types.ObjectId(organizationId),
    projectId: new Types.ObjectId(projectId),
    status: 'DONE',
  });

  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  project.progress = progress;
  await project.save();

  return { progress, totalTasks, completedTasks };
}

async function getProjectStatistics(organizationId, projectId) {
  const project = await Project.findOne({
    _id: projectId,
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!project) throw new AppError('Project not found', 404);

  const [totalTasks, completed, inProgress, blocked, overdue] = await Promise.all([
    Task.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      projectId: new Types.ObjectId(projectId),
    }),
    Task.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      projectId: new Types.ObjectId(projectId),
      status: 'DONE',
    }),
    Task.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      projectId: new Types.ObjectId(projectId),
      status: 'IN_PROGRESS',
    }),
    Task.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      projectId: new Types.ObjectId(projectId),
      status: 'BLOCKED',
    }),
    Task.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      projectId: new Types.ObjectId(projectId),
      dueDate: { $lt: new Date() },
      status: { $ne: 'DONE' },
    }),
  ]);

  return {
    totalTasks,
    completed,
    inProgress,
    blocked,
    overdue,
    progress: project.progress,
    memberCount: project.members.length,
  };
}

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  calculateProjectProgress,
  getProjectStatistics,
};
