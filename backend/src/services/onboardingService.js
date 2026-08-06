const { Types } = require('mongoose');
const {
  OnboardingProcess, OnboardingTask, OnboardingTemplate, DocumentRequest, Employee, User,
} = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const { withTransaction } = require('../utils/withTransaction');
const notificationService = require('./notificationService');
const auditLogService = require('./auditLogService');
const emailService = require('./emailService');
const documentRequestService = require('./documentRequestService');
const onboardingAccess = require('../utils/onboardingAccess');

const DEFAULTS = { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' };
const VALID_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[onboarding] socket emit failed:', err);
  }
}

async function recordAudit(organizationId, userId, action, entityType, entityId, metadata = {}, reqMeta = {}, session) {
  return auditLogService.recordAction({
    organizationId, userId, action, entityType, entityId, metadata, session, ...reqMeta,
  });
}

// Best-effort notifications: a failure here must never roll back or fail a mutation that already succeeded.
async function notifyHR(organizationId, type, title, message, entityType, entityId) {
  try {
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
  } catch (err) {
    console.error('[onboarding] notifyHR failed:', err);
  }
}

async function notifyUser(userId, organizationId, type, title, message, entityType, entityId) {
  if (!userId) return;
  try {
    await notificationService.createNotification({
      organizationId, recipientId: userId, type, title, message, entityType, entityId,
    });
  } catch (err) {
    console.error('[onboarding] notifyUser failed:', err);
  }
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

async function recalculateProgress(processId, session) {
  const opts = session ? { session } : undefined;
  const process = await OnboardingProcess.findById(processId, null, opts);
  if (!process || ['CANCELLED'].includes(process.status)) return process;

  const tasks = await OnboardingTask.find({ processId: process._id }, null, opts).lean();
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

  await process.save(opts);
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

  const taskInputs = template
    ? await Promise.all(
        template.tasks.map(async (t) => ({
          title: t.title,
          description: t.description,
          category: t.category,
          assigneeId: await resolveAssignee(orgId, t.defaultAssigneeRole, employee),
          dueDate: addDays(startDate, t.dueOffsetDays || 0),
          order: t.order,
          isRequired: t.isRequired,
        }))
      )
    : [];

  const process = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;

    const [created] = await OnboardingProcess.create(
      [{
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
      }],
      opts
    );

    if (taskInputs.length > 0) {
      await OnboardingTask.insertMany(
        taskInputs.map((t) => ({ ...t, organizationId: orgId, processId: created._id })),
        opts
      );
    }

    await recordAudit(
      organizationId,
      user._id,
      `${created.type}_PROCESS_CREATED`,
      'OnboardingProcess',
      created._id,
      { templateId: template?._id?.toString(), employeeId: employee._id.toString() },
      reqMeta,
      session
    );

    return created;
  });

  // Post-commit side effects — best-effort, never fail the request over these.
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

  if (process.type === 'ONBOARDING') {
    await emailService.sendWelcomeEmail({
      to: employee.email,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      startDate: process.startDate,
    });
  }

  return getProcessById(organizationId, process._id, user);
}

async function updateProcess(organizationId, id, payload, user, reqMeta = {}) {
  const process = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const proc = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!proc) throw new AppError('Process not found', 404);
    if (['COMPLETED', 'CANCELLED'].includes(proc.status)) throw new AppError(`Cannot update a ${proc.status.toLowerCase()} process`, 400);
    await onboardingAccess.canEditProcess(proc, user);

    if (payload.title) proc.title = payload.title;
    if (payload.startDate) {
      proc.startDate = new Date(payload.startDate);
    }
    if (payload.targetDate !== undefined) {
      proc.targetDate = payload.targetDate ? new Date(payload.targetDate) : undefined;
    }
    if (proc.targetDate && proc.targetDate < proc.startDate) {
      throw new AppError('Target date cannot be before start date', 400);
    }
    if (payload.notes !== undefined) proc.notes = payload.notes;

    await proc.save(opts);
    await recordAudit(organizationId, user._id, 'PROCESS_UPDATED', 'OnboardingProcess', proc._id, { changes: Object.keys(payload) }, reqMeta, session);
    return proc;
  });

  emitToOrg(
    organizationId,
    SOCKET_EVENTS.ONBOARDING_PROCESS_UPDATED,
    { processId: process._id.toString(), type: process.type }
  );
  return getProcessById(organizationId, process._id, user);
}

