const { Types } = require('mongoose');
const {
  EmployeeDocument,
  DocumentCategory,
  DocumentVersion,
  DocumentRequest,
  Employee,
  User,
} = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getDocumentRoom, getDocumentRequestRoom } = require('../socket/socketRooms');
const storageService = require('./storage');
const { validateFile } = require('../utils/fileValidation');
const { getDocumentExpiryStatus, getDaysUntilExpiry, EXPIRY_WARNING_DAYS_DEFAULT } = require('../utils/documentExpiry');
const { withTransaction } = require('../utils/withTransaction');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');

const ELEVATED_DOC_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];
const PREVIEWABLE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const SORTABLE_FIELDS = ['createdAt', 'title', 'expiryDate', 'status', 'verificationStatus', 'fileSize'];

function assertDocAccess(actor, employeeId) {
  if (ELEVATED_DOC_ROLES.includes(actor.role)) return;
  if (actor.employeeId && actor.employeeId.toString() === employeeId.toString()) return;
  throw new AppError('You are not authorized to access this document', 403);
}

function getEmployeeIdRaw(doc) {
  return doc.employeeId && doc.employeeId._id ? doc.employeeId._id : doc.employeeId;
}

function toDocumentDTO(doc) {
  const emp = doc.employeeId && doc.employeeId._id ? doc.employeeId : null;
  const cat = doc.categoryId && doc.categoryId._id ? doc.categoryId : null;
  const uploader = doc.uploadedBy && doc.uploadedBy._id ? doc.uploadedBy : null;
  const verifier = doc.verifiedBy && doc.verifiedBy._id ? doc.verifiedBy : null;
  const expiryStatus = getDocumentExpiryStatus(doc.expiryDate, cat?.expiryWarningDays || EXPIRY_WARNING_DAYS_DEFAULT);

  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    employeeId: emp ? emp._id.toString() : doc.employeeId.toString(),
    employeeName: emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
    employeeCode: emp?.employeeId || '',
    departmentId: emp?.departmentId ? emp.departmentId.toString() : null,
    categoryId: cat ? cat._id.toString() : doc.categoryId.toString(),
    categoryName: cat?.name || 'Unknown',
    categoryCode: cat?.code || 'OTHER',
    title: doc.title,
    description: doc.description || '',
    documentNumber: doc.documentNumber || '',
    issueDate: doc.issueDate || null,
    expiryDate: doc.expiryDate || null,
    expiryStatus,
    daysUntilExpiry: getDaysUntilExpiry(doc.expiryDate),
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileExtension: doc.fileExtension,
    fileSize: doc.fileSize,
    currentVersion: doc.currentVersion,
    status: doc.status,
    verificationStatus: doc.verificationStatus,
    isConfidential: doc.isConfidential,
    uploadedBy: uploader ? { id: uploader._id.toString(), name: `${uploader.firstName || ''} ${uploader.lastName || ''}`.trim() } : null,
    verifiedBy: verifier ? { id: verifier._id.toString(), name: `${verifier.firstName || ''} ${verifier.lastName || ''}`.trim() } : null,
    verifiedAt: doc.verifiedAt || null,
    rejectionReason: doc.rejectionReason || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toVersionDTO(version, { isCurrent = false } = {}) {
  const uploader = version.uploadedBy && version.uploadedBy._id ? version.uploadedBy : null;
  return {
    id: isCurrent ? 'current' : version._id.toString(),
    documentId: (isCurrent ? version._id : version.documentId)?.toString(),
    versionNumber: isCurrent ? version.currentVersion : version.versionNumber,
    originalFileName: version.originalFileName,
    mimeType: version.mimeType,
    fileExtension: version.fileExtension,
    fileSize: version.fileSize,
    uploadedBy: uploader ? { id: uploader._id.toString(), name: `${uploader.firstName || ''} ${uploader.lastName || ''}`.trim() } : null,
    replacedReason: version.replacedReason || '',
    isCurrent,
    createdAt: isCurrent ? version.updatedAt : version.createdAt,
  };
}

function safeSort(sortBy) {
  return SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
}

async function findHRRecipients(organizationId) {
  return User.find({
    organizationId: new Types.ObjectId(organizationId),
    role: { $in: ['HR_ADMIN', 'SUPER_ADMIN'] },
    status: 'active',
  }).lean();
}

async function notifyUsers(organizationId, recipients, { type, title, message, entityId }) {
  for (const recipient of recipients) {
    const userId = recipient._id.toString();
    await notificationService.createNotification({
      organizationId,
      recipientId: userId,
      type,
      title,
      message,
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId,
    });
  }
}

async function resolveEmployeeDepartmentFilter(organizationId, departmentId) {
  const employees = await Employee.find({
    organizationId: new Types.ObjectId(organizationId),
    departmentId: new Types.ObjectId(departmentId),
  }).select('_id').lean();
  return employees.map((e) => e._id);
}

async function listDocuments(query, filters = {}) {
  const {
    status, verificationStatus, categoryId, uploadedBy, search,
    expiryStatus, sortBy, sortOrder, page = 1, limit = 20,
  } = filters;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  if (status && ['ACTIVE', 'EXPIRED', 'ARCHIVED'].includes(status)) query.status = status;
  if (verificationStatus && ['PENDING', 'VERIFIED', 'REJECTED'].includes(verificationStatus)) {
    query.verificationStatus = verificationStatus;
  }
  if (categoryId) query.categoryId = new Types.ObjectId(categoryId);
  if (uploadedBy) query.uploadedBy = new Types.ObjectId(uploadedBy);

  if (expiryStatus) {
    const now = new Date();
    const warningBoundary = new Date(now.getTime() + EXPIRY_WARNING_DAYS_DEFAULT * 24 * 60 * 60 * 1000);
    if (expiryStatus === 'NO_EXPIRY') query.expiryDate = null;
    else if (expiryStatus === 'EXPIRED') query.expiryDate = { $lt: now };
    else if (expiryStatus === 'EXPIRING_SOON') query.expiryDate = { $gte: now, $lte: warningBoundary };
    else if (expiryStatus === 'VALID') query.expiryDate = { $gt: warningBoundary };
  }

  if (search && search.trim()) {
    const q = new RegExp(search.trim(), 'i');
    query.$or = [{ title: q }, { documentNumber: q }, { originalFileName: q }];
  }

  const sort = { [safeSort(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    EmployeeDocument.find(query)
      .populate('employeeId', 'firstName lastName employeeId departmentId')
      .populate('categoryId', 'name code expiryWarningDays')
      .populate('uploadedBy', 'firstName lastName')
      .populate('verifiedBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    EmployeeDocument.countDocuments(query),
  ]);

  return {
    data: data.map(toDocumentDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getDocuments(organizationId, filters, actor) {
  const query = { organizationId: new Types.ObjectId(organizationId), isDeleted: false };
  if (!ELEVATED_DOC_ROLES.includes(actor.role)) {
    if (!actor.employeeId) throw new AppError('Employee profile not linked', 403);
    query.employeeId = new Types.ObjectId(actor.employeeId);
  } else {
    if (filters.employeeId) query.employeeId = new Types.ObjectId(filters.employeeId);
    if (filters.departmentId) {
      const ids = await resolveEmployeeDepartmentFilter(organizationId, filters.departmentId);
      query.employeeId = { $in: ids };
    }
  }
  return listDocuments(query, filters);
}

async function getMyDocuments(organizationId, employeeId, filters) {
  const query = { organizationId: new Types.ObjectId(organizationId), employeeId: new Types.ObjectId(employeeId), isDeleted: false };
  return listDocuments(query, filters);
}

async function getDocumentsByEmployee(organizationId, employeeId, actor, filters) {
  assertDocAccess(actor, employeeId);
  const query = { organizationId: new Types.ObjectId(organizationId), employeeId: new Types.ObjectId(employeeId), isDeleted: false };
  return listDocuments(query, filters);
}

async function getDocumentsByCategory(organizationId, categoryId, actor, filters) {
  const query = { organizationId: new Types.ObjectId(organizationId), categoryId: new Types.ObjectId(categoryId), isDeleted: false };
  if (!ELEVATED_DOC_ROLES.includes(actor.role)) {
    if (!actor.employeeId) throw new AppError('Employee profile not linked', 403);
    query.employeeId = new Types.ObjectId(actor.employeeId);
  }
  return listDocuments(query, filters);
}

async function getExpiredDocuments(organizationId, filters) {
  const query = {
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: false,
    expiryDate: { $lt: new Date() },
  };
  return listDocuments(query, filters);
}

async function getExpiringDocuments(organizationId, filters) {
  const days = Number(filters.days) || EXPIRY_WARNING_DAYS_DEFAULT;
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const query = {
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: false,
    expiryDate: { $gte: now, $lte: future },
  };
  return listDocuments(query, filters);
}

async function getDocumentById(organizationId, id, actor) {
  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false })
    .populate('employeeId', 'firstName lastName employeeId departmentId')
    .populate('categoryId', 'name code expiryWarningDays')
    .populate('uploadedBy', 'firstName lastName')
    .populate('verifiedBy', 'firstName lastName')
    .lean();
  if (!doc) throw new AppError('Document not found', 404);
  assertDocAccess(actor, getEmployeeIdRaw(doc));
  return toDocumentDTO(doc);
}

async function uploadDocument(organizationId, payload, file, actor, reqMeta = {}) {
  if (!file) throw new AppError('File is required', 400);

  const employeeId = payload.employeeId || actor.employeeId;
  if (!employeeId) throw new AppError('Employee profile not linked', 400);
  assertDocAccess(actor, employeeId);

  const employee = await Employee.findOne({ _id: employeeId, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!employee) throw new AppError('Employee not found', 404);

  const category = await DocumentCategory.findOne({ _id: payload.categoryId, organizationId: new Types.ObjectId(organizationId), isActive: true });
  if (!category) throw new AppError('Document category not found', 404);

  let request = null;
  if (payload.requestId) {
    request = await DocumentRequest.findOne({ _id: payload.requestId, organizationId: new Types.ObjectId(organizationId) });
    if (!request) throw new AppError('Document request not found', 404);
    if (request.employeeId.toString() !== employeeId.toString()) throw new AppError('This request is not assigned to this employee', 403);
    if (!['PENDING', 'REJECTED'].includes(request.status)) throw new AppError('This document request is no longer open for upload', 400);
  }

  const { extension } = validateFile({
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    buffer: file.buffer,
    category,
  });

  const documentId = new Types.ObjectId();
  const { storageKey, checksum } = await storageService.uploadFile({
    buffer: file.buffer,
    organizationId,
    employeeId,
    documentId,
    versionNumber: 1,
    extension,
  });

  const verificationStatus = category.requiresVerification ? 'PENDING' : 'VERIFIED';
  const isConfidential = payload.isConfidential !== undefined ? !!payload.isConfidential : category.isConfidentialByDefault;

  const doc = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const [created] = await EmployeeDocument.create(
      [{
        _id: documentId,
        organizationId: new Types.ObjectId(organizationId),
        employeeId: new Types.ObjectId(employeeId),
        categoryId: category._id,
        title: payload.title,
        description: payload.description || '',
        documentNumber: payload.documentNumber || '',
        issueDate: payload.issueDate || undefined,
        expiryDate: payload.expiryDate || undefined,
        originalFileName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        fileExtension: extension,
        fileSize: file.size,
        checksum,
        currentVersion: 1,
        status: 'ACTIVE',
        verificationStatus,
        isConfidential,
        uploadedBy: actor._id,
      }],
      opts
    );

    if (request) {
      request.status = 'UPLOADED';
      request.documentId = created._id;
      request.submittedAt = new Date();
      await request.save(opts);
    }

    await auditLogService.recordAction({
      organizationId, userId: actor._id, action: 'DOCUMENT_UPLOADED',
      entityType: 'EMPLOYEE_DOCUMENT', entityId: created._id,
      metadata: { title: created.title, categoryId: String(category._id) },
      ...reqMeta, session,
    });

    return created;
  });

  const io = getSocketInstance();
  const hrRecipients = await findHRRecipients(organizationId);
  await notifyUsers(organizationId, hrRecipients, {
    type: 'DOCUMENT_UPLOADED',
    title: 'New document uploaded',
    message: `${employee.firstName} ${employee.lastName} uploaded ${payload.title}`,
    entityId: doc._id,
  });

  if (io) {
    io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DOCUMENT_UPLOADED, { documentId: doc._id.toString(), employeeId: String(employeeId) });
    if (employee.userId) io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.DOCUMENT_UPLOADED, { documentId: doc._id.toString() });
    if (request) {
      io.to(getDocumentRequestRoom(request._id)).emit(SOCKET_EVENTS.DOCUMENT_REQUEST_UPLOADED, { requestId: request._id.toString(), documentId: doc._id.toString() });
      io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DOCUMENT_REQUEST_UPLOADED, { requestId: request._id.toString() });
    }
  }

  return getDocumentById(organizationId, doc._id, actor);
}

