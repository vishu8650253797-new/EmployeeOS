const { Types } = require('mongoose');
const { OnboardingTemplate } = require('../models');
const AppError = require('../utils/AppError');
const { withTransaction } = require('../utils/withTransaction');
const auditLogService = require('./auditLogService');

function recordAudit(organizationId, userId, action, entityId, metadata = {}, reqMeta = {}, session) {
  return auditLogService.recordAction({ organizationId, userId, action, entityType: 'OnboardingTemplate', entityId, metadata, session, ...reqMeta });
}

const DEFAULTS = { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' };

function safeSort(sortBy) {
  const allowed = ['createdAt', 'name', 'type'];
  return allowed.includes(sortBy) ? sortBy : 'createdAt';
}

async function getTemplates(organizationId, filters = {}) {
  const { search, type, status, departmentId, sortBy, sortOrder, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (type && ['ONBOARDING', 'OFFBOARDING'].includes(type)) query.type = type;
  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) query.status = status;
  if (departmentId && Types.ObjectId.isValid(departmentId)) query.departmentId = new Types.ObjectId(departmentId);
  if (search && search.trim()) {
    const q = new RegExp(search.trim(), 'i');
    query.$or = [{ name: q }, { description: q }];
  }

  const sort = { [safeSort(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    OnboardingTemplate.find(query)
      .populate('departmentId', 'name')
      .populate('createdBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    OnboardingTemplate.countDocuments(query),
  ]);

  const items = data.map((i) => ({ ...i, id: i._id.toString(), taskCount: (i.tasks || []).length }));
  return {
    data: items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getTemplateById(organizationId, id) {
  const item = await OnboardingTemplate.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('departmentId', 'name')
    .populate('createdBy', 'firstName lastName')
    .lean();
  if (!item) throw new AppError('Template not found', 404);
  return { ...item, id: item._id.toString(), taskCount: (item.tasks || []).length };
}

function normalizeTasks(tasks = []) {
  return tasks.map((t, index) => ({
    title: t.title,
    description: t.description || '',
    category: t.category || 'OTHER',
    defaultAssigneeRole: t.defaultAssigneeRole || 'HR_ADMIN',
    dueOffsetDays: Number.isFinite(Number(t.dueOffsetDays)) ? Math.max(Number(t.dueOffsetDays), 0) : 0,
    order: t.order !== undefined ? t.order : index,
    isRequired: t.isRequired !== false,
  }));
}

async function createTemplate(organizationId, payload, user, reqMeta = {}) {
  const item = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const [created] = await OnboardingTemplate.create(
      [{
        organizationId: new Types.ObjectId(organizationId),
        name: payload.name,
        description: payload.description || '',
        type: payload.type,
        departmentId: payload.departmentId || undefined,
        tasks: normalizeTasks(payload.tasks),
        status: payload.status || 'ACTIVE',
        createdBy: user._id,
      }],
      opts
    );
    await recordAudit(organizationId, user._id, 'TEMPLATE_CREATED', created._id, { type: created.type, taskCount: created.tasks.length }, reqMeta, session);
    return created;
  });
  return getTemplateById(organizationId, item._id);
}

async function updateTemplate(organizationId, id, payload, user, reqMeta = {}) {
  const item = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const template = await OnboardingTemplate.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!template) throw new AppError('Template not found', 404);

    if (payload.name) template.name = payload.name;
    if (payload.description !== undefined) template.description = payload.description;
    if (payload.type && ['ONBOARDING', 'OFFBOARDING'].includes(payload.type)) template.type = payload.type;
    if (payload.departmentId !== undefined) template.departmentId = payload.departmentId || undefined;
    if (payload.tasks !== undefined) template.tasks = normalizeTasks(payload.tasks);
    if (payload.status && ['ACTIVE', 'INACTIVE'].includes(payload.status)) template.status = payload.status;

    await template.save(opts);
    await recordAudit(organizationId, user._id, 'TEMPLATE_UPDATED', template._id, { changed: Object.keys(payload) }, reqMeta, session);
    return template;
  });
  return getTemplateById(organizationId, item._id);
}

async function deleteTemplate(organizationId, id, user, reqMeta = {}) {
  await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const template = await OnboardingTemplate.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }, null, opts);
    if (!template) throw new AppError('Template not found', 404);
    const previousStatus = template.status;
    template.status = 'INACTIVE';
    await template.save(opts);
    await recordAudit(organizationId, user._id, 'TEMPLATE_DEACTIVATED', template._id, { previousStatus }, reqMeta, session);
  });
  return { success: true, message: 'Template deactivated' };
}

module.exports = { getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate };
