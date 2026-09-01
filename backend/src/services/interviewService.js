const { Types } = require('mongoose');
const { Interview, InterviewFeedback, JobApplication, Candidate, User } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom, getUserRoom } = require('../socket/socketRooms');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const { logActivity } = require('./candidateActivityService');

const DEFAULTS = { page: 1, limit: 20 };

function toDTO(doc) {
  return { ...doc, id: doc._id.toString() };
}

function emitToOrg(organizationId, event, payload) {
  const io = getSocketInstance();
  if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
}

function emitToUsers(userIds, event, payload) {
  const io = getSocketInstance();
  if (io) userIds.forEach((uid) => io.to(getUserRoom(uid.toString())).emit(event, payload));
}

async function checkInterviewerConflicts(organizationId, interviewerIds, start, end, excludeInterviewId) {
  const query = {
    organizationId: new Types.ObjectId(organizationId),
    interviewerIds: { $in: interviewerIds.map((i) => new Types.ObjectId(i)) },
    status: { $in: ['SCHEDULED', 'RESCHEDULED'] },
    scheduledStart: { $lt: end },
    scheduledEnd: { $gt: start },
  };
  if (excludeInterviewId) query._id = { $ne: new Types.ObjectId(excludeInterviewId) };

  const conflict = await Interview.findOne(query)
    .populate('interviewerIds', 'firstName lastName')
    .lean();
  if (conflict) {
    const conflictingInterviewer = conflict.interviewerIds.find((i) =>
      interviewerIds.some((id) => id.toString() === i._id.toString())
    );
    const name = conflictingInterviewer ? `${conflictingInterviewer.firstName} ${conflictingInterviewer.lastName}` : 'An interviewer';
    throw new AppError(
      `Scheduling conflict: ${name} already has an interview from ${new Date(conflict.scheduledStart).toLocaleString()} to ${new Date(conflict.scheduledEnd).toLocaleString()}`,
      409
    );
  }
}

