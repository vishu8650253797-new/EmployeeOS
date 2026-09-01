const assetMaintenanceService = require('../services/assetMaintenanceService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getMaintenanceForAsset = async (req, res) => {
  const { data } = await assetMaintenanceService.getMaintenanceForAsset(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.createMaintenance = async (req, res) => {
  const data = await assetMaintenanceService.createMaintenance(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Maintenance issue reported', data });
};

exports.getMaintenanceList = async (req, res) => {
  const { data, pagination } = await assetMaintenanceService.getMaintenanceList(req.organizationId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getMaintenanceById = async (req, res) => {
  const data = await assetMaintenanceService.getMaintenanceById(req.organizationId, req.params.maintenanceId, req.user);
  res.json({ success: true, data });
};

exports.updateMaintenance = async (req, res) => {
  const data = await assetMaintenanceService.updateMaintenance(req.organizationId, req.params.maintenanceId, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Maintenance record updated', data });
};
