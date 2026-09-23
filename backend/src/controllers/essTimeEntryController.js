const timeEntryService = require('../services/timeEntryService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.startEntry = async (req, res) => {
  const data = await timeEntryService.startEntry(req.organizationId, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Time entry started', data });
};

exports.endEntry = async (req, res) => {
  const data = await timeEntryService.endEntry(req.organizationId, req.user, req.params.id, req.body, reqMeta(req));
  res.json({ success: true, message: 'Time entry ended', data });
};

exports.getEntries = async (req, res) => {
  const { data, pagination } = await timeEntryService.getMyEntries(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getEntryById = async (req, res) => {
  const data = await timeEntryService.getMyEntryById(req.organizationId, req.user, req.params.id);
  res.json({ success: true, data });
};