async function updateDocument(organizationId, id, payload, actor) {
  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false });
  if (!doc) throw new AppError('Document not found', 404);
  assertDocAccess(actor, doc.employeeId);

  const selfEditableFields = ['title', 'description', 'documentNumber', 'issueDate', 'expiryDate'];
  const elevatedOnlyFields = ['isConfidential'];
  const fields = ELEVATED_DOC_ROLES.includes(actor.role) ? [...selfEditableFields, ...elevatedOnlyFields] : selfEditableFields;

  fields.forEach((f) => {
    if (payload[f] !== undefined) doc[f] = payload[f];
  });

  await doc.save();

  const io = getSocketInstance();
  if (io) io.to(getDocumentRoom(doc._id)).emit(SOCKET_EVENTS.DOCUMENT_UPDATED, { documentId: doc._id.toString() });

  return getDocumentById(organizationId, doc._id, actor);
}

async function replaceDocument(organizationId, id, file, payload, actor, reqMeta = {}) {
  if (!file) throw new AppError('File is required', 400);

  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false });
  if (!doc) throw new AppError('Document not found', 404);
  assertDocAccess(actor, doc.employeeId);

  const category = await DocumentCategory.findOne({ _id: doc.categoryId, organizationId: new Types.ObjectId(organizationId) }).lean();

  const { extension } = validateFile({
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    buffer: file.buffer,
    category,
  });

  const newVersionNumber = doc.currentVersion + 1;
  const { storageKey, checksum } = await storageService.uploadFile({
    buffer: file.buffer,
    organizationId,
    employeeId: doc.employeeId,
    documentId: doc._id,
    versionNumber: newVersionNumber,
    extension,
  });

  const previous = {
    versionNumber: doc.currentVersion,
    originalFileName: doc.originalFileName,
    storageKey: doc.storageKey,
    mimeType: doc.mimeType,
    fileExtension: doc.fileExtension,
    fileSize: doc.fileSize,
    checksum: doc.checksum,
    uploadedBy: doc.uploadedBy,
  };

  await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;

    await DocumentVersion.create(
      [{
        organizationId: new Types.ObjectId(organizationId),
        documentId: doc._id,
        ...previous,
        replacedReason: payload.changeReason || '',
      }],
      opts
    );

    doc.originalFileName = file.originalname;
    doc.storageKey = storageKey;
    doc.mimeType = file.mimetype;
    doc.fileExtension = extension;
    doc.fileSize = file.size;
    doc.checksum = checksum;
    doc.currentVersion = newVersionNumber;
    doc.uploadedBy = actor._id;
    doc.status = 'ACTIVE';
    doc.verificationStatus = category?.requiresVerification ? 'PENDING' : 'VERIFIED';
    doc.rejectionReason = '';
    doc.verifiedBy = undefined;
    doc.verifiedAt = undefined;
    await doc.save(opts);

    await auditLogService.recordAction({
      organizationId, userId: actor._id, action: 'DOCUMENT_REPLACED',
      entityType: 'EMPLOYEE_DOCUMENT', entityId: doc._id,
      metadata: { newVersion: newVersionNumber },
      ...reqMeta, session,
    });
  });

  const employee = await Employee.findById(doc.employeeId).lean();
  const io = getSocketInstance();
  if (io) {
    io.to(getDocumentRoom(doc._id)).emit(SOCKET_EVENTS.DOCUMENT_REPLACED, { documentId: doc._id.toString(), version: newVersionNumber });
    if (employee?.userId) io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.DOCUMENT_REPLACED, { documentId: doc._id.toString() });
    io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DOCUMENT_REPLACED, { documentId: doc._id.toString() });
  }

  return getDocumentById(organizationId, doc._id, actor);
}

