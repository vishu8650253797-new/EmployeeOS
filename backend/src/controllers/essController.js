const essService = require('../services/essService');
const essProfileService = require('../services/essProfileService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getMe = async (req, res) => {
  const data = await essService.getMyContext(req.organizationId, req.user, reqMeta(req));
  res.json({ success: true, data });
};

exports.getProfile = async (req, res) => {
  const data = await essProfileService.getProfile(req.organizationId, req.user);
  res.json({ success: true, data });
};

exports.updateProfile = async (req, res) => {
  const data = await essProfileService.updateProfile(req.organizationId, req.user, req.body, reqMeta(req));
  res.json({ success: true, message: 'Profile updated', data });
};

exports.addEmergencyContact = async (req, res) => {
  const data = await essProfileService.addEmergencyContact(req.organizationId, req.user, req.body, reqMeta(req));
  res.status(201).json({ success: true, message: 'Emergency contact added', data });
};

exports.updateEmergencyContact = async (req, res) => {
  const data = await essProfileService.updateEmergencyContact(req.organizationId, req.user, req.params.contactId, req.body, reqMeta(req));
  res.json({ success: true, message: 'Emergency contact updated', data });
};

exports.removeEmergencyContact = async (req, res) => {
  const result = await essProfileService.removeEmergencyContact(req.organizationId, req.user, req.params.contactId, reqMeta(req));
  res.json(result);
};
