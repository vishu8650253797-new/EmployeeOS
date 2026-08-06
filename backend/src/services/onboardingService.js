const { Types } = require('mongoose');
const {
  OnboardingProcess, OnboardingTask, OnboardingTemplate, Employee, User,
} = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const notificationService = require('./notificationService');
const auditLogService = require('./auditLogService');
const onboardingAccess = require('../utils/onboardingAccess');

const DEFAULTS = { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' };
const VALID_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

function emitToOrg(organizationId, event, payload) {
  const io = getSocketInstance();
  if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
}

async function recordAudit(organizationId, userId, action, entityType, entityId, metadata = {}, reqMeta = {}) {
  return auditLogService.recordAction({
    organizationId, userId, action, entityType, entityId, metadata, ...reqMeta,
  });
}

async function notifyHR(organizationId, type, title, message, entityType, entityId) {
  const hrUsers = await User.find({
    organizationId: new Types.ObjectId(organizationId),
    role: { $in: ['SUPER_ADMIN', 'HR_ADMIN'] },
    status: 'active',
  }).select('_id').lean();
  await Promise.all(
    hrUsers.map((u) =>
      notificationService.createNotification({
        organizationId, recipientId: u._id, type, title, message, entityType, entityId,
      })
    )
  );
}

async function notifyUser(userId, organizationId, type, title, message, entityType, entityId) {
  if (!userId) return;
  await notificationService.createNotification({
    organizationId, recipientId: userId, type, title, message, entityType, entityId,
  });
}

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
  if (role === 'MANAGER' && employee.managerId) {
    const managerEmployee = await Employee.findById(employee.managerId).select('userId').lean();
    if (managerEmployee && managerEmployee.userId) return managerEmployee.userId;
  }
  const user = await User.findOne({ organizationId, role, status: 'active' }).sort({ createdAt: 1 }).lean();
  return user ? user._id : null;
}