async function cancelProcess(organizationId, id, user, reason, reqMeta = {}) {
  const process = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const proc = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!proc) throw new AppError('Process not found', 404);
    if (['COMPLETED', 'CANCELLED'].includes(proc.status)) throw new AppError(`Process is already ${proc.status.toLowerCase()}`, 400);
    await onboardingAccess.canEditProcess(proc, user);

    proc.status = 'CANCELLED';
    proc.cancelledAt = new Date();
    proc.cancelledBy = user._id;
    proc.cancellationReason = reason || '';
    await proc.save(opts);

    await recordAudit(organizationId, user._id, 'PROCESS_CANCELLED', 'OnboardingProcess', proc._id, { reason }, reqMeta, session);
    return proc;
  });

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

async function confirmJoiningDate(organizationId, id, payload, user, reqMeta = {}) {
  const process = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const proc = await OnboardingProcess.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!proc) throw new AppError('Process not found', 404);
    if (['COMPLETED', 'CANCELLED'].includes(proc.status)) throw new AppError(`Cannot update a ${proc.status.toLowerCase()} process`, 400);
    await onboardingAccess.canEditProcess(proc, user);

    const previousStartDate = proc.startDate;
    proc.startDate = new Date(payload.joiningDate);
    if (proc.targetDate && proc.targetDate < proc.startDate) throw new AppError('Target date cannot be before start date', 400);
    proc.joiningDateConfirmed = true;
    proc.joiningDateConfirmedAt = new Date();
    proc.joiningDateConfirmedBy = user._id;
    await proc.save(opts);

    let employeeSynced = false;
    if (payload.syncToEmployee !== false) {
      await Employee.updateOne(
        { _id: proc.employeeId, organizationId: new Types.ObjectId(organizationId) },
        { joiningDate: proc.startDate },
        opts
      );
      employeeSynced = true;
    }

    await recordAudit(
      organizationId, user._id, 'JOINING_DATE_CONFIRMED', 'OnboardingProcess', proc._id,
      { previousStartDate, newStartDate: proc.startDate, employeeSynced }, reqMeta, session
    );
    return proc;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.ONBOARDING_JOINING_DATE_CONFIRMED, {
    processId: process._id.toString(), startDate: process.startDate,
  });

  const employee = await Employee.findById(process.employeeId).select('userId email firstName lastName').lean();
  if (employee) {
    if (employee.userId) {
      await notifyUser(
        employee.userId, organizationId, 'JOINING_DATE_CONFIRMED', 'Joining date confirmed',
        `Your joining date has been set to ${process.startDate.toDateString()}`, 'OnboardingProcess', process._id
      );
    }
    await emailService.sendJoiningDateConfirmedEmail({
      to: employee.email,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      joiningDate: process.startDate,
    });
  }

  return getProcessById(organizationId, process._id, user);
}

