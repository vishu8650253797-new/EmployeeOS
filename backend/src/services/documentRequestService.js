const { Types } = require('mongoose');
const { DocumentRequest, DocumentCategory, Employee, Notification } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getDocumentRequestRoom } = require('../socket/socketRooms');
const auditLogService = require('./auditLogService');
const documentService = require('./documentService');
const emailService = require('./emailService');

const ELEVATED_DOC_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];
const OPEN_STATUSES = ['PENDING', 'REJECTED'];

function assertRequestAccess(actor, request) {
  if (ELEVATED_DOC_ROLES.includes(actor.role)) return;
  if (actor.employeeId && request.employeeId.toString() === actor.employeeId.toString()) return;
  if (request.requestedBy && request.requestedBy.toString() === actor._id.toString()) return;
  throw new AppError('You are not authorized to access this document request', 403);
}

function toRequestDTO(request) {
  const emp = request.employeeId && request.employeeId._id ? request.employeeId : null;
  const cat = request.categoryId && request.categoryId._id ? request.categoryId : null;
  const requester = request.requestedBy && request.requestedBy._id ? request.requestedBy : null;
  const reviewer = request.reviewedBy && request.reviewedBy._id ? request.reviewedBy : null;

  return {
    id: request._id.toString(),
    organizationId: request.organizationId.toString(),
    processId: request.processId ? request.processId.toString() : null,
    employeeId: emp ? emp._id.toString() : request.employeeId.toString(),
    employeeName: emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
    categoryId: cat ? cat._id.toString() : request.categoryId.toString(),
    categoryName: cat?.name || 'Unknown',
    title: request.title,
    description: request.description || '',
    requestedBy: requester ? { id: requester._id.toString(), name: `${requester.firstName || ''} ${requester.lastName || ''}`.trim() } : null,
    status: request.status,
    priority: request.priority,
    dueDate: request.dueDate || null,
    documentId: request.documentId ? request.documentId.toString() : null,
    submittedAt: request.submittedAt || null,
    reviewedBy: reviewer ? { id: reviewer._id.toString(), name: `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() } : null,
    reviewedAt: request.reviewedAt || null,
    rejectionReason: request.rejectionReason || '',
    completedAt: request.completedAt || null,
    cancelledAt: request.cancelledAt || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

const POPULATE_FIELDS = [
  ['employeeId', 'firstName lastName employeeId departmentId'],
  ['categoryId', 'name code'],
  ['requestedBy', 'firstName lastName'],
  ['reviewedBy', 'firstName lastName'],
];

async function listRequests(query, filters = {}) {
  const { status, priority, categoryId, search, page = 1, limit = 20 } = filters;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  if (status && ['PENDING', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(status)) {
    query.status = status;
  }
  if (priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) query.priority = priority;
  if (categoryId) query.categoryId = new Types.ObjectId(categoryId);
  if (search && search.trim()) {
    query.title = new RegExp(search.trim(), 'i');
  }

  let builder = DocumentRequest.find(query);
  POPULATE_FIELDS.forEach(([path, select]) => { builder = builder.populate(path, select); });

  const [data, total] = await Promise.all([
    builder.sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    DocumentRequest.countDocuments(query),
  ]);

  return {
    data: data.map(toRequestDTO),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getRequests(organizationId, filters) {
  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (filters.employeeId) query.employeeId = new Types.ObjectId(filters.employeeId);
  if (filters.processId) query.processId = new Types.ObjectId(filters.processId);
  return listRequests(query, filters);
}

async function getMyRequests(organizationId, employeeId, filters) {
  const query = { organizationId: new Types.ObjectId(organizationId), employeeId: new Types.ObjectId(employeeId) };
  return listRequests(query, filters);
}

async function getRequestsByEmployee(organizationId, employeeId, actor, filters) {
  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role) && actor.employeeId?.toString() !== employeeId.toString()) {
    throw new AppError('You are not authorized to access these document requests', 403);
  }
  const query = { organizationId: new Types.ObjectId(organizationId), employeeId: new Types.ObjectId(employeeId) };
  return listRequests(query, filters);
}

async function getRequestById(organizationId, id, actor) {
  let builder = DocumentRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  POPULATE_FIELDS.forEach(([path, select]) => { builder = builder.populate(path, select); });
  const request = await builder.lean();
  if (!request) throw new AppError('Document request not found', 404);
  assertRequestAccess(actor, request);
  return toRequestDTO(request);
}

async function createRequest(organizationId, payload, actor) {
  const employee = await Employee.findOne({ _id: payload.employeeId, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!employee) throw new AppError('Employee not found', 404);

  const category = await DocumentCategory.findOne({ _id: payload.categoryId, organizationId: new Types.ObjectId(organizationId), isActive: true }).lean();
  if (!category) throw new AppError('Document category not found', 404);

  const request = await DocumentRequest.create({
    organizationId: new Types.ObjectId(organizationId),
    employeeId: employee._id,
    categoryId: category._id,
    processId: payload.processId || undefined,
    title: payload.title,
    description: payload.description || '',
    requestedBy: actor._id,
    priority: payload.priority || 'MEDIUM',
    dueDate: payload.dueDate || undefined,
    status: 'PENDING',
  });

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'DOCUMENT_REQUESTED',
    entityType: 'DOCUMENT_REQUEST', entityId: request._id,
  });

  if (employee.userId) {
    await Notification.create({
      organizationId: new Types.ObjectId(organizationId),
      recipientId: employee.userId,
      type: 'DOCUMENT_REQUESTED',
      title: 'New document request',
      message: `HR has requested: ${payload.title}`,
      entityType: 'DOCUMENT_REQUEST',
      entityId: request._id,
    });
  }

  await emailService.sendDocumentRequestEmail({
    to: employee.email,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    title: payload.title,
    dueDate: request.dueDate,
  });

  const io = getSocketInstance();
  if (io) {
    if (employee.userId) {
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.DOCUMENT_REQUEST_CREATED, { requestId: request._id.toString() });
      io.to(`user:${employee.userId.toString()}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW);
    }
    io.to(`organization:${organizationId}`).emit(SOCKET_EVENTS.DOCUMENT_REQUEST_CREATED, { requestId: request._id.toString() });
  }

  return getRequestById(organizationId, request._id, actor);
}