async function verifyDocument(organizationId, id, actor, reqMeta = {}) {
  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false });
  if (!doc) throw new AppError('Document not found', 404);
  if (doc.verificationStatus === 'VERIFIED') throw new AppError('Document is already verified', 400);

  let request = null;
  await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;

    doc.verificationStatus = 'VERIFIED';
    doc.verifiedBy = actor._id;
    doc.verifiedAt = new Date();
    doc.rejectionReason = '';
    await doc.save(opts);

    request = await DocumentRequest.findOne({ organizationId: new Types.ObjectId(organizationId), documentId: doc._id, status: { $in: ['UPLOADED', 'UNDER_REVIEW'] } }, null, opts);
    if (request) {
      request.status = 'APPROVED';
      request.reviewedBy = actor._id;
      request.reviewedAt = new Date();
      request.completedAt = new Date();
      await request.save(opts);
    }

    await auditLogService.recordAction({
      organizationId, userId: actor._id, action: 'DOCUMENT_VERIFIED',
      entityType: 'EMPLOYEE_DOCUMENT', entityId: doc._id, ...reqMeta, session,
    });
    if (request) {
      await auditLogService.recordAction({
        organizationId, userId: actor._id, action: 'DOCUMENT_REQUEST_APPROVED',
        entityType: 'DOCUMENT_REQUEST', entityId: request._id, ...reqMeta, session,
      });
    }
  });

  const employee = await Employee.findById(doc.employeeId).lean();
  if (employee?.userId) {
    await notificationService.createNotification({
      organizationId,
      recipientId: employee.userId,
      type: 'DOCUMENT_VERIFIED',
      title: 'Document verified',
      message: `Your document "${doc.title}" has been successfully verified.`,
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: doc._id,
    });
  }

  const io = getSocketInstance();
  if (io) {
    io.to(getDocumentRoom(doc._id)).emit(SOCKET_EVENTS.DOCUMENT_VERIFIED, { documentId: doc._id.toString() });
    if (employee?.userId) {
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.DOCUMENT_VERIFIED, { documentId: doc._id.toString() });
    }
    if (request) {
      io.to(getDocumentRequestRoom(request._id)).emit(SOCKET_EVENTS.DOCUMENT_REQUEST_APPROVED, { requestId: request._id.toString() });
      if (employee?.userId) io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.DOCUMENT_REQUEST_APPROVED, { requestId: request._id.toString() });
    }
  }

  return getDocumentById(organizationId, doc._id, actor);
}