async function triggerDocumentCollection(organizationId, processId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const process = await OnboardingProcess.findOne({ _id: processId, organizationId: orgId });
  if (!process) throw new AppError('Process not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Cannot request documents on a ${process.status.toLowerCase()} process`, 400);
  await onboardingAccess.canEditProcess(process, user);

  let documents = payload.documents;
  if (!documents || documents.length === 0) {
    if (!process.templateId) throw new AppError('No required documents configured for this process', 400);
    const template = await OnboardingTemplate.findOne({ _id: process.templateId, organizationId: orgId }).lean();
    documents = template?.requiredDocuments || [];
  }
  if (!documents.length) throw new AppError('No required documents configured for this process', 400);

  const existingRequests = await DocumentRequest.find({
    processId: process._id,
    status: { $ne: 'CANCELLED' },
  }).select('categoryId').lean();
  const alreadyRequested = new Set(existingRequests.map((r) => r.categoryId.toString()));

  const created = [];
  const skipped = [];
  for (const doc of documents) {
    const categoryId = (doc.categoryId || '').toString();
    if (!categoryId || alreadyRequested.has(categoryId)) {
      if (categoryId) skipped.push(categoryId);
      continue;
    }
    const dueDate = addDays(process.startDate, doc.dueOffsetDays ?? 7);
    // Not atomic as a whole (documentRequestService.createRequest isn't transactional today);
    // each created request is individually consistent, and re-triggering skips duplicates.
    const request = await documentRequestService.createRequest(
      organizationId,
      {
        employeeId: process.employeeId.toString(),
        categoryId,
        processId: process._id.toString(),
        title: doc.title,
        description: doc.description,
        priority: doc.priority,
        dueDate,
      },
      user
    );
    created.push(request.id);
    alreadyRequested.add(categoryId);
  }

  await recordAudit(
    organizationId, user._id, 'REQUIRED_DOCUMENTS_REQUESTED', 'OnboardingProcess', process._id,
    { createdCount: created.length, skippedCount: skipped.length, documentRequestIds: created }, reqMeta
  );
  emitToOrg(orgId, SOCKET_EVENTS.ONBOARDING_DOCUMENTS_REQUESTED, {
    processId: process._id.toString(), createdCount: created.length, skippedCount: skipped.length,
  });

  return getProcessById(organizationId, process._id, user);
}

async function addTask(organizationId, processId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const { task, process } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const proc = await OnboardingProcess.findOne({ _id: processId, organizationId: orgId }, null, opts);
    if (!proc) throw new AppError('Process not found', 404);
    if (['COMPLETED', 'CANCELLED'].includes(proc.status)) throw new AppError(`Cannot add tasks to a ${proc.status.toLowerCase()} process`, 400);
    await onboardingAccess.canEditProcess(proc, user);

    const lastTask = await OnboardingTask.findOne({ processId: proc._id }, null, opts).sort({ order: -1 });

    const [createdTask] = await OnboardingTask.create(
      [{
        organizationId: orgId,
        processId: proc._id,
        title: payload.title,
        description: payload.description || '',
        category: payload.category || 'OTHER',
        assigneeId: payload.assigneeId || undefined,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        order: lastTask ? lastTask.order + 1 : 0,
        isRequired: payload.isRequired !== false,
        notes: payload.notes || '',
      }],
      opts
    );

    if (proc.status === 'NOT_STARTED') {
      proc.status = 'IN_PROGRESS';
      await proc.save(opts);
    }

    await recalculateProgress(proc._id, session);
    await recordAudit(organizationId, user._id, 'TASK_ADDED', 'OnboardingTask', createdTask._id, { processId: proc._id.toString(), assigneeId: createdTask.assigneeId?.toString() }, reqMeta, session);

    return { task: createdTask, process: proc };
  });

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
  const { task, process, previousAssignee } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const t = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!t) throw new AppError('Task not found', 404);

    const prevAssignee = t.assigneeId ? t.assigneeId.toString() : null;
    const proc = await OnboardingProcess.findById(t.processId, null, opts);
    if (!proc || ['COMPLETED', 'CANCELLED'].includes(proc.status)) throw new AppError(`Cannot edit tasks in a ${proc?.status?.toLowerCase() || 'unknown'} process`, 400);
    await onboardingAccess.canEditTask(t, user);

    if (payload.title) t.title = payload.title;
    if (payload.description !== undefined) t.description = payload.description;
    if (payload.category) t.category = payload.category;
    if (payload.assigneeId !== undefined) t.assigneeId = payload.assigneeId || undefined;
    if (payload.dueDate !== undefined) t.dueDate = payload.dueDate ? new Date(payload.dueDate) : undefined;
    if (payload.isRequired !== undefined) t.isRequired = payload.isRequired;
    if (payload.notes !== undefined) t.notes = payload.notes;

    await t.save(opts);
    await recordAudit(organizationId, user._id, 'TASK_UPDATED', 'OnboardingTask', t._id, { changed: Object.keys(payload) }, reqMeta, session);

    return { task: t, process: proc, previousAssignee: prevAssignee };
  });

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

  return getProcessById(organizationId, task.processId, user);
}

