const { Types } = require('mongoose');
const { Candidate, JobApplication, CandidateNote, Employee, User } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom, getUserRoom } = require('../socket/socketRooms');
const { withTransaction } = require('../utils/withTransaction');
const { getFileStream } = require('./storage');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');
const { logActivity, getCandidateActivities } = require('./candidateActivityService');

const DEFAULTS = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };

function toDTO(candidate) {
  const dto = { ...candidate, id: candidate._id.toString() };
  if (dto.resume) {
    dto.resume = { ...dto.resume };
    delete dto.resume.storageKey;
    dto.hasResume = true;
  } else {
    dto.hasResume = false;
  }
  return dto;
}

function emitToOrg(organizationId, event, payload) {
  const io = getSocketInstance();
  if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
}

async function getCandidates(organizationId, filters = {}) {
  const {
    search, job, status, source, assignedRecruiter, skills, location, tags,
    experienceMin, experienceMax, page, limit, sortBy, sortOrder,
  } = filters;

  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };

  if (search) {
    const rx = { $regex: search.trim(), $options: 'i' };
    query.$or = [
      { firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx },
      { currentCompany: rx }, { currentJobTitle: rx }, { skills: rx },
    ];
  }
  if (status) query.status = status;
  if (source) query.source = source;
  if (assignedRecruiter) query.assignedRecruiterId = new Types.ObjectId(assignedRecruiter);
  if (skills) query.skills = { $in: skills.split(',').map((s) => new RegExp(`^${s.trim()}$`, 'i')) };
  if (tags) query.tags = { $in: tags.split(',').map((t) => t.trim()) };
  if (location) query.location = { $regex: location.trim(), $options: 'i' };
  if (experienceMin !== undefined && experienceMin !== '') {
    query.yearsOfExperience = { ...(query.yearsOfExperience || {}), $gte: Number(experienceMin) };
  }
  if (experienceMax !== undefined && experienceMax !== '') {
    query.yearsOfExperience = { ...(query.yearsOfExperience || {}), $lte: Number(experienceMax) };
  }

  if (job) {
    const applications = await JobApplication.find({
      organizationId: new Types.ObjectId(organizationId),
      jobId: new Types.ObjectId(job),
    }).select('candidateId').lean();
    query._id = { $in: applications.map((a) => a.candidateId) };
  }

  const sort = { [sortBy || DEFAULTS.sortBy]: (sortOrder || DEFAULTS.sortOrder) === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    Candidate.find(query)
      .populate('assignedRecruiterId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Candidate.countDocuments(query),
  ]);

  return {
    data: data.map(toDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getCandidateById(organizationId, id) {
  const candidate = await Candidate.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) })
    .populate('assignedRecruiterId', 'firstName lastName email')
    .lean();
  if (!candidate) throw new AppError('Candidate not found', 404);

  const applications = await JobApplication.find({
    organizationId: new Types.ObjectId(organizationId),
    candidateId: candidate._id,
  })
    .populate('jobId', 'title slug status')
    .sort({ appliedAt: -1 })
    .lean();

  return {
    ...toDTO(candidate),
    applications: applications.map((a) => ({ ...a, id: a._id.toString() })),
  };
}

async function updateCandidate(organizationId, id, payload, actor, reqMeta = {}) {
  const candidate = await Candidate.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!candidate) throw new AppError('Candidate not found', 404);

  const fields = [
    'firstName', 'lastName', 'phone', 'location', 'currentCompany', 'currentJobTitle',
    'yearsOfExperience', 'skills', 'linkedinUrl', 'portfolioUrl', 'githubUrl', 'source',
  ];
  fields.forEach((f) => {
    if (payload[f] !== undefined) candidate[f] = payload[f];
  });
  await candidate.save();

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'CANDIDATE_UPDATED', entityType: 'Candidate', entityId: candidate._id,
    metadata: { email: candidate.email }, ...reqMeta,
  });
  emitToOrg(organizationId, SOCKET_EVENTS.CANDIDATE_UPDATED, candidate.toJSON());
  return candidate.toJSON();
}

