const { Types } = require('mongoose');
const { OnboardingProcess, OnboardingTask, OnboardingTemplate, Employee, User } = require('../models');
const AppError = require('../utils/AppError');

const DEFAULTS = { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' };

function safeSort(sortBy) {
  const allowed = ['createdAt', 'startDate', 'targetDate', 'status', 'progress'];
  return allowed.includes(sortBy) ? sortBy : 'createdAt';
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function recalculateProgress(processId) {
  const process = await OnboardingProcess.findById(processId);
  if (!process || ['CANCELLED'].includes(process.status)) return process;

  const tasks = await OnboardingTask.find({ processId: process._id }).lean();
  const relevant = tasks.filter((t) => t.status !== 'SKIPPED');
  const completed = relevant.filter((t) => t.status === 'COMPLETED');

  process.progress = relevant.length === 0 ? 0 : Math.round((completed.length / relevant.length) * 100);

  if (tasks.length > 0 && relevant.length > 0 && completed.length === relevant.length) {
    process.status = 'COMPLETED';
    process.completedAt = process.completedAt || new Date();
  } else if (tasks.some((t) => t.status !== 'PENDING')) {
    process.status = 'IN_PROGRESS';
    process.completedAt = undefined;
  }

  await process.save();
  return process;
}

async function resolveAssignee(organizationId, role, employee) {
  if (role === 'EMPLOYEE') return employee.userId || null;
  const user = await User.findOne({ organizationId, role, status: 'active' }).sort({ createdAt: 1 }).lean();
  return user ? user._id : null;
}

async function getProcesses(organizationId, filters = {}) {
  const { search, type, status, employeeId, sortBy, sortOrder, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (type && ['ONBOARDING', 'OFFBOARDING'].includes(type)) query.type = type;
  if (status && ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) query.status = status;
  if (employeeId && Types.ObjectId.isValid(employeeId)) query.employeeId = new Types.ObjectId(employeeId);
  if (search && search.trim()) {
    query.title = new RegExp(search.trim(), 'i');
  }

  const sort = { [safeSort(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    OnboardingProcess.find(query)
      .populate('employeeId', 'firstName lastName email avatar jobTitle departmentId')
      .populate('templateId', 'name type')
      .populate('initiatedBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    OnboardingProcess.countDocuments(query),
  ]);

  const items = data.map((i) => ({ ...i, id: i._id.toString() }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getProcessById(organizationId, id) {
  const process = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('employeeId', 'firstName lastName email avatar jobTitle departmentId')
    .populate('templateId', 'name type')
    .populate('initiatedBy', 'firstName lastName')
    .populate('cancelledBy', 'firstName lastName')
    .lean();
  if (!process) throw new AppError('Process not found', 404);

  const tasks = await OnboardingTask.find({ processId: process._id })
    .populate('assigneeId', 'firstName lastName email avatar role')
    .populate('completedBy', 'firstName lastName')
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return {
    ...process,
    id: process._id.toString(),
    tasks: tasks.map((t) => ({ ...t, id: t._id.toString() })),
  };
}

async function createProcess(organizationId, payload, user) {
  const orgId = new Types.ObjectId(organizationId);

  const employee = await Employee.findOne({ _id: payload.employeeId, organizationId: orgId, isDeleted: false });
  if (!employee) throw new AppError('Employee not found', 404);

  const existing = await OnboardingProcess.findOne({
    organizationId: orgId,
    employeeId: employee._id,
    type: payload.type,
    status: { $in: ['NOT_STARTED', 'IN_PROGRESS'] },
  });
  if (existing) throw new AppError(`An active ${payload.type.toLowerCase()} process already exists for this employee`, 409);

  let template = null;
  if (payload.templateId) {
    template = await OnboardingTemplate.findOne({ _id: payload.templateId, organizationId: orgId, status: 'ACTIVE' });
    if (!template) throw new AppError('Template not found or inactive', 404);
    if (template.type !== payload.type) throw new AppError('Template type does not match process type', 400);
  }

  const startDate = payload.startDate ? new Date(payload.startDate) : new Date();

  const process = await OnboardingProcess.create({
    organizationId: orgId,
    employeeId: employee._id,
    templateId: template ? template._id : undefined,
    type: payload.type,
    title:
      payload.title ||
      `${payload.type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} — ${employee.firstName} ${employee.lastName}`,
    startDate,
    targetDate: payload.targetDate ? new Date(payload.targetDate) : undefined,
    initiatedBy: user._id,
    notes: payload.notes || '',
  });

  if (template && template.tasks.length > 0) {
    const taskDocs = await Promise.all(
      template.tasks.map(async (t) => ({
        organizationId: orgId,
        processId: process._id,
        title: t.title,
        description: t.description,
        category: t.category,
        assigneeId: await resolveAssignee(orgId, t.defaultAssigneeRole, employee),
        dueDate: addDays(startDate, t.dueOffsetDays || 0),
        order: t.order,
        isRequired: t.isRequired,
      }))
    );
    await OnboardingTask.insertMany(taskDocs);
  }

  return getProcessById(organizationId, process._id);
}

async function updateProcess(organizationId, id, payload) {
  const process = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!process) throw new AppError('Process not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Cannot update a ${process.status.toLowerCase()} process`, 400);

  if (payload.title) process.title = payload.title;
  if (payload.startDate) process.startDate = new Date(payload.startDate);
  if (payload.targetDate !== undefined) process.targetDate = payload.targetDate ? new Date(payload.targetDate) : undefined;
  if (payload.notes !== undefined) process.notes = payload.notes;

  await process.save();
  return getProcessById(organizationId, process._id);
}

async function cancelProcess(organizationId, id, user, reason) {
  const process = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!process) throw new AppError('Process not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Process is already ${process.status.toLowerCase()}`, 400);

  process.status = 'CANCELLED';
  process.cancelledAt = new Date();
  process.cancelledBy = user._id;
  process.cancellationReason = reason || '';
  await process.save();

  return getProcessById(organizationId, process._id);
}

async function addTask(organizationId, processId, payload) {
  const orgId = new Types.ObjectId(organizationId);
  const process = await OnboardingProcess.findOne({ _id: processId, organizationId: orgId });
  if (!process) throw new AppError('Process not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Cannot add tasks to a ${process.status.toLowerCase()} process`, 400);

  const lastTask = await OnboardingTask.findOne({ processId: process._id }).sort({ order: -1 }).lean();

  await OnboardingTask.create({
    organizationId: orgId,
    processId: process._id,
    title: payload.title,
    description: payload.description || '',
    category: payload.category || 'OTHER',
    assigneeId: payload.assigneeId || undefined,
    dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    order: lastTask ? lastTask.order + 1 : 0,
    isRequired: payload.isRequired !== false,
    notes: payload.notes || '',
  });

  await recalculateProgress(process._id);
  return getProcessById(organizationId, process._id);
}

async function updateTask(organizationId, taskId, payload) {
  const task = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) });
  if (!task) throw new AppError('Task not found', 404);

  if (payload.title) task.title = payload.title;
  if (payload.description !== undefined) task.description = payload.description;
  if (payload.category) task.category = payload.category;
  if (payload.assigneeId !== undefined) task.assigneeId = payload.assigneeId || undefined;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate ? new Date(payload.dueDate) : undefined;
  if (payload.isRequired !== undefined) task.isRequired = payload.isRequired;
  if (payload.notes !== undefined) task.notes = payload.notes;

  await task.save();
  return getProcessById(organizationId, task.processId);
}

async function updateTaskStatus(organizationId, taskId, status, user) {
  const task = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) });
  if (!task) throw new AppError('Task not found', 404);

  const process = await OnboardingProcess.findById(task.processId);
  if (process && process.status === 'CANCELLED') throw new AppError('Cannot update tasks of a cancelled process', 400);

  task.status = status;
  if (status === 'COMPLETED') {
    task.completedAt = new Date();
    task.completedBy = user._id;
  } else {
    task.completedAt = undefined;
    task.completedBy = undefined;
  }

  await task.save();
  await recalculateProgress(task.processId);
  return getProcessById(organizationId, task.processId);
}

async function deleteTask(organizationId, taskId) {
  const task = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) });
  if (!task) throw new AppError('Task not found', 404);

  const processId = task.processId;
  await task.deleteOne();
  await recalculateProgress(processId);
  return getProcessById(organizationId, processId);
}

async function getMyTasks(organizationId, userId, filters = {}) {
  const { status, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId), assigneeId: new Types.ObjectId(userId) };
  if (status && ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'].includes(status)) query.status = status;

  const [data, total] = await Promise.all([
    OnboardingTask.find(query)
      .populate({
        path: 'processId',
        select: 'title type status employeeId',
        populate: { path: 'employeeId', select: 'firstName lastName avatar' },
      })
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    OnboardingTask.countDocuments(query),
  ]);

  const items = data.map((i) => ({ ...i, id: i._id.toString() }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

module.exports = {
  getProcesses,
  getProcessById,
  createProcess,
  updateProcess,
  cancelProcess,
  addTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getMyTasks,
};
