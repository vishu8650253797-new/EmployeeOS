const documentCategoryService = require('../services/documentCategoryService');

exports.getCategories = async (req, res) => {
  const { data } = await documentCategoryService.getCategories(req.organizationId, req.query);
  res.json({ success: true, data });
};

exports.getCategoryById = async (req, res) => {
  const data = await documentCategoryService.getCategoryById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createCategory = async (req, res) => {
  const data = await documentCategoryService.createCategory(req.organizationId, req.body, req.user._id);
  res.status(201).json({ success: true, message: 'Document category created', data });
};

exports.updateCategory = async (req, res) => {
  const data = await documentCategoryService.updateCategory(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'Document category updated', data });
};

exports.deleteCategory = async (req, res) => {
  const result = await documentCategoryService.deleteCategory(req.organizationId, req.params.id);
  res.json(result);
};