async function rejectDocument(organizationId, id, actor, rejectionReason, reqMeta = {}) {
  if (!rejectionReason || !rejectionReason.trim()) throw new AppError('Rejection reason is required', 400);

  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false });
  if (!doc) throw new AppError('Document not found', 404);
  if (doc.verificationStatus === 'REJECTED') throw new AppError('Document is already rejected', 400);

  let request = null;
  await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;

    doc.verificationStatus = 'REJECTED';
    doc.verifiedBy = actor._id;
    doc.verifiedAt = new Date();
    doc.rejectionReason = rejectionReason.trim();
    await doc.save(opts);

    request = await DocumentRequest.findOne({ organizationId: new Types.ObjectId(organizationId), documentId: doc._id, status: { $in: ['UPLOADED', 'UNDER_REVIEW'] } }, null, opts);
    if (request) {
      request.status = 'REJECTED';
      request.reviewedBy = actor._id;
      request.reviewedAt = new Date();
      request.rejectionReason = rejectionReason.trim();
      await request.save(opts);
    }

    await auditLogService.recordAction({
      organizationId, userId: actor._id, action: 'DOCUMENT_REJECTED',
      entityType: 'EMPLOYEE_DOCUMENT', entityId: doc._id,
      metadata: { rejectionReason: rejectionReason.trim() }, ...reqMeta, session,
    });
    if (request) {
      await auditLogService.recordAction({
        organizationId, userId: actor._id, action: 'DOCUMENT_REQUEST_REJECTED',
        entityType: 'DOCUMENT_REQUEST', entityId: request._id, ...reqMeta, session,
      });
    }
  });

  const employee = await Employee.findById(doc.employeeId).lean();
  if (employee?.userId) {
    await notificationService.createNotification({
      organizationId,
      recipientId: employee.userId,
      type: 'DOCUMENT_REJECTED',
      title: 'Document rejected',
      message: `Your document "${doc.title}" was rejected: ${rejectionReason.trim()}`,
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: doc._id,
    });
  }

  const io = getSocketInstance();
  if (io) {
    io.to(getDocumentRoom(doc._id)).emit(SOCKET_EVENTS.DOCUMENT_REJECTED, { documentId: doc._id.toString(), rejectionReason: doc.rejectionReason });
    if (employee?.userId) {
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.DOCUMENT_REJECTED, { documentId: doc._id.toString(), rejectionReason: doc.rejectionReason });
    }
    if (request) {
      io.to(getDocumentRequestRoom(request._id)).emit(SOCKET_EVENTS.DOCUMENT_REQUEST_REJECTED, { requestId: request._id.toString() });
      if (employee?.userId) io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.DOCUMENT_REQUEST_REJECTED, { requestId: request._id.toString() });
    }
  }

  return getDocumentById(organizationId, doc._id, actor);
}