async function updateTags(organizationId, id, tags, actor) {
  const candidate = await Candidate.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!candidate) throw new AppError('Candidate not found', 404);

  candidate.tags = [...new Set((tags || []).map((t) => String(t).trim()).filter(Boolean))];
  await candidate.save();

  await logActivity({
    organizationId, candidateId: candidate._id, actorId: actor._id,
    type: 'TAGS_UPDATED', description: `Tags updated: ${candidate.tags.join(', ') || 'none'}`,
  });
  emitToOrg(organizationId, SOCKET_EVENTS.CANDIDATE_UPDATED, candidate.toJSON());
  return candidate.toJSON();
}

async function assignRecruiter(organizationId, id, recruiterId, actor, reqMeta = {}) {
  const candidate = await Candidate.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!candidate) throw new AppError('Candidate not found', 404);

  const recruiter = await User.findOne({ _id: recruiterId, organizationId: new Types.ObjectId(organizationId) });
  if (!recruiter) throw new AppError('Recruiter not found in this organization', 404);

  candidate.assignedRecruiterId = recruiter._id;
  await candidate.save();

  await logActivity({
    organizationId, candidateId: candidate._id, actorId: actor._id,
    type: 'CANDIDATE_ASSIGNED', description: `Assigned to ${recruiter.firstName} ${recruiter.lastName}`,
  });
  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'CANDIDATE_ASSIGNED', entityType: 'Candidate', entityId: candidate._id,
    metadata: { recruiterId: recruiter._id.toString() }, ...reqMeta,
  });
  await notificationService.createNotification({
    organizationId, recipientId: recruiter._id, type: 'CANDIDATE_ASSIGNED',
    title: 'Candidate assigned to you',
    message: `${candidate.firstName} ${candidate.lastName} has been assigned to you`,
    entityType: 'Candidate', entityId: candidate._id,
  });

  const io = getSocketInstance();
  if (io) io.to(getUserRoom(recruiter._id.toString())).emit(SOCKET_EVENTS.CANDIDATE_ASSIGNED, candidate.toJSON());
  return candidate.toJSON();
}

async function downloadResume(organizationId, id) {
  const candidate = await Candidate.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!candidate) throw new AppError('Candidate not found', 404);
  if (!candidate.resume?.storageKey) throw new AppError('Candidate has no resume on file', 404);

  const { stream, size } = await getFileStream(candidate.resume.storageKey);
  return {
    stream,
    size,
    fileName: candidate.resume.originalFileName || `resume.${candidate.resume.fileExtension || 'pdf'}`,
    mimeType: candidate.resume.mimeType || 'application/octet-stream',
  };
}

// ---- Notes ----

async function getNotes(organizationId, candidateId, actor) {
  const query = {
    organizationId: new Types.ObjectId(organizationId),
    candidateId: new Types.ObjectId(candidateId),
  };
  // Private notes are only visible to their author and elevated roles.
  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role)) {
    query.$or = [{ isPrivate: false }, { authorId: actor._id }];
  }
  const data = await CandidateNote.find(query)
    .populate('authorId', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .lean();
  return data.map((d) => ({ ...d, id: d._id.toString() }));
}

async function createNote(organizationId, candidateId, payload, actor) {
  const candidate = await Candidate.findOne({ _id: candidateId, organizationId: new Types.ObjectId(organizationId) });
  if (!candidate) throw new AppError('Candidate not found', 404);
  if (!payload.content || !payload.content.trim()) throw new AppError('Note content is required', 400);

  const note = await CandidateNote.create({
    organizationId: new Types.ObjectId(organizationId),
    candidateId: candidate._id,
    applicationId: payload.applicationId || undefined,
    authorId: actor._id,
    content: payload.content.trim(),
    isPrivate: !!payload.isPrivate,
  });

  await logActivity({
    organizationId, candidateId: candidate._id, actorId: actor._id,
    type: 'NOTE_ADDED', description: 'Note added',
  });
  return note.toJSON();
}