async function getInterviews(organizationId, filters = {}, actor) {
  const { candidate, job, status, interviewer, from, to, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 200);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (candidate) query.candidateId = new Types.ObjectId(candidate);
  if (job) query.jobId = new Types.ObjectId(job);
  if (status) query.status = status;
  if (interviewer) query.interviewerIds = new Types.ObjectId(interviewer);
  if (from || to) {
    query.scheduledStart = {};
    if (from) query.scheduledStart.$gte = new Date(from);
    if (to) query.scheduledStart.$lte = new Date(to);
  }
  // Interviewers only see interviews they are assigned to.
  if (actor && actor.role === 'INTERVIEWER') {
    query.interviewerIds = actor._id;
  }

  const [data, total] = await Promise.all([
    Interview.find(query)
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title slug')
      .populate('interviewerIds', 'firstName lastName email')
      .sort({ scheduledStart: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Interview.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getInterviewById(organizationId, id, actor) {
  const interview = await Interview.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('candidateId', 'firstName lastName email currentJobTitle skills')
    .populate('jobId', 'title slug')
    .populate('interviewerIds', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName')
    .lean();
  if (!interview) throw new AppError('Interview not found', 404);

  if (actor && actor.role === 'INTERVIEWER') {
    const isAssigned = interview.interviewerIds.some((i) => i._id.toString() === actor._id.toString());
    if (!isAssigned) throw new AppError('You are not assigned to this interview', 403);
  }
  return toDTO(interview);
}

async function createInterview(organizationId, payload, actor, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const { applicationId, interviewType, title, scheduledStart, scheduledEnd, timezone, location, meetingLink, interviewerIds, notes } = payload;

  if (!applicationId) throw new AppError('Application is required', 400);
  if (!scheduledStart || !scheduledEnd) throw new AppError('Start and end times are required', 400);

  const start = new Date(scheduledStart);
  const end = new Date(scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new AppError('Invalid date', 400);
  if (start >= end) throw new AppError('Start time must be before end time', 400);
  if (!interviewerIds?.length) throw new AppError('At least one interviewer is required', 400);
  if (interviewerIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw new AppError('Interviewers must be selected from existing users, not free text', 400);
  }

  const application = await JobApplication.findOne({ _id: applicationId, organizationId: orgId })
    .populate('candidateId', 'firstName lastName')
    .populate('jobId', 'title');
  if (!application) throw new AppError('Application not found', 404);

  const interviewers = await User.find({ _id: { $in: interviewerIds }, organizationId: orgId }).select('_id firstName lastName').lean();
  if (interviewers.length !== interviewerIds.length) throw new AppError('One or more interviewers were not found in this organization', 404);

  await checkInterviewerConflicts(organizationId, interviewerIds, start, end);

  const interview = await Interview.create({
    organizationId: orgId,
    applicationId: application._id,
    candidateId: application.candidateId._id,
    jobId: application.jobId._id,
    interviewType: interviewType || 'TECHNICAL',
    title: title || `${interviewType || 'Interview'} — ${application.candidateId.firstName} ${application.candidateId.lastName}`,
    scheduledStart: start,
    scheduledEnd: end,
    timezone: timezone || 'UTC',
    location,
    meetingLink,
    interviewerIds,
    createdBy: actor._id,
    notes,
  });

  await logActivity({
    organizationId, candidateId: application.candidateId._id, applicationId: application._id, actorId: actor._id,
    type: 'INTERVIEW_SCHEDULED',
    description: `${interview.interviewType} interview scheduled for ${start.toLocaleString()}`,
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'INTERVIEW_CREATED', entityType: 'Interview', entityId: interview._id,
    metadata: { applicationId: application._id.toString() }, ...reqMeta,
  });

  await Promise.all(
    interviewerIds.map((uid) =>
      notificationService.createNotification({
        organizationId, recipientId: uid, type: 'INTERVIEW_SCHEDULED',
        title: 'Interview scheduled',
        message: `You have an interview with ${application.candidateId.firstName} ${application.candidateId.lastName} for ${application.jobId.title}`,
        entityType: 'Interview', entityId: interview._id,
      })
    )
  );

  const dto = interview.toJSON();
  emitToOrg(organizationId, SOCKET_EVENTS.INTERVIEW_SCHEDULED, dto);
  emitToUsers(interviewerIds, SOCKET_EVENTS.INTERVIEW_SCHEDULED, dto);
  return dto;
}

async function updateInterview(organizationId, id, payload, actor, reqMeta = {}) {
  const interview = await Interview.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!interview) throw new AppError('Interview not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(interview.status)) {
    throw new AppError(`Cannot update a ${interview.status.toLowerCase()} interview`, 400);
  }

  const fields = ['interviewType', 'title', 'timezone', 'location', 'meetingLink', 'notes'];
  fields.forEach((f) => {
    if (payload[f] !== undefined) interview[f] = payload[f];
  });
  if (payload.interviewerIds !== undefined && payload.interviewerIds.length) {
    if (payload.interviewerIds.some((interviewerId) => !Types.ObjectId.isValid(interviewerId))) {
      throw new AppError('Interviewers must be selected from existing users, not free text', 400);
    }
    interview.interviewerIds = payload.interviewerIds;
  }
  await interview.save();

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'INTERVIEW_UPDATED', entityType: 'Interview', entityId: interview._id,
    metadata: {}, ...reqMeta,
  });
  return interview.toJSON();
}

async function rescheduleInterview(organizationId, id, payload, actor, reqMeta = {}) {
  const interview = await Interview.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!interview) throw new AppError('Interview not found', 404);
  if (!['SCHEDULED', 'RESCHEDULED'].includes(interview.status)) {
    throw new AppError('Only scheduled interviews can be rescheduled', 400);
  }

  const start = new Date(payload.scheduledStart);
  const end = new Date(payload.scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new AppError('Invalid date', 400);
  if (start >= end) throw new AppError('Start time must be before end time', 400);

  await checkInterviewerConflicts(organizationId, interview.interviewerIds.map(String), start, end, id);

  interview.scheduledStart = start;
  interview.scheduledEnd = end;
  interview.status = 'RESCHEDULED';
  await interview.save();

  await logActivity({
    organizationId, candidateId: interview.candidateId, applicationId: interview.applicationId, actorId: actor._id,
    type: 'INTERVIEW_RESCHEDULED', description: `Interview rescheduled to ${start.toLocaleString()}`,
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'INTERVIEW_UPDATED', entityType: 'Interview', entityId: interview._id,
    metadata: { rescheduled: true }, ...reqMeta,
  });
  await Promise.all(
    interview.interviewerIds.map((uid) =>
      notificationService.createNotification({
        organizationId, recipientId: uid, type: 'INTERVIEW_RESCHEDULED',
        title: 'Interview rescheduled',
        message: `An interview has been rescheduled to ${start.toLocaleString()}`,
        entityType: 'Interview', entityId: interview._id,
      })
    )
  );

  const dto = interview.toJSON();
  emitToOrg(organizationId, SOCKET_EVENTS.INTERVIEW_RESCHEDULED, dto);
  emitToUsers(interview.interviewerIds, SOCKET_EVENTS.INTERVIEW_RESCHEDULED, dto);
  return dto;
}

async function cancelInterview(organizationId, id, actor, reqMeta = {}) {
  const interview = await Interview.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!interview) throw new AppError('Interview not found', 404);
  if (!['SCHEDULED', 'RESCHEDULED'].includes(interview.status)) {
    throw new AppError('Only scheduled interviews can be cancelled', 400);
  }

  interview.status = 'CANCELLED';
  await interview.save();

  await logActivity({
    organizationId, candidateId: interview.candidateId, applicationId: interview.applicationId, actorId: actor._id,
    type: 'INTERVIEW_CANCELLED', description: 'Interview cancelled',
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'INTERVIEW_CANCELLED', entityType: 'Interview', entityId: interview._id,
    metadata: {}, ...reqMeta,
  });
  await Promise.all(
    interview.interviewerIds.map((uid) =>
      notificationService.createNotification({
        organizationId, recipientId: uid, type: 'INTERVIEW_CANCELLED',
        title: 'Interview cancelled',
        message: 'An interview you were assigned to has been cancelled',
        entityType: 'Interview', entityId: interview._id,
      })
    )
  );

  const dto = interview.toJSON();
  emitToOrg(organizationId, SOCKET_EVENTS.INTERVIEW_CANCELLED, dto);
  emitToUsers(interview.interviewerIds, SOCKET_EVENTS.INTERVIEW_CANCELLED, dto);
  return dto;
}

async function completeInterview(organizationId, id, actor, reqMeta = {}) {
  const interview = await Interview.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!interview) throw new AppError('Interview not found', 404);
  if (!['SCHEDULED', 'RESCHEDULED'].includes(interview.status)) {
    throw new AppError('Only scheduled interviews can be completed', 400);
  }

  interview.status = 'COMPLETED';
  await interview.save();

  await logActivity({
    organizationId, candidateId: interview.candidateId, applicationId: interview.applicationId, actorId: actor._id,
    type: 'INTERVIEW_COMPLETED', description: 'Interview completed',
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'INTERVIEW_UPDATED', entityType: 'Interview', entityId: interview._id,
    metadata: { completed: true }, ...reqMeta,
  });

  const dto = interview.toJSON();
  emitToOrg(organizationId, SOCKET_EVENTS.INTERVIEW_COMPLETED, dto);
  return dto;
}

async function deleteInterview(organizationId, id, actor, reqMeta = {}) {
  const interview = await Interview.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!interview) throw new AppError('Interview not found', 404);
  await InterviewFeedback.deleteMany({ organizationId: new Types.ObjectId(organizationId), interviewId: interview._id });
  await interview.deleteOne();

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'INTERVIEW_CANCELLED', entityType: 'Interview', entityId: id,
    metadata: { deleted: true }, ...reqMeta,
  });
  return { success: true, message: 'Interview deleted' };
}