async function deleteDocument(organizationId, id, actor, reqMeta = {}) {
  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false });
  if (!doc) throw new AppError('Document not found', 404);
  assertDocAccess(actor, doc.employeeId);

  if (!ELEVATED_DOC_ROLES.includes(actor.role) && doc.verificationStatus === 'VERIFIED') {
    throw new AppError('Verified documents cannot be deleted — please contact HR', 403);
  }

  doc.isDeleted = true;
  doc.deletedAt = new Date();
  doc.deletedBy = actor._id;
  await doc.save();

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'DOCUMENT_DELETED',
    entityType: 'EMPLOYEE_DOCUMENT', entityId: doc._id, ...reqMeta,
  });

  const io = getSocketInstance();
  if (io) {
    io.to(getDocumentRoom(doc._id)).emit(SOCKET_EVENTS.DOCUMENT_DELETED, { documentId: doc._id.toString() });
    io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DOCUMENT_DELETED, { documentId: doc._id.toString() });
  }

  return { success: true, message: 'Document deleted' };
}

async function downloadDocument(organizationId, id, actor, reqMeta = {}) {
  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false });
  if (!doc) throw new AppError('Document not found', 404);
  assertDocAccess(actor, doc.employeeId);

  const { stream, size } = await storageService.getFileStream(doc.storageKey);

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'DOCUMENT_DOWNLOADED',
    entityType: 'EMPLOYEE_DOCUMENT', entityId: doc._id, ...reqMeta,
  });

  return { stream, size, filename: doc.originalFileName, mimeType: doc.mimeType };
}

