const { Employee } = require('../models');
const documentService = require('../services/documentService');
const auditLogService = require('../services/auditLogService');

async function resolveEmployeeId(req) {
  if (req.user.employeeId) return req.user.employeeId;
  const employee = await Employee.findOne({ userId: req.user._id }).lean();
  return employee ? employee._id : null;
}

function streamFile(res, { stream, size, filename, mimeType }, disposition) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', size);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

exports.getDocuments = async (req, res) => {
  const { data, pagination } = await documentService.getDocuments(req.organizationId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getMyDocuments = async (req, res) => {
  const employeeId = await resolveEmployeeId(req);
  if (!employeeId) throw new Error('Employee profile not linked');
  const { data, pagination } = await documentService.getMyDocuments(req.organizationId, employeeId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getDocumentsByEmployee = async (req, res) => {
  const { data, pagination } = await documentService.getDocumentsByEmployee(req.organizationId, req.params.employeeId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getDocumentsByCategory = async (req, res) => {
  const { data, pagination } = await documentService.getDocumentsByCategory(req.organizationId, req.params.categoryId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getExpiredDocuments = async (req, res) => {
  const { data, pagination } = await documentService.getExpiredDocuments(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getExpiringDocuments = async (req, res) => {
  const { data, pagination } = await documentService.getExpiringDocuments(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getDocumentById = async (req, res) => {
  const data = await documentService.getDocumentById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.uploadDocument = async (req, res) => {
  const data = await documentService.uploadDocument(req.organizationId, req.body, req.file, req.user, auditLogService.requestMeta(req));
  res.status(201).json({ success: true, message: 'Document uploaded', data });
};

exports.updateDocument = async (req, res) => {
  const data = await documentService.updateDocument(req.organizationId, req.params.id, req.body, req.user);
  res.json({ success: true, message: 'Document updated', data });
};

exports.replaceDocument = async (req, res) => {
  const data = await documentService.replaceDocument(req.organizationId, req.params.id, req.file, req.body, req.user, auditLogService.requestMeta(req));
  res.json({ success: true, message: 'Document replaced', data });
};

exports.verifyDocument = async (req, res) => {
  const data = await documentService.verifyDocument(req.organizationId, req.params.id, req.user, auditLogService.requestMeta(req));
  res.json({ success: true, message: 'Document verified', data });
};

exports.rejectDocument = async (req, res) => {
  const data = await documentService.rejectDocument(req.organizationId, req.params.id, req.user, req.body.rejectionReason, auditLogService.requestMeta(req));
  res.json({ success: true, message: 'Document rejected', data });
};

exports.deleteDocument = async (req, res) => {
  const result = await documentService.deleteDocument(req.organizationId, req.params.id, req.user, auditLogService.requestMeta(req));
  res.json(result);
};

exports.downloadDocument = async (req, res) => {
  const file = await documentService.downloadDocument(req.organizationId, req.params.id, req.user, auditLogService.requestMeta(req));
  streamFile(res, file, 'attachment');
};

exports.previewDocument = async (req, res) => {
  const file = await documentService.previewDocument(req.organizationId, req.params.id, req.user, auditLogService.requestMeta(req));
  streamFile(res, file, 'inline');
};

exports.getDocumentVersions = async (req, res) => {
  const { data } = await documentService.getDocumentVersions(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.downloadDocumentVersion = async (req, res) => {
  const file = await documentService.downloadDocumentVersion(req.organizationId, req.params.id, req.params.versionId, req.user, auditLogService.requestMeta(req));
  streamFile(res, file, 'attachment');
};