// ---- Feedback ----

async function getFeedback(organizationId, interviewId, actor) {
  const interview = await Interview.findOne({ _id: interviewId, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!interview) throw new AppError('Interview not found', 404);

  const query = { organizationId: new Types.ObjectId(organizationId), interviewId: interview._id };
  // Interviewers only see their own feedback; recruiters/HR/hiring managers see all.
  if (actor && actor.role === 'INTERVIEWER') query.interviewerId = actor._id;

  const data = await InterviewFeedback.find(query)
    .populate('interviewerId', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .lean();
  return data.map(toDTO);
}

async function submitFeedback(organizationId, interviewId, payload, actor, reqMeta = {}) {
  const interview = await Interview.findOne({ _id: interviewId, organizationId: new Types.ObjectId(organizationId) });
  if (!interview) throw new AppError('Interview not found', 404);

  const isAssigned = interview.interviewerIds.some((i) => i.toString() === actor._id.toString());
  const isElevated = ['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role);
  if (!isAssigned && !isElevated) throw new AppError('Only assigned interviewers can submit feedback', 403);

  if (!payload.overallRating) throw new AppError('Overall rating is required', 400);
  if (!payload.recommendation) throw new AppError('Recommendation is required', 400);

  const existing = await InterviewFeedback.findOne({
    organizationId: new Types.ObjectId(organizationId),
    interviewId: interview._id,
    interviewerId: actor._id,
  });
  if (existing) throw new AppError('You have already submitted feedback for this interview', 409);

  const feedback = await InterviewFeedback.create({
    organizationId: new Types.ObjectId(organizationId),
    interviewId: interview._id,
    candidateId: interview.candidateId,
    interviewerId: actor._id,
    technicalSkills: payload.technicalSkills,
    communication: payload.communication,
    problemSolving: payload.problemSolving,
    cultureFit: payload.cultureFit,
    overallRating: payload.overallRating,
    recommendation: payload.recommendation,
    strengths: payload.strengths,
    weaknesses: payload.weaknesses,
    comments: payload.comments,
  });

  await logActivity({
    organizationId, candidateId: interview.candidateId, applicationId: interview.applicationId, actorId: actor._id,
    type: 'FEEDBACK_SUBMITTED', description: `Interview feedback submitted (${payload.recommendation})`,
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'FEEDBACK_SUBMITTED', entityType: 'InterviewFeedback', entityId: feedback._id,
    metadata: { interviewId: interview._id.toString(), recommendation: payload.recommendation }, ...reqMeta,
  });

  // Notify the interview creator (recruiter).
  if (interview.createdBy && interview.createdBy.toString() !== actor._id.toString()) {
    await notificationService.createNotification({
      organizationId, recipientId: interview.createdBy, type: 'INTERVIEW_FEEDBACK_SUBMITTED',
      title: 'Interview feedback submitted',
      message: `Feedback was submitted for an interview (${payload.recommendation})`,
      entityType: 'Interview', entityId: interview._id,
    });
  }

  const dto = feedback.toJSON();
  emitToOrg(organizationId, SOCKET_EVENTS.INTERVIEW_FEEDBACK_SUBMITTED, {
    interviewId: interview._id.toString(),
    candidateId: interview.candidateId.toString(),
    recommendation: payload.recommendation,
  });
  return dto;
}

async function updateFeedback(organizationId, feedbackId, payload, actor) {
  const feedback = await InterviewFeedback.findOne({ _id: feedbackId, organizationId: new Types.ObjectId(organizationId) });
  if (!feedback) throw new AppError('Feedback not found', 404);
  if (feedback.interviewerId.toString() !== actor._id.toString()) {
    throw new AppError('You can only edit your own feedback', 403);
  }

  const fields = ['technicalSkills', 'communication', 'problemSolving', 'cultureFit', 'overallRating', 'recommendation', 'strengths', 'weaknesses', 'comments'];
  fields.forEach((f) => {
    if (payload[f] !== undefined) feedback[f] = payload[f];
  });
  await feedback.save();
  return feedback.toJSON();
}

async function getCandidateFeedback(organizationId, candidateId) {
  const data = await InterviewFeedback.find({
    organizationId: new Types.ObjectId(organizationId),
    candidateId: new Types.ObjectId(candidateId),
  })
    .populate('interviewerId', 'firstName lastName email role')
    .populate('interviewId', 'interviewType title scheduledStart')
    .sort({ createdAt: -1 })
    .lean();
  return data.map(toDTO);
}

module.exports = {
  getInterviews,
  getInterviewById,
  createInterview,
  updateInterview,
  rescheduleInterview,
  cancelInterview,
  completeInterview,
  deleteInterview,
  getFeedback,
  submitFeedback,
  updateFeedback,
  getCandidateFeedback,
};