async function updateRequest(organizationId, id, payload, actor) {
  const request = await DocumentRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!request) throw new AppError('Document request not found', 404);
  if (request.status !== 'PENDING') throw new AppError('Only pending requests can be updated', 400);

  ['title', 'description', 'priority', 'dueDate'].forEach((f) => {
    if (payload[f] !== undefined) request[f] = payload[f];
  });

  await request.save();
  return getRequestById(organizationId, request._id, actor);
}

async function cancelRequest(organizationId, id, actor) {
  const request = await DocumentRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!request) throw new AppError('Document request not found', 404);
  assertRequestAccess(actor, request);
  if (request.status !== 'PENDING') throw new AppError('Only pending requests can be cancelled', 400);

  request.status = 'CANCELLED';
  request.cancelledAt = new Date();
  request.cancelledBy = actor._id;
  await request.save();

  await auditLogService.recordAction({
    organizationId, userId: actor._id, action: 'DOCUMENT_REQUEST_CANCELLED',
    entityType: 'DOCUMENT_REQUEST', entityId: request._id,
  });

  return getRequestById(organizationId, request._id, actor);
}

async function uploadForRequest(organizationId, id, file, payload, actor, reqMeta) {
  const request = await DocumentRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!request) throw new AppError('Document request not found', 404);
  assertRequestAccess(actor, request);
  if (!OPEN_STATUSES.includes(request.status)) throw new AppError('This document request is no longer open for upload', 400);

  return documentService.uploadDocument(
    organizationId,
    {
      employeeId: request.employeeId.toString(),
      categoryId: request.categoryId.toString(),
      title: payload.title || request.title,
      description: payload.description,
      documentNumber: payload.documentNumber,
      issueDate: payload.issueDate,
      expiryDate: payload.expiryDate,
      isConfidential: payload.isConfidential,
      requestId: request._id.toString(),
    },
    file,
    actor,
    reqMeta
  );
}

async function approveRequest(organizationId, id, actor, reqMeta) {
  const request = await DocumentRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!request) throw new AppError('Document request not found', 404);
  if (!request.documentId) throw new AppError('No document has been uploaded for this request yet', 400);
  await documentService.verifyDocument(organizationId, request.documentId, actor, reqMeta);
  return getRequestById(organizationId, request._id, actor);
}

async function rejectRequest(organizationId, id, actor, rejectionReason, reqMeta) {
  const request = await DocumentRequest.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!request) throw new AppError('Document request not found', 404);
  if (!request.documentId) throw new AppError('No document has been uploaded for this request yet', 400);
  await documentService.rejectDocument(organizationId, request.documentId, actor, rejectionReason, reqMeta);
  return getRequestById(organizationId, request._id, actor);
}

module.exports = {
  getRequests,
  getMyRequests,
  getRequestsByEmployee,
  getRequestById,
  createRequest,
  updateRequest,
  cancelRequest,
  uploadForRequest,
  approveRequest,
  rejectRequest,
};
