const shiftService = require('../services/shiftService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getShifts = async (req, res) => {
  const { data, pagination } = await shiftService.getShifts(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getShiftById = async (req, res) => {
  const data = await shiftService.getShiftById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createShift = async (req, res) => {
  const data = await shiftService.createShift(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Shift created', data });
};

exports.updateShift = async (req, res) => {
  const data = await shiftService.updateShift(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Shift updated', data });
};

exports.setShiftStatus = async (req, res) => {
  const data = await shiftService.setShiftStatus(req.organizationId, req.params.id, req.body.status, req.user, reqMeta(req));
  res.json({ success: true, message: 'Shift status updated', data });
};

exports.archiveShift = async (req, res) => {
  const result = await shiftService.archiveShift(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json(result);
};