async function getProcesses(organizationId, filters = {}, user) {
  const { search, type, status, employeeId, sortBy, sortOrder, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  let query = { organizationId: new Types.ObjectId(organizationId) };
  if (type && ['ONBOARDING', 'OFFBOARDING'].includes(type)) query.type = type;
  if (status && ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) query.status = status;

  if (employeeId && Types.ObjectId.isValid(employeeId)) {
    query.employeeId = new Types.ObjectId(employeeId);
  }

  query = await onboardingAccess.restrictEmployeeIdQuery(query, user);

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

async function getProcessById(organizationId, id, user) {
  const process = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('employeeId', 'firstName lastName email avatar jobTitle departmentId')
    .populate('templateId', 'name type')
    .populate('initiatedBy', 'firstName lastName')
    .populate('cancelledBy', 'firstName lastName')
    .lean();
  if (!process) throw new AppError('Process not found', 404);

  await onboardingAccess.authorizeProcess(process, user);

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

async function createProcess(organizationId, payload, user, reqMeta = {}) {
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
    if (!template.tasks || template.tasks.length === 0) throw new AppError('Template has no tasks', 400);
  }

  const startDate = payload.startDate ? new Date(payload.startDate) : new Date();
  const targetDate = payload.targetDate ? new Date(payload.targetDate) : undefined;
  if (targetDate && targetDate < startDate) throw new AppError('Target date cannot be before start date', 400);

  const process = await OnboardingProcess.create({
    organizationId: orgId,
    employeeId: employee._id,
    templateId: template ? template._id : undefined,
    type: payload.type,
    title:
      payload.title ||
      `${payload.type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} — ${employee.firstName} ${employee.lastName}`,
    startDate,
    targetDate,
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

  emitToOrg(
    orgId,
    SOCKET_EVENTS.ONBOARDING_PROCESS_CREATED,
    { processId: process._id.toString(), type: process.type, employeeId: employee._id.toString() }
  );

  await notifyHR(
    orgId,
    `${process.type}_PROCESS_CREATED`,
    `${process.type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} started`,
    `${process.title} was started for ${employee.firstName} ${employee.lastName}`,
    'OnboardingProcess',
    process._id
  );

  if (employee.userId) {
    await notifyUser(
      employee.userId,
      orgId,
      `${process.type}_PROCESS_CREATED`,
      `Your ${process.type === 'ONBOARDING' ? 'onboarding' : 'offboarding'} has started`,
      `${process.title} — please check your tasks`,
      'OnboardingProcess',
      process._id
    );
  }

  await recordAudit(organizationId, user._id, `${process.type}_PROCESS_CREATED`, 'OnboardingProcess', process._id, { templateId: template?._id?.toString() }, reqMeta);

  return getProcessById(organizationId, process._id, user);
}

async function updateProcess(organizationId, id, payload, user, reqMeta = {}) {
  const process = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!process) throw new AppError('Process not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Cannot update a ${process.status.toLowerCase()} process`, 400);
  await onboardingAccess.canEditProcess(process, user);

  if (payload.title) process.title = payload.title;
  if (payload.startDate) {
    process.startDate = new Date(payload.startDate);
  }
  if (payload.targetDate !== undefined) {
    process.targetDate = payload.targetDate ? new Date(payload.targetDate) : undefined;
  }
  if (process.targetDate && process.targetDate < process.startDate) {
    throw new AppError('Target date cannot be before start date', 400);
  }
  if (payload.notes !== undefined) process.notes = payload.notes;

  await process.save();
  await recordAudit(organizationId, user._id, 'PROCESS_UPDATED', 'OnboardingProcess', process._id, { changes: Object.keys(payload) }, reqMeta);
  emitToOrg(
    organizationId,
    SOCKET_EVENTS.ONBOARDING_PROCESS_UPDATED,
    { processId: process._id.toString(), type: process.type }
  );
  return getProcessById(organizationId, process._id, user);
}

async function cancelProcess(organizationId, id, user, reason, reqMeta = {}) {
  const process = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!process) throw new AppError('Process not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Process is already ${process.status.toLowerCase()}`, 400);
  await onboardingAccess.canEditProcess(process, user);

  process.status = 'CANCELLED';
  process.cancelledAt = new Date();
  process.cancelledBy = user._id;
  process.cancellationReason = reason || '';
  await process.save();

  await recordAudit(organizationId, user._id, 'PROCESS_CANCELLED', 'OnboardingProcess', process._id, { reason }, reqMeta);
  emitToOrg(
    organizationId,
    SOCKET_EVENTS.ONBOARDING_PROCESS_CANCELLED,
    { processId: process._id.toString(), type: process.type, reason }
  );

  const employee = await Employee.findById(process.employeeId).select('userId firstName lastName').lean();
  if (employee && employee.userId) {
    await notifyUser(
      employee.userId,
      organizationId,
      'PROCESS_CANCELLED',
      `Your ${process.type === 'ONBOARDING' ? 'onboarding' : 'offboarding'} was cancelled`,
      `${process.title} — ${reason || 'No reason provided'}`,
      'OnboardingProcess',
      process._id
    );
  }

  return getProcessById(organizationId, process._id, user);
}

async function addTask(organizationId, processId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const process = await OnboardingProcess.findOne({ _id: processId, organizationId: orgId });
  if (!process) throw new AppError('Process not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Cannot add tasks to a ${process.status.toLowerCase()} process`, 400);
  await onboardingAccess.canEditProcess(process, user);

  const lastTask = await OnboardingTask.findOne({ processId: process._id }).sort({ order: -1 }).lean();

  const task = await OnboardingTask.create({
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

  if (process.status === 'NOT_STARTED') {
    process.status = 'IN_PROGRESS';
    await process.save();
  }

  await recalculateProgress(process._id);
  await recordAudit(organizationId, user._id, 'TASK_ADDED', 'OnboardingTask', task._id, { processId: process._id.toString(), assigneeId: task.assigneeId?.toString() }, reqMeta);

  if (task.assigneeId && task.assigneeId.toString() !== user._id.toString()) {
    await notifyUser(
      task.assigneeId,
      orgId,
      'TASK_ASSIGNED',
      'New onboarding task assigned',
      `Task "${task.title}" was assigned to you in ${process.title}`,
      'OnboardingTask',
      task._id
    );
    emitToOrg(orgId, SOCKET_EVENTS.ONBOARDING_TASK_ASSIGNED, {
      taskId: task._id.toString(), processId: process._id.toString(), assigneeId: task.assigneeId.toString(),
    });
  }

  return getProcessById(organizationId, process._id, user);
}

async function updateTask(organizationId, taskId, payload, user, reqMeta = {}) {
  const task = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) });
  if (!task) throw new AppError('Task not found', 404);

  const previousAssignee = task.assigneeId ? task.assigneeId.toString() : null;
  const process = await OnboardingProcess.findById(task.processId);
  if (!process || ['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Cannot edit tasks in a ${process?.status?.toLowerCase() || 'unknown'} process`, 400);
  await onboardingAccess.canEditTask(task, user);

  if (payload.title) task.title = payload.title;
  if (payload.description !== undefined) task.description = payload.description;
  if (payload.category) task.category = payload.category;
  if (payload.assigneeId !== undefined) task.assigneeId = payload.assigneeId || undefined;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate ? new Date(payload.dueDate) : undefined;
  if (payload.isRequired !== undefined) task.isRequired = payload.isRequired;
  if (payload.notes !== undefined) task.notes = payload.notes;

  await task.save();

  const newAssignee = task.assigneeId ? task.assigneeId.toString() : null;
  if (newAssignee && newAssignee !== previousAssignee && newAssignee !== user._id.toString()) {
    await notifyUser(
      task.assigneeId,
      organizationId,
      'TASK_ASSIGNED',
      'Onboarding task assigned to you',
      `Task "${task.title}" in ${process.title} is now your responsibility`,
      'OnboardingTask',
      task._id
    );
    emitToOrg(organizationId, SOCKET_EVENTS.ONBOARDING_TASK_ASSIGNED, {
      taskId: task._id.toString(), processId: process._id.toString(), assigneeId: task.assigneeId.toString(),
    });
  }

  await recordAudit(organizationId, user._id, 'TASK_UPDATED', 'OnboardingTask', task._id, { changed: Object.keys(payload) }, reqMeta);
  return getProcessById(organizationId, task.processId, user);
}

async function updateTaskStatus(organizationId, taskId, status, user, reqMeta = {}) {
  const task = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) });
  if (!task) throw new AppError('Task not found', 404);
  await onboardingAccess.canEditTask(task, user);

  const process = await OnboardingProcess.findById(task.processId);
  if (process && process.status === 'CANCELLED') throw new AppError('Cannot update tasks of a cancelled process', 400);
  if (process && ['NOT_STARTED'].includes(process.status)) {
    process.status = 'IN_PROGRESS';
    await process.save();
  }

  const previousStatus = task.status;
  if (!VALID_TASK_STATUSES.includes(status)) {
    throw new AppError(`Invalid task status ${status}`, 400);
  }
  if (status === previousStatus) {
    throw new AppError(`Task is already ${previousStatus.toLowerCase()}`, 400);
  }
  if (status === 'SKIPPED' && task.isRequired) {
    throw new AppError('Required tasks cannot be skipped', 400);
  }

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

  await recordAudit(organizationId, user._id, 'TASK_STATUS_CHANGED', 'OnboardingTask', task._id, { from: previousStatus, to: status }, reqMeta);
  emitToOrg(
    organizationId,
    SOCKET_EVENTS.ONBOARDING_TASK_STATUS_CHANGED,
    { taskId: task._id.toString(), processId: task.processId.toString(), from: previousStatus, to: status }
  );

  if (status === 'COMPLETED') {
    const completedProcess = await OnboardingProcess.findById(task.processId);
    if (completedProcess && completedProcess.status === 'COMPLETED') {
      emitToOrg(organizationId, SOCKET_EVENTS.ONBOARDING_PROCESS_COMPLETED, {
        processId: completedProcess._id.toString(), type: completedProcess.type,
      });
      await notifyHR(organizationId, 'PROCESS_COMPLETED', 'Process completed', `${completedProcess.title} is fully complete`, 'OnboardingProcess', completedProcess._id);
    }
  }

  return getProcessById(organizationId, task.processId, user);
}

async function deleteTask(organizationId, taskId, user, reqMeta = {}) {
  const task = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) });
  if (!task) throw new AppError('Task not found', 404);

  const process = await OnboardingProcess.findById(task.processId);
  if (process && ['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Cannot delete tasks in a ${process.status.toLowerCase()} process`, 400);
  if (!onboardingAccess.FULL_ROLES.includes(user.role) && task.assigneeId && task.assigneeId.toString() !== user._id.toString()) {
    throw new AppError('Forbidden: cannot delete this task', 403);
  }

  const processId = task.processId;
  await task.deleteOne();
  await recalculateProgress(processId);
  await recordAudit(organizationId, user._id, 'TASK_DELETED', 'OnboardingTask', task._id, { processId: processId.toString() }, reqMeta);
  return getProcessById(organizationId, processId, user);
}

async function getMyTasks(organizationId, user, filters = {}) {
  const { status, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId), assigneeId: new Types.ObjectId(user._id) };
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
