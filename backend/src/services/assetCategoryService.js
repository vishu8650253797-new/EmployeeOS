const { Types } = require('mongoose');
const { AssetCategory, Asset } = require('../models');
const AppError = require('../utils/AppError');
const auditLogService = require('./auditLogService');

function toDTO(category) {
  return { ...category, id: category._id.toString() };
}

async function getCategories(organizationId, filters = {}) {
  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (filters.isActive === 'true') query.isActive = true;
  if (filters.isActive === 'false') query.isActive = false;
  if (!filters.includeInactive && filters.isActive === undefined) query.isActive = true;

  const categories = await AssetCategory.find(query).sort({ name: 1 }).lean();

  const counts = await Asset.aggregate([
    { $match: { organizationId: new Types.ObjectId(organizationId), isDeleted: false } },
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return { data: categories.map((c) => ({ ...toDTO(c), assetCount: countMap.get(c._id.toString()) || 0 })) };
}

async function getCategoryById(organizationId, id) {
  const category = await AssetCategory.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!category) throw new AppError('Asset category not found', 404);
  return toDTO(category);
}

async function createCategory(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const exists = await AssetCategory.findOne({ organizationId: orgId, name: payload.name.trim() });
  if (exists) throw new AppError('An asset category with this name already exists', 409);

  const category = await AssetCategory.create({
    organizationId: orgId,
    name: payload.name.trim(),
    description: payload.description || '',
    icon: payload.icon || 'Package',
    createdBy: user._id,
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ASSET_CATEGORY_CREATED', entityType: 'AssetCategory', entityId: category._id,
    metadata: { name: category.name }, ...reqMeta,
  });

  return toDTO(category.toObject());
}

async function updateCategory(organizationId, id, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const category = await AssetCategory.findOne({ _id: id, organizationId: orgId });
  if (!category) throw new AppError('Asset category not found', 404);

  if (payload.name && payload.name.trim() !== category.name) {
    const exists = await AssetCategory.findOne({
      organizationId: category.organizationId,
      name: payload.name.trim(),
      _id: { $ne: category._id },
    });
    if (exists) throw new AppError('An asset category with this name already exists', 409);
    category.name = payload.name.trim();
  }

  const fields = ['description', 'icon', 'isActive'];
  fields.forEach((f) => {
    if (payload[f] !== undefined) category[f] = payload[f];
  });

  await category.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ASSET_CATEGORY_UPDATED', entityType: 'AssetCategory', entityId: category._id,
    metadata: { name: category.name }, ...reqMeta,
  });

  return toDTO(category.toObject());
}

// Soft delete only — categories are referenced by existing assets, so a hard
// delete would orphan those references. Deactivating hides it from pickers
// while leaving historical assets intact.
async function deleteCategory(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const category = await AssetCategory.findOne({ _id: id, organizationId: orgId });
  if (!category) throw new AppError('Asset category not found', 404);

  const activeAssetCount = await Asset.countDocuments({
    organizationId: category.organizationId,
    categoryId: category._id,
    isDeleted: false,
  });

  let message;
  if (activeAssetCount > 0) {
    category.isActive = false;
    await category.save();
    message = `Category deactivated (${activeAssetCount} asset(s) still reference it)`;
  } else {
    await category.deleteOne();
    message = 'Asset category deleted';
  }

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'ASSET_CATEGORY_DELETED', entityType: 'AssetCategory', entityId: category._id,
    metadata: { name: category.name, softDeleted: activeAssetCount > 0 }, ...reqMeta,
  });

  return { success: true, message };
}

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
