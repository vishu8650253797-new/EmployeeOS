const { Types } = require('mongoose');
const { JobOpening, Candidate, JobApplication, User } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const { uploadFile } = require('./storage');
const { validateFile } = require('../utils/fileValidation');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const { logActivity } = require('./candidateActivityService');

const RESUME_MAX_SIZE_MB = Number(process.env.RESUME_MAX_SIZE_MB) || 10;
const RESUME_ALLOWED_EXTENSIONS = (process.env.RESUME_ALLOWED_EXTENSIONS || 'pdf,doc,docx').split(',').map((e) => e.trim());

// Only intentionally public fields.
const PUBLIC_JOB_FIELDS = [
  'title', 'slug', 'location', 'employmentType', 'workMode', 'experienceLevel',
  'salaryMin', 'salaryMax', 'salaryCurrency', 'description', 'responsibilities',
  'requirements', 'qualifications', 'skills', 'benefits', 'numberOfOpenings', 'publishedAt',
].join(' ');

async function getPublicJobs(filters = {}) {
  const { search, location, employmentType, workMode, experienceLevel, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = { status: 'PUBLISHED' };
  if (search) query.title = { $regex: String(search).trim(), $options: 'i' };
  if (location) query.location = { $regex: String(location).trim(), $options: 'i' };
  if (employmentType) query.employmentType = employmentType;
  if (workMode) query.workMode = workMode;
  if (experienceLevel) query.experienceLevel = experienceLevel;

  const [data, total] = await Promise.all([
    JobOpening.find(query)
      .select(PUBLIC_JOB_FIELDS)
      .populate('departmentId', 'name')
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    JobOpening.countDocuments(query),
  ]);

  return {
    data: data.map((j) => ({ ...j, id: j._id.toString(), department: j.departmentId?.name })),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getPublicJobBySlug(slug) {
  const job = await JobOpening.findOne({ slug: String(slug).toLowerCase(), status: 'PUBLISHED' })
    .select(PUBLIC_JOB_FIELDS)
    .populate('departmentId', 'name')
    .lean();
  if (!job) throw new AppError('Job not found', 404);
  return { ...job, id: job._id.toString(), department: job.departmentId?.name };
}

function validateApplicationPayload(payload) {
  const errors = [];
  if (!payload.firstName || !payload.firstName.trim()) errors.push('First name is required');
  if (!payload.lastName || !payload.lastName.trim()) errors.push('Last name is required');
  const email = String(payload.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('A valid email is required');
  if (!payload.phone || !payload.phone.trim()) errors.push('Phone is required');
  if (errors.length) throw new AppError(errors.join('. '), 400);
  return email;
}

async function applyToJob(jobId, payload, file) {
  const job = await JobOpening.findOne({ _id: jobId, status: 'PUBLISHED' });
  if (!job) throw new AppError('This job is not accepting applications', 404);

  const email = validateApplicationPayload(payload);
  if (!file) throw new AppError('A resume is required', 400);

  // Authoritative resume validation (extension, MIME, magic bytes, size).
  const { extension, sanitizedName } = validateFile({
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    buffer: file.buffer,
    category: { allowedExtensions: RESUME_ALLOWED_EXTENSIONS, maxFileSizeMB: RESUME_MAX_SIZE_MB },
  });

  const organizationId = job.organizationId;

  // Find or create the candidate — one candidate record per org+email.
  let candidate = await Candidate.findOne({ organizationId, email });
  if (candidate) {
    // Duplicate application detection for the same job.
    const existingApp = await JobApplication.findOne({ organizationId, jobId: job._id, candidateId: candidate._id });
    if (existingApp) throw new AppError('You have already applied for this position', 409);
  } else {
    candidate = new Candidate({
      organizationId,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email,
      phone: payload.phone.trim(),
      location: payload.location,
      currentCompany: payload.currentCompany,
      currentJobTitle: payload.currentJobTitle,
      yearsOfExperience: payload.yearsOfExperience !== undefined && payload.yearsOfExperience !== '' ? Number(payload.yearsOfExperience) : undefined,
      skills: typeof payload.skills === 'string'
        ? payload.skills.split(',').map((s) => s.trim()).filter(Boolean)
        : (payload.skills || []),
      linkedinUrl: payload.linkedinUrl,
      portfolioUrl: payload.portfolioUrl,
      githubUrl: payload.githubUrl,
      source: 'CAREERS_PAGE',
    });
  }

  // Store the resume via the existing secure storage facade.
  const resumeFileId = new Types.ObjectId();
  const { storageKey, checksum } = await uploadFile({
    buffer: file.buffer,
    organizationId,
    documentId: resumeFileId,
    extension,
  });
  candidate.resume = {
    originalFileName: sanitizedName,
    storageKey,
    mimeType: file.mimetype,
    fileExtension: extension,
    fileSize: file.size,
    checksum,
    uploadedAt: new Date(),
  };
  await candidate.save();

  const application = await JobApplication.create({
    organizationId,
    jobId: job._id,
    candidateId: candidate._id,
    coverLetter: payload.coverLetter ? String(payload.coverLetter).slice(0, 5000) : undefined,
    source: 'CAREERS_PAGE',
  });

  await logActivity({
    organizationId, candidateId: candidate._id, applicationId: application._id,
    type: 'APPLICATION_SUBMITTED', description: `Applied for ${job.title} via careers page`,
  });
  await auditLogService.recordAction({
    organizationId, actorType: 'SYSTEM', action: 'APPLICATION_CREATED',
    entityType: 'JobApplication', entityId: application._id,
    metadata: { jobId: job._id.toString(), source: 'CAREERS_PAGE' },
  });

  // Notify recruitment users and update dashboards in real time.
  const recruiters = await User.find({
    organizationId,
    role: { $in: ['SUPER_ADMIN', 'HR_ADMIN', 'RECRUITER'] },
    status: 'active',
  }).select('_id').lean();
  await Promise.all(
    recruiters.map((u) =>
      notificationService.createNotification({
        organizationId, recipientId: u._id, type: 'NEW_APPLICATION',
        title: 'New application received',
        message: `${candidate.firstName} ${candidate.lastName} applied for ${job.title}`,
        entityType: 'JobApplication', entityId: application._id,
      })
    )
  );

  const io = getSocketInstance();
  if (io) {
    io.to(getOrganizationRoom(organizationId.toString())).emit(SOCKET_EVENTS.APPLICATION_RECEIVED, {
      applicationId: application._id.toString(),
      candidateId: candidate._id.toString(),
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      jobId: job._id.toString(),
      jobTitle: job.title,
    });
  }

  // Never leak internal identifiers to public callers.
  return { success: true, message: 'Application submitted successfully' };
}

module.exports = { getPublicJobs, getPublicJobBySlug, applyToJob, RESUME_MAX_SIZE_MB, RESUME_ALLOWED_EXTENSIONS };
