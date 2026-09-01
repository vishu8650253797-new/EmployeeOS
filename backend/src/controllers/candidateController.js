const candidateService = require('../services/candidateService');
const { requestMeta } = require('../services/auditLogService');

exports.getCandidates = async (req, res) => {
  const { data, pagination } = await candidateService.getCandidates(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getCandidateById = async (req, res) => {
  const data = await candidateService.getCandidateById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createCandidate = async (req, res) => {
  const data = await candidateService.createCandidate(req.organizationId, req.body, req.user, requestMeta(req));
  res.status(201).json({ success: true, message: 'Candidate created', data });
};

exports.updateCandidate = async (req, res) => {
  const data = await candidateService.updateCandidate(req.organizationId, req.params.id, req.body, req.user, requestMeta(req));
  res.json({ success: true, message: 'Candidate updated', data });
};

exports.updateTags = async (req, res) => {
  const data = await candidateService.updateTags(req.organizationId, req.params.id, req.body.tags, req.user);
  res.json({ success: true, message: 'Tags updated', data });
};

exports.assignRecruiter = async (req, res) => {
  const data = await candidateService.assignRecruiter(req.organizationId, req.params.id, req.body.recruiterId, req.user, requestMeta(req));
  res.json({ success: true, message: 'Recruiter assigned', data });
};

exports.downloadResume = async (req, res) => {
  const { stream, size, fileName, mimeType } = await candidateService.downloadResume(req.organizationId, req.params.id);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', size);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  stream.pipe(res);
};

exports.getNotes = async (req, res) => {
  const data = await candidateService.getNotes(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.createNote = async (req, res) => {
  const data = await candidateService.createNote(req.organizationId, req.params.id, req.body, req.user);
  res.status(201).json({ success: true, message: 'Note added', data });
};

exports.updateNote = async (req, res) => {
  const data = await candidateService.updateNote(req.organizationId, req.params.noteId, req.body, req.user);
  res.json({ success: true, message: 'Note updated', data });
};

exports.deleteNote = async (req, res) => {
  const result = await candidateService.deleteNote(req.organizationId, req.params.noteId, req.user);
  res.json(result);
};

exports.getActivities = async (req, res) => {
  const data = await candidateService.getActivities(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.convertToEmployee = async (req, res) => {
  const data = await candidateService.convertToEmployee(req.organizationId, req.params.id, req.body, req.user, requestMeta(req));
  res.status(201).json({ success: true, message: 'Candidate converted to employee', data });
};