async function previewDocument(organizationId, id, actor, reqMeta = {}) {
  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false }).lean();
  if (!doc) throw new AppError('Document not found', 404);
  assertDocAccess(actor, doc.employeeId);

  if (!PREVIEWABLE_MIME_TYPES.includes(doc.mimeType)) {
    throw new AppError('Preview not available for this file type', 415);
  }

  const { stream, size } = await storageService.getFileStream(doc.storageKey);

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'DOCUMENT_VIEWED',
    entityType: 'EMPLOYEE_DOCUMENT', entityId: doc._id, ...reqMeta,
  });

  return { stream, size, filename: doc.originalFileName, mimeType: doc.mimeType };
}

async function getDocumentVersions(organizationId, id, actor) {
  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false })
    .populate('uploadedBy', 'firstName lastName')
    .lean();
  if (!doc) throw new AppError('Document not found', 404);
  assertDocAccess(actor, getEmployeeIdRaw(doc));

  const versions = await DocumentVersion.find({ organizationId: new Types.ObjectId(organizationId), documentId: id })
    .populate('uploadedBy', 'firstName lastName')
    .sort({ versionNumber: -1 })
    .lean();

  return { data: [toVersionDTO(doc, { isCurrent: true }), ...versions.map((v) => toVersionDTO(v))] };
}

async function downloadDocumentVersion(organizationId, id, versionId, actor, reqMeta = {}) {
  const doc = await EmployeeDocument.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false }).lean();
  if (!doc) throw new AppError('Document not found', 404);
  assertDocAccess(actor, doc.employeeId);

  let storageKey; let filename; let mimeType;
  if (versionId === 'current') {
    storageKey = doc.storageKey; filename = doc.originalFileName; mimeType = doc.mimeType;
  } else {
    const version = await DocumentVersion.findOne({ _id: versionId, organizationId: new Types.ObjectId(organizationId), documentId: id }).lean();
    if (!version) throw new AppError('Document version not found', 404);
    storageKey = version.storageKey; filename = version.originalFileName; mimeType = version.mimeType;
  }

  const { stream, size } = await storageService.getFileStream(storageKey);

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'DOCUMENT_DOWNLOADED',
    entityType: 'EMPLOYEE_DOCUMENT', entityId: doc._id, metadata: { versionId }, ...reqMeta,
  });

  return { stream, size, filename, mimeType };
}

module.exports = {
  getDocuments,
  getMyDocuments,
  getDocumentsByEmployee,
  getDocumentsByCategory,
  getExpiredDocuments,
  getExpiringDocuments,
  getDocumentById,
  uploadDocument,
  updateDocument,
  replaceDocument,
  verifyDocument,
  rejectDocument,
  deleteDocument,
  downloadDocument,
  previewDocument,
  getDocumentVersions,
  downloadDocumentVersion,
  assertDocAccess,
};