async function updateTaskStatus(organizationId, taskId, status, user, reqMeta = {}) {
  const { task, process, previousStatus } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const t = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!t) throw new AppError('Task not found', 404);
    await onboardingAccess.canEditTask(t, user);

    const proc = await OnboardingProcess.findById(t.processId, null, opts);
    if (proc && proc.status === 'CANCELLED') throw new AppError('Cannot update tasks of a cancelled process', 400);
    if (proc && proc.status === 'NOT_STARTED') {
      proc.status = 'IN_PROGRESS';
      await proc.save(opts);
    }

    const prevStatus = t.status;
    if (!VALID_TASK_STATUSES.includes(status)) {
      throw new AppError(`Invalid task status ${status}`, 400);
    }
    if (status === prevStatus) {
      throw new AppError(`Task is already ${prevStatus.toLowerCase()}`, 400);
    }
    if (status === 'SKIPPED' && t.isRequired) {
      throw new AppError('Required tasks cannot be skipped', 400);
    }

    t.status = status;
    if (status === 'COMPLETED') {
      t.completedAt = new Date();
      t.completedBy = user._id;
    } else {
      t.completedAt = undefined;
      t.completedBy = undefined;
    }
    await t.save(opts);

    const updatedProcess = await recalculateProgress(t.processId, session);
    await recordAudit(organizationId, user._id, 'TASK_STATUS_CHANGED', 'OnboardingTask', t._id, { from: prevStatus, to: status }, reqMeta, session);

    return { task: t, process: updatedProcess, previousStatus: prevStatus };
  });

  emitToOrg(
    organizationId,
    SOCKET_EVENTS.ONBOARDING_TASK_STATUS_CHANGED,
    { taskId: task._id.toString(), processId: task.processId.toString(), from: previousStatus, to: status }
  );

  if (status === 'COMPLETED' && process && process.status === 'COMPLETED') {
    emitToOrg(organizationId, SOCKET_EVENTS.ONBOARDING_PROCESS_COMPLETED, {
      processId: process._id.toString(), type: process.type,
    });
    await notifyHR(organizationId, 'PROCESS_COMPLETED', 'Process completed', `${process.title} is fully complete`, 'OnboardingProcess', process._id);
  }

  return getProcessById(organizationId, task.processId, user);
}

async function deleteTask(organizationId, taskId, user, reqMeta = {}) {
  const processId = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const task = await OnboardingTask.findOne({ _id: taskId, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!task) throw new AppError('Task not found', 404);

    const process = await OnboardingProcess.findById(task.processId, null, opts);
    if (process && ['COMPLETED', 'CANCELLED'].includes(process.status)) throw new AppError(`Cannot delete tasks in a ${process.status.toLowerCase()} process`, 400);
    if (!onboardingAccess.FULL_ROLES.includes(user.role) && task.assigneeId && task.assigneeId.toString() !== user._id.toString()) {
      throw new AppError('Forbidden: cannot delete this task', 403);
    }

    const pid = task.processId;
    await task.deleteOne(opts);
    await recalculateProgress(pid, session);
    await recordAudit(organizationId, user._id, 'TASK_DELETED', 'OnboardingTask', task._id, { processId: pid.toString() }, reqMeta, session);
    return pid;
  });

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
  confirmJoiningDate,
  triggerDocumentCollection,
  addTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getMyTasks,
};