async function updateNote(organizationId, noteId, payload, actor) {
  const note = await CandidateNote.findOne({ _id: noteId, organizationId: new Types.ObjectId(organizationId) });
  if (!note) throw new AppError('Note not found', 404);
  if (note.authorId.toString() !== actor._id.toString() && !['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role)) {
    throw new AppError('You can only edit your own notes', 403);
  }
  if (payload.content !== undefined) note.content = payload.content.trim();
  if (payload.isPrivate !== undefined) note.isPrivate = !!payload.isPrivate;
  await note.save();
  return note.toJSON();
}

async function deleteNote(organizationId, noteId, actor) {
  const note = await CandidateNote.findOne({ _id: noteId, organizationId: new Types.ObjectId(organizationId) });
  if (!note) throw new AppError('Note not found', 404);
  if (note.authorId.toString() !== actor._id.toString() && !['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role)) {
    throw new AppError('You can only delete your own notes', 403);
  }
  await note.deleteOne();
  return { success: true, message: 'Note deleted' };
}

// ---- Activity timeline ----

async function getActivities(organizationId, candidateId) {
  return getCandidateActivities(organizationId, candidateId);
}

// ---- Candidate → Employee conversion ----

async function convertToEmployee(organizationId, candidateId, payload, actor, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const candidate = await Candidate.findOne({ _id: candidateId, organizationId: orgId });
  if (!candidate) throw new AppError('Candidate not found', 404);
  if (candidate.convertedEmployeeId) throw new AppError('Candidate has already been converted to an employee', 409);

  // Duplicate prevention: same email or phone must not already be an employee.
  const existing = await Employee.findOne({
    organizationId: orgId,
    isDeleted: false,
    $or: [
      { email: candidate.email },
      ...(candidate.phone ? [{ phone: candidate.phone }] : []),
    ],
  });
  if (existing) throw new AppError('An employee with this email or phone already exists', 409);

  if (!payload.jobTitle) throw new AppError('Job title is required', 400);
  if (!payload.joiningDate) throw new AppError('Joining date is required', 400);

  const employeeCount = await Employee.countDocuments({ organizationId: orgId });
  const employeeCode = payload.employeeId || `EMP-${String(employeeCount + 1).padStart(4, '0')}`;

  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;

    const [employee] = await Employee.create(
      [
        {
          organizationId: orgId,
          employeeId: employeeCode,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: payload.email || candidate.email,
          phone: candidate.phone,
          departmentId: payload.departmentId || undefined,
          jobTitle: payload.jobTitle,
          managerId: payload.managerId || undefined,
          role: payload.role || 'EMPLOYEE',
          employmentType: payload.employmentType || 'FULL_TIME',
          joiningDate: new Date(payload.joiningDate),
          location: candidate.location,
        },
      ],
      opts
    );

    candidate.status = 'HIRED';
    candidate.convertedEmployeeId = employee._id;
    await candidate.save(opts);

    await JobApplication.updateMany(
      { organizationId: orgId, candidateId: candidate._id, status: { $in: ['OFFER', 'INTERVIEW', 'SHORTLISTED', 'SCREENING', 'NEW'] } },
      { status: 'HIRED', lastStatusChangedAt: new Date() },
      opts
    );

    await auditLogService.recordAction({
      organizationId, userId: actor._id, action: 'CANDIDATE_CONVERTED_TO_EMPLOYEE',
      entityType: 'Candidate', entityId: candidate._id,
      metadata: { employeeId: employee._id.toString(), employeeCode }, session, ...reqMeta,
    });

    return employee;
  });

  // Post-commit side effects.
  await logActivity({
    organizationId, candidateId: candidate._id, actorId: actor._id,
    type: 'CANDIDATE_HIRED', description: `Hired and converted to employee (${employeeCode})`,
  });

  const hrUsers = await User.find({ organizationId: orgId, role: { $in: ['SUPER_ADMIN', 'HR_ADMIN'] }, status: 'active' }).select('_id').lean();
  await Promise.all(
    hrUsers.map((u) =>
      notificationService.createNotification({
        organizationId, recipientId: u._id, type: 'CANDIDATE_HIRED',
        title: 'Candidate hired',
        message: `${candidate.firstName} ${candidate.lastName} has been hired and converted to an employee`,
        entityType: 'Candidate', entityId: candidate._id,
      })
    )
  );

  emitToOrg(organizationId, SOCKET_EVENTS.CANDIDATE_HIRED, {
    candidateId: candidate._id.toString(),
    employeeId: result._id.toString(),
    name: `${candidate.firstName} ${candidate.lastName}`,
  });

  return { candidate: candidate.toJSON(), employee: result.toJSON() };
}

module.exports = {
  getCandidates,
  getCandidateById,
  updateCandidate,
  updateTags,
  assignRecruiter,
  downloadResume,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  getActivities,
  convertToEmployee,
};
