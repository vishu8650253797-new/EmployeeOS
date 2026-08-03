const { Types } = require('mongoose');
const { JobApplication, Candidate, User } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const { logActivity } = require('./candidateActivityService');

const DEFAULTS = { page: 1, limit: 20 };

// NEW → SCREENING → SHORTLISTED → INTERVIEW → OFFER → HIRED,
// plus any active status → REJECTED / WITHDRAWN.
const ACTIVE_STATUSES = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER'];
const ALLOWED_TRANSITIONS = {
  NEW: ['SCREENING', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['HIRED', 'REJECTED', 'WITHDRAWN'],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

function emitToOrg(organizationId, event, payload) {
  const io = getSocketInstance();
  if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
}

function toDTO(app) {
  return { ...app, id: app._id.toString() };
}

async function getApplications(organizationId, filters = {}) {
  const { job, candidate, status, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 200);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (job) query.jobId = new Types.ObjectId(job);
  if (candidate) query.candidateId = new Types.ObjectId(candidate);
  if (status) query.status = status;

  const [data, total] = await Promise.all([
    JobApplication.find(query)
      .populate('candidateId', 'firstName lastName email currentJobTitle yearsOfExperience skills tags source assignedRecruiterId')
      .populate('jobId', 'title slug status')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    JobApplication.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getApplicationById(organizationId, id) {
  const app = await JobApplication.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('candidateId')
    .populate('jobId', 'title slug status departmentId')
    .lean();
  if (!app) throw new AppError('Application not found', 404);
  return toDTO(app);
}

async function syncCandidateStatus(organizationId, candidateId) {
  // A candidate's headline status mirrors their most advanced active application.
  const order = ['HIRED', 'OFFER', 'INTERVIEW', 'SHORTLISTED', 'SCREENING', 'NEW', 'REJECTED', 'WITHDRAWN'];
  const apps = await JobApplication.find({
    organizationId: new Types.ObjectId(organizationId),
    candidateId: new Types.ObjectId(candidateId),
  }).select('status').lean();
  if (!apps.length) return;
  const best = order.find((s) => apps.some((a) => a.status === s));
  if (best) {
    await Candidate.updateOne(
      { _id: candidateId, organizationId: new Types.ObjectId(organizationId), status: { $ne: 'HIRED' } },
      { status: best }
    );
  }
}

async function updateStatus(organizationId, id, targetStatus, actor, extra = {}, reqMeta = {}) {
  const app = await JobApplication.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title');
  if (!app) throw new AppError('Application not found', 404);

  const allowed = ALLOWED_TRANSITIONS[app.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(`Invalid status transition: ${app.status} → ${targetStatus}`, 400);
  }

  const previousStatus = app.status;
  app.status = targetStatus;
  app.lastStatusChangedAt = new Date();
  if (targetStatus === 'REJECTED' && extra.rejectionReason) app.rejectionReason = extra.rejectionReason;
  if (targetStatus === 'WITHDRAWN' && extra.withdrawalReason) app.withdrawalReason = extra.withdrawalReason;
  await app.save();

  await syncCandidateStatus(organizationId, app.candidateId._id);

  const activityType =
    targetStatus === 'REJECTED' ? 'CANDIDATE_REJECTED'
    : targetStatus === 'WITHDRAWN' ? 'CANDIDATE_WITHDRAWN'
    : targetStatus === 'HIRED' ? 'CANDIDATE_HIRED'
    : 'STATUS_CHANGED';

  await logActivity({
    organizationId, candidateId: app.candidateId._id, applicationId: app._id, actorId: actor?._id,
    type: activityType,
    description: `Moved from ${previousStatus} to ${targetStatus}${extra.rejectionReason ? ` — ${extra.rejectionReason}` : ''}`,
    metadata: { from: previousStatus, to: targetStatus },
  });

  await auditLogService.recordAction({
    organizationId, userId: actor?._id, action: 'APPLICATION_STATUS_CHANGED',
    entityType: 'JobApplication', entityId: app._id,
    metadata: { from: previousStatus, to: targetStatus }, ...reqMeta,
  });

  const payload = {
    id: app._id.toString(),
    candidateId: app.candidateId._id.toString(),
    candidateName: `${app.candidateId.firstName} ${app.candidateId.lastName}`,
    jobId: app.jobId._id.toString(),
    jobTitle: app.jobId.title,
    from: previousStatus,
    to: targetStatus,
  };
  emitToOrg(organizationId, SOCKET_EVENTS.APPLICATION_STATUS_CHANGED, payload);
  if (targetStatus === 'REJECTED') emitToOrg(organizationId, SOCKET_EVENTS.CANDIDATE_REJECTED, payload);
  if (targetStatus === 'WITHDRAWN') emitToOrg(organizationId, SOCKET_EVENTS.CANDIDATE_WITHDRAWN, payload);

  return app.toJSON();
}

async function rejectApplication(organizationId, id, rejectionReason, actor, reqMeta = {}) {
  if (!rejectionReason || !rejectionReason.trim()) throw new AppError('Rejection reason is required', 400);
  const result = await updateStatus(organizationId, id, 'REJECTED', actor, { rejectionReason: rejectionReason.trim() }, reqMeta);

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'CANDIDATE_REJECTED',
    entityType: 'JobApplication', entityId: id, metadata: { rejectionReason }, ...reqMeta,
  });
  return result;
}

async function withdrawApplication(organizationId, id, withdrawalReason, actor, reqMeta = {}) {
  const result = await updateStatus(organizationId, id, 'WITHDRAWN', actor, { withdrawalReason }, reqMeta);

  // Notify the assigned recruiter (if any).
  const app = await JobApplication.findById(id).populate('candidateId', 'firstName lastName assignedRecruiterId').lean();
  const recruiterId = app?.candidateId?.assignedRecruiterId;
  if (recruiterId) {
    await notificationService.createNotification({
      organizationId, recipientId: recruiterId, type: 'CANDIDATE_STATUS_CHANGED',
      title: 'Candidate withdrew application',
      message: `${app.candidateId.firstName} ${app.candidateId.lastName} withdrew their application`,
      entityType: 'JobApplication', entityId: id,
    });
  }
  return result;
}

module.exports = {
  ACTIVE_STATUSES,
  ALLOWED_TRANSITIONS,
  getApplications,
  getApplicationById,
  updateStatus,
  rejectApplication,
  withdrawApplication,
  syncCandidateStatus,
};
