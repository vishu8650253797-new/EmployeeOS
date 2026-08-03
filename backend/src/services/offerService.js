const crypto = require('crypto');
const { Types } = require('mongoose');
const { JobOffer, JobApplication, Candidate, User } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const { logActivity } = require('./candidateActivityService');

const DEFAULTS = { page: 1, limit: 20 };
const OFFER_TOKEN_TTL_DAYS = Number(process.env.OFFER_TOKEN_TTL_DAYS) || 14;

function toDTO(doc) {
  return { ...doc, id: doc._id.toString() };
}

function emitToOrg(organizationId, event, payload) {
  const io = getSocketInstance();
  if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
}

async function notifyHR(organizationId, type, title, message, entityId) {
  const hrUsers = await User.find({
    organizationId: new Types.ObjectId(organizationId),
    role: { $in: ['SUPER_ADMIN', 'HR_ADMIN', 'RECRUITER'] },
    status: 'active',
  }).select('_id').lean();
  await Promise.all(
    hrUsers.map((u) =>
      notificationService.createNotification({
        organizationId, recipientId: u._id, type, title, message, entityType: 'JobOffer', entityId,
      })
    )
  );
}

async function getOffers(organizationId, filters = {}) {
  const { candidate, job, status, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (candidate) query.candidateId = new Types.ObjectId(candidate);
  if (job) query.jobId = new Types.ObjectId(job);
  if (status) query.status = status;

  const [data, total] = await Promise.all([
    JobOffer.find(query)
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title slug')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    JobOffer.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getOfferById(organizationId, id) {
  const offer = await JobOffer.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('candidateId', 'firstName lastName email phone')
    .populate('jobId', 'title slug departmentId')
    .populate('createdBy', 'firstName lastName')
    .lean();
  if (!offer) throw new AppError('Offer not found', 404);
  return toDTO(offer);
}

async function createOffer(organizationId, payload, actor, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const { applicationId, salary, currency, employmentType, startDate, offerExpiryDate, benefits, notes } = payload;

  if (!applicationId) throw new AppError('Application is required', 400);
  if (salary === undefined || salary === null || Number(salary) < 0) throw new AppError('A valid salary is required', 400);

  const application = await JobApplication.findOne({ _id: applicationId, organizationId: orgId })
    .populate('candidateId', 'firstName lastName')
    .populate('jobId', 'title');
  if (!application) throw new AppError('Application not found', 404);
  if (['REJECTED', 'WITHDRAWN', 'HIRED'].includes(application.status)) {
    throw new AppError(`Cannot create an offer for a ${application.status.toLowerCase()} application`, 400);
  }

  const activeOffer = await JobOffer.findOne({
    organizationId: orgId,
    applicationId: application._id,
    status: { $in: ['DRAFT', 'SENT', 'ACCEPTED'] },
  });
  if (activeOffer) throw new AppError('An active offer already exists for this application', 409);

  const offer = await JobOffer.create({
    organizationId: orgId,
    candidateId: application.candidateId._id,
    applicationId: application._id,
    jobId: application.jobId._id,
    salary: Number(salary),
    currency: currency || 'USD',
    employmentType: employmentType || 'FULL_TIME',
    startDate: startDate ? new Date(startDate) : undefined,
    offerExpiryDate: offerExpiryDate
      ? new Date(offerExpiryDate)
      : new Date(Date.now() + OFFER_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    benefits: benefits || [],
    notes,
    createdBy: actor._id,
  });

  await logActivity({
    organizationId, candidateId: application.candidateId._id, applicationId: application._id, actorId: actor._id,
    type: 'OFFER_CREATED', description: `Offer created for ${application.jobId.title}`,
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'OFFER_CREATED', entityType: 'JobOffer', entityId: offer._id,
    metadata: { applicationId: application._id.toString() }, ...reqMeta,
  });

  const dto = offer.toJSON();
  emitToOrg(organizationId, SOCKET_EVENTS.OFFER_CREATED, dto);
  return dto;
}

async function updateOffer(organizationId, id, payload, actor, reqMeta = {}) {
  const offer = await JobOffer.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!offer) throw new AppError('Offer not found', 404);
  if (offer.status !== 'DRAFT') throw new AppError('Only draft offers can be edited', 400);

  const fields = ['salary', 'currency', 'employmentType', 'startDate', 'offerExpiryDate', 'benefits', 'notes'];
  fields.forEach((f) => {
    if (payload[f] !== undefined) offer[f] = payload[f];
  });
  await offer.save();

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'OFFER_CREATED', entityType: 'JobOffer', entityId: offer._id,
    metadata: { updated: true }, ...reqMeta,
  });
  return offer.toJSON();
}

async function sendOffer(organizationId, id, actor, reqMeta = {}) {
  const offer = await JobOffer.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title');
  if (!offer) throw new AppError('Offer not found', 404);
  if (offer.status !== 'DRAFT') throw new AppError('Only draft offers can be sent', 400);

  offer.publicToken = crypto.randomBytes(32).toString('hex');
  offer.status = 'SENT';
  offer.sentAt = new Date();
  if (!offer.offerExpiryDate) {
    offer.offerExpiryDate = new Date(Date.now() + OFFER_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }
  await offer.save();

  await logActivity({
    organizationId, candidateId: offer.candidateId._id, applicationId: offer.applicationId, actorId: actor._id,
    type: 'OFFER_SENT', description: `Offer sent to ${offer.candidateId.email}`,
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'OFFER_SENT', entityType: 'JobOffer', entityId: offer._id,
    metadata: {}, ...reqMeta,
  });

  const dto = offer.toJSON();
  emitToOrg(organizationId, SOCKET_EVENTS.OFFER_SENT, dto);
  // The public response link would normally be emailed to the candidate.
  // Returned here so HR can share it manually until an email service is configured.
  return { ...dto, publicResponseUrl: `/careers/offer/${offer.publicToken}` };
}

async function withdrawOffer(organizationId, id, withdrawalReason, actor, reqMeta = {}) {
  const offer = await JobOffer.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!offer) throw new AppError('Offer not found', 404);
  if (!['DRAFT', 'SENT'].includes(offer.status)) throw new AppError('Only draft or sent offers can be withdrawn', 400);

  offer.status = 'WITHDRAWN';
  offer.withdrawalReason = withdrawalReason;
  offer.publicToken = undefined;
  await offer.save();

  await logActivity({
    organizationId, candidateId: offer.candidateId, applicationId: offer.applicationId, actorId: actor._id,
    type: 'OFFER_WITHDRAWN', description: `Offer withdrawn${withdrawalReason ? ` — ${withdrawalReason}` : ''}`,
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'OFFER_SENT', entityType: 'JobOffer', entityId: offer._id,
    metadata: { withdrawn: true, withdrawalReason }, ...reqMeta,
  });

  const dto = offer.toJSON();
  emitToOrg(organizationId, SOCKET_EVENTS.OFFER_WITHDRAWN, dto);
  return dto;
}

// ---- Public candidate response (token-based, no auth) ----

async function getPublicOffer(token) {
  const offer = await JobOffer.findOne({ publicToken: token, status: 'SENT' })
    .populate('jobId', 'title location employmentType workMode')
    .lean();
  if (!offer) throw new AppError('Offer not found or no longer available', 404);
  if (offer.offerExpiryDate && new Date(offer.offerExpiryDate) < new Date()) {
    await JobOffer.updateOne({ _id: offer._id }, { status: 'EXPIRED', publicToken: undefined });
    throw new AppError('This offer has expired', 410);
  }
  // Only intentionally public fields — never internal notes or org identifiers.
  return {
    jobTitle: offer.jobId?.title,
    location: offer.jobId?.location,
    employmentType: offer.employmentType,
    workMode: offer.jobId?.workMode,
    salary: offer.salary,
    currency: offer.currency,
    startDate: offer.startDate,
    benefits: offer.benefits,
    offerExpiryDate: offer.offerExpiryDate,
    status: offer.status,
  };
}

async function respondToPublicOffer(token, accept) {
  const offer = await JobOffer.findOne({ publicToken: token, status: 'SENT' })
    .populate('candidateId', 'firstName lastName')
    .populate('jobId', 'title');
  if (!offer) throw new AppError('Offer not found or no longer available', 404);
  if (offer.offerExpiryDate && new Date(offer.offerExpiryDate) < new Date()) {
    offer.status = 'EXPIRED';
    offer.publicToken = undefined;
    await offer.save();
    throw new AppError('This offer has expired', 410);
  }

  offer.status = accept ? 'ACCEPTED' : 'REJECTED';
  offer.respondedAt = new Date();
  offer.publicToken = undefined; // single-purpose token
  await offer.save();

  const organizationId = offer.organizationId.toString();
  const candidateName = `${offer.candidateId.firstName} ${offer.candidateId.lastName}`;

  await logActivity({
    organizationId, candidateId: offer.candidateId._id, applicationId: offer.applicationId,
    type: accept ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED',
    description: `Candidate ${accept ? 'accepted' : 'rejected'} the offer for ${offer.jobId.title}`,
  });
  await auditLogService.recordAction({
    organizationId, actorType: 'SYSTEM', action: accept ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED',
    entityType: 'JobOffer', entityId: offer._id, metadata: { respondedPublicly: true },
  });
  await notifyHR(
    organizationId,
    accept ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED',
    accept ? 'Offer accepted' : 'Offer rejected',
    `${candidateName} ${accept ? 'accepted' : 'rejected'} the offer for ${offer.jobId.title}`,
    offer._id
  );

  emitToOrg(organizationId, accept ? SOCKET_EVENTS.OFFER_ACCEPTED : SOCKET_EVENTS.OFFER_REJECTED, {
    offerId: offer._id.toString(),
    candidateId: offer.candidateId._id.toString(),
    candidateName,
    jobTitle: offer.jobId.title,
  });

  return { success: true, message: accept ? 'Offer accepted — the team will contact you shortly.' : 'Offer declined.' };
}

module.exports = {
  getOffers,
  getOfferById,
  createOffer,
  updateOffer,
  sendOffer,
  withdrawOffer,
  getPublicOffer,
  respondToPublicOffer,
};
