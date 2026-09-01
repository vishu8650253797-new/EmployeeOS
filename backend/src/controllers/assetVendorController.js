const assetVendorService = require('../services/assetVendorService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getVendors = async (req, res) => {
  const { data, pagination } = await assetVendorService.getVendors(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getVendorById = async (req, res) => {
  const data = await assetVendorService.getVendorById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createVendor = async (req, res) => {
  const data = await assetVendorService.createVendor(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Vendor created', data });
};

exports.updateVendor = async (req, res) => {
  const data = await assetVendorService.updateVendor(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Vendor updated', data });
};

exports.deleteVendor = async (req, res) => {
  const result = await assetVendorService.deleteVendor(req.organizationId, req.params.id);
  res.json(result);
};
