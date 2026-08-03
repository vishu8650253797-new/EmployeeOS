const crypto = require('crypto');
const { Types } = require('mongoose');
const { JobOpening, JobApplication } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const auditLogService = require('./auditLogService');

const DEFAULTS = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };

function toDTO(job) {
  return { ...job, id: job._id.toString() };
}

function slugify(title) {
  return `${title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .slice(0, 80)}-${crypto.randomBytes(3).toString('hex')}`;
}

function emitToOrg(organizationId, event, payload) {
  const io = getSocketInstance();
  if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
}

async function getJobs(organizationId, filters = {}) {
  const {
    search, department, location, employmentType, workMode, experienceLevel,
    status, hiringManager, recruiter, page, limit, sortBy, sortOrder,
  } = filters;

  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (search) query.title = { $regex: search.trim(), $options: 'i' };
  if (department) query.departmentId = new Types.ObjectId(department);
  if (location) query.location = { $regex: location.trim(), $options: 'i' };
  if (employmentType) query.employmentType = employmentType;
  if (workMode) query.workMode = workMode;
  if (experienceLevel) query.experienceLevel = experienceLevel;
  if (status) query.status = status;
  if (hiringManager) query.hiringManagerId = new Types.ObjectId(hiringManager);
  if (recruiter) query.recruiterId = new Types.ObjectId(recruiter);

  const sort = { [sortBy || DEFAULTS.sortBy]: (sortOrder || DEFAULTS.sortOrder) === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    JobOpening.find(query)
      .populate('departmentId', 'name')
      .populate('hiringManagerId', 'firstName lastName email')
      .populate('recruiterId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    JobOpening.countDocuments(query),
  ]);

  // Attach application counts per job.
  const jobIds = data.map((j) => j._id);
  const counts = await JobApplication.aggregate([
    { $match: { organizationId: new Types.ObjectId(organizationId), jobId: { $in: jobIds } } },
    { $group: { _id: '$jobId', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

  return {
    data: data.map((j) => ({ ...toDTO(j), applicationCount: countMap[j._id.toString()] || 0 })),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getJobById(organizationId, id) {
  const job = await JobOpening.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('departmentId', 'name')
    .populate('hiringManagerId', 'firstName lastName email')
    .populate('recruiterId', 'firstName lastName email')
    .lean();
  if (!job) throw new AppError('Job not found', 404);
  const applicationCount = await JobApplication.countDocuments({
    organizationId: new Types.ObjectId(organizationId),
    jobId: job._id,
  });
  return { ...toDTO(job), applicationCount };
}

async function createJob(organizationId, payload, actor, reqMeta = {}) {
  if (!payload.title || !payload.title.trim()) throw new AppError('Job title is required', 400);

  const job = await JobOpening.create({
    organizationId: new Types.ObjectId(organizationId),
    title: payload.title.trim(),
    slug: slugify(payload.title),
    departmentId: payload.departmentId || undefined,
    location: payload.location,
    employmentType: payload.employmentType,
    workMode: payload.workMode,
    experienceLevel: payload.experienceLevel,
    salaryMin: payload.salaryMin ?? undefined,
    salaryMax: payload.salaryMax ?? undefined,
    salaryCurrency: payload.salaryCurrency,
    description: payload.description,
    responsibilities: payload.responsibilities || [],
    requirements: payload.requirements || [],
    qualifications: payload.qualifications || [],
    skills: payload.skills || [],
    benefits: payload.benefits || [],
    numberOfOpenings: payload.numberOfOpenings || 1,
    hiringManagerId: payload.hiringManagerId || undefined,
    recruiterId: payload.recruiterId || undefined,
    closingDate: payload.closingDate || undefined,
    createdBy: actor._id,
  });

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'JOB_CREATED', entityType: 'JobOpening', entityId: job._id,
    metadata: { title: job.title }, ...reqMeta,
  });
  emitToOrg(organizationId, SOCKET_EVENTS.JOB_CREATED, job.toJSON());
  return job.toJSON();
}

async function updateJob(organizationId, id, payload, actor, reqMeta = {}) {
  const job = await JobOpening.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!job) throw new AppError('Job not found', 404);

  const fields = [
    'title', 'departmentId', 'location', 'employmentType', 'workMode', 'experienceLevel',
    'salaryMin', 'salaryMax', 'salaryCurrency', 'description', 'responsibilities', 'requirements',
    'qualifications', 'skills', 'benefits', 'numberOfOpenings', 'hiringManagerId', 'recruiterId', 'closingDate',
  ];
  fields.forEach((f) => {
    if (payload[f] !== undefined) job[f] = payload[f];
  });
  await job.save();

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'JOB_UPDATED', entityType: 'JobOpening', entityId: job._id,
    metadata: { title: job.title }, ...reqMeta,
  });
  emitToOrg(organizationId, SOCKET_EVENTS.JOB_UPDATED, job.toJSON());
  return job.toJSON();
}

function validateForPublish(job) {
  const missing = [];
  if (!job.title) missing.push('title');
  if (!job.departmentId) missing.push('department');
  if (!job.description) missing.push('description');
  if (!job.responsibilities?.length) missing.push('responsibilities');
  if (!job.requirements?.length) missing.push('requirements');
  if (!job.employmentType) missing.push('employmentType');
  if (!job.workMode) missing.push('workMode');
  if (!job.numberOfOpenings) missing.push('numberOfOpenings');
  if (missing.length) {
    throw new AppError(`Cannot publish job — missing required fields: ${missing.join(', ')}`, 400);
  }
}

async function changeJobStatus(organizationId, id, targetStatus, actor, reqMeta = {}) {
  const job = await JobOpening.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!job) throw new AppError('Job not found', 404);

  const transitions = {
    PUBLISHED: ['DRAFT', 'PAUSED', 'CLOSED'], // CLOSED → PUBLISHED covers the reopen flow
    PAUSED: ['PUBLISHED'],
    CLOSED: ['PUBLISHED', 'PAUSED', 'DRAFT'],
  };
  const allowedFrom = transitions[targetStatus];
  if (!allowedFrom || !allowedFrom.includes(job.status)) {
    throw new AppError(`Cannot change job status from ${job.status} to ${targetStatus}`, 400);
  }

  if (targetStatus === 'PUBLISHED') {
    validateForPublish(job);
    if (!job.publishedAt) job.publishedAt = new Date();
  }
  job.status = targetStatus;
  await job.save();

  const actionMap = { PUBLISHED: 'JOB_PUBLISHED', PAUSED: 'JOB_UPDATED', CLOSED: 'JOB_CLOSED' };
  const eventMap = {
    PUBLISHED: SOCKET_EVENTS.JOB_PUBLISHED,
    PAUSED: SOCKET_EVENTS.JOB_PAUSED,
    CLOSED: SOCKET_EVENTS.JOB_CLOSED,
  };

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: actionMap[targetStatus], entityType: 'JobOpening', entityId: job._id,
    metadata: { title: job.title, status: targetStatus }, ...reqMeta,
  });
  emitToOrg(organizationId, eventMap[targetStatus], job.toJSON());
  return job.toJSON();
}

async function deleteJob(organizationId, id, actor, reqMeta = {}) {
  const job = await JobOpening.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!job) throw new AppError('Job not found', 404);

  const applicationCount = await JobApplication.countDocuments({
    organizationId: new Types.ObjectId(organizationId),
    jobId: job._id,
  });
  if (applicationCount > 0) {
    // Jobs with applications are cancelled rather than hard-deleted to preserve history.
    job.status = 'CANCELLED';
    await job.save();
  } else {
    await job.deleteOne();
  }

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'JOB_UPDATED', entityType: 'JobOpening', entityId: job._id,
    metadata: { title: job.title, deleted: true }, ...reqMeta,
  });
  emitToOrg(organizationId, SOCKET_EVENTS.JOB_DELETED, { id: id.toString() });
  return { success: true, message: applicationCount > 0 ? 'Job cancelled (has applications)' : 'Job deleted' };
}

module.exports = { getJobs, getJobById, createJob, updateJob, changeJobStatus, deleteJob };
