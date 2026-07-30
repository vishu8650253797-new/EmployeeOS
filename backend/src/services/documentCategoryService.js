const { Types } = require('mongoose');
const { DocumentCategory } = require('../models');
const AppError = require('../utils/AppError');

function toDTO(category) {
  return { ...category, id: category._id.toString() };
}

async function getCategories(organizationId, filters = {}) {
  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (filters.isActive === 'true') query.isActive = true;
  if (filters.isActive === 'false') query.isActive = false;
  if (!filters.includeInactive && filters.isActive === undefined) query.isActive = true;

  const data = await DocumentCategory.find(query).sort({ name: 1 }).lean();
  return { data: data.map(toDTO) };
}

async function getCategoryById(organizationId, id) {
  const category = await DocumentCategory.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!category) throw new AppError('Document category not found', 404);
  return toDTO(category);
}

async function createCategory(organizationId, payload, actorUserId) {
  const exists = await DocumentCategory.findOne({
    organizationId: new Types.ObjectId(organizationId),
    name: payload.name.trim(),
  });
  if (exists) throw new AppError('A document category with this name already exists', 409);

  const category = await DocumentCategory.create({
    organizationId: new Types.ObjectId(organizationId),
    name: payload.name.trim(),
    code: payload.code || 'OTHER',
    description: payload.description || '',
    allowedExtensions: payload.allowedExtensions?.length ? payload.allowedExtensions.map((e) => e.toLowerCase()) : undefined,
    maxFileSizeMB: payload.maxFileSizeMB,
    isConfidentialByDefault: !!payload.isConfidentialByDefault,
    isMandatory: !!payload.isMandatory,
    requiresExpiry: !!payload.requiresExpiry,
    requiresVerification: payload.requiresVerification !== undefined ? !!payload.requiresVerification : true,
    expiryWarningDays: payload.expiryWarningDays,
    createdBy: actorUserId,
  });
  return toDTO(category.toObject());
}

async function updateCategory(organizationId, id, payload) {
  const category = await DocumentCategory.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!category) throw new AppError('Document category not found', 404);

  const fields = [
    'name', 'code', 'description', 'maxFileSizeMB', 'isConfidentialByDefault',
    'isMandatory', 'requiresExpiry', 'requiresVerification', 'expiryWarningDays', 'isActive',
  ];
  fields.forEach((f) => {
    if (payload[f] !== undefined) category[f] = payload[f];
  });
  if (payload.allowedExtensions !== undefined) {
    category.allowedExtensions = payload.allowedExtensions.map((e) => e.toLowerCase());
  }

  await category.save();
  return toDTO(category.toObject());
}

// Soft delete only — categories are referenced by existing documents and
// requests, so a hard delete would orphan those references.
async function deleteCategory(organizationId, id) {
  const category = await DocumentCategory.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) });
  if (!category) throw new AppError('Document category not found', 404);
  category.isActive = false;
  await category.save();
  return { success: true, message: 'Document category deactivated' };
}

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
