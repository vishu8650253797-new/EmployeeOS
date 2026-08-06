const onboardingTemplateService = require('../services/onboardingTemplateService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getTemplates = async (req, res) => {
  const { data, pagination } = await onboardingTemplateService.getTemplates(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getTemplateById = async (req, res) => {
  const data = await onboardingTemplateService.getTemplateById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createTemplate = async (req, res) => {
  const data = await onboardingTemplateService.createTemplate(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Template created', data });
};

exports.updateTemplate = async (req, res) => {
  const data = await onboardingTemplateService.updateTemplate(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Template updated', data });
};

exports.deleteTemplate = async (req, res) => {
  const data = await onboardingTemplateService.deleteTemplate(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json({ success: true, message: data.message });
};
