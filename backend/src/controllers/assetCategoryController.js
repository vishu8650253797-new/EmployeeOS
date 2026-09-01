const assetCategoryService = require('../services/assetCategoryService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getCategories = async (req, res) => {
  const { data } = await assetCategoryService.getCategories(req.organizationId, req.query);
  res.json({ success: true, data });
};

exports.getCategoryById = async (req, res) => {
  const data = await assetCategoryService.getCategoryById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createCategory = async (req, res) => {
  const data = await assetCategoryService.createCategory(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Asset category created', data });
};

exports.updateCategory = async (req, res) => {
  const data = await assetCategoryService.updateCategory(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset category updated', data });
};

exports.deleteCategory = async (req, res) => {
  const result = await assetCategoryService.deleteCategory(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json(result);
};
