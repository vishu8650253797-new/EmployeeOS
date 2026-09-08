const { Types } = require('mongoose');
const { SalaryComponent, SalaryStructure } = require('../models');
const { COMPONENT_TYPES, CALCULATION_TYPES } = require('../models/SalaryComponent');
const AppError = require('../utils/AppError');
const auditLogService = require('./auditLogService');

function toDTO(component) {
  return { ...component, id: component._id.toString() };
}

async function getComponents(organizationId, filters = {}) {
  const query = { organizationId: new Types.ObjectId(organizationId), isDeleted: false };
  if (filters.type && COMPONENT_TYPES.includes(filters.type)) query.type = filters.type;
  if (filters.isActive === 'true') query.isActive = true;
  if (filters.isActive === 'false') query.isActive = false;

  const components = await SalaryComponent.find(query).sort({ type: 1, order: 1, name: 1 }).lean();
  return { data: components.map(toDTO) };
}

async function getComponentById(organizationId, id) {
  const component = await SalaryComponent.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: false }).lean();
  if (!component) throw new AppError('Salary component not found', 404);
  return toDTO(component);
}

async function validateCalculationConfig(organizationId, orgId, payload, excludeId) {
  if (payload.calculationType === 'PERCENTAGE_OF_COMPONENT') {
    if (!payload.percentageOfComponentId) {
      throw new AppError('percentageOfComponentId is required when calculationType is PERCENTAGE_OF_COMPONENT', 400);
    }
    if (excludeId && payload.percentageOfComponentId === excludeId.toString()) {
      throw new AppError('A component cannot reference itself', 400);
    }
    const target = await SalaryComponent.findOne({ _id: payload.percentageOfComponentId, organizationId: orgId, isDeleted: false });
    if (!target) throw new AppError('The referenced percentageOfComponentId does not exist', 400);
    if (target.calculationType === 'PERCENTAGE_OF_GROSS') {
      throw new AppError('A component cannot reference a percentage-of-gross component', 400);
    }
  }
}

async function createComponent(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  if (!COMPONENT_TYPES.includes(payload.type)) throw new AppError('Invalid component type', 400);
  if (!CALCULATION_TYPES.includes(payload.calculationType)) throw new AppError('Invalid calculation type', 400);

  const code = (payload.code || '').trim().toUpperCase();
  const exists = await SalaryComponent.findOne({ organizationId: orgId, code, isDeleted: false });
  if (exists) throw new AppError('A salary component with this code already exists', 409);

  await validateCalculationConfig(organizationId, orgId, payload, null);

  const component = await SalaryComponent.create({
    organizationId: orgId,
    code,
    name: payload.name.trim(),
    type: payload.type,
    calculationType: payload.calculationType,
    percentageOfComponentId: payload.calculationType === 'PERCENTAGE_OF_COMPONENT' ? payload.percentageOfComponentId : undefined,
    isStatutory: payload.isStatutory || false,
    isTaxable: payload.isTaxable !== undefined ? payload.isTaxable : true,
    isProratable: payload.isProratable !== undefined ? payload.isProratable : true,
    order: payload.order || 0,
    description: payload.description || '',
    createdBy: user._id,
    updatedBy: user._id,
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'SALARY_COMPONENT_CREATED', entityType: 'SalaryComponent', entityId: component._id,
    metadata: { code: component.code, type: component.type }, ...reqMeta,
  });

  return toDTO(component.toObject());
}

async function updateComponent(organizationId, id, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const component = await SalaryComponent.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  if (!component) throw new AppError('Salary component not found', 404);

  if (payload.code && payload.code.trim().toUpperCase() !== component.code) {
    const code = payload.code.trim().toUpperCase();
    const exists = await SalaryComponent.findOne({ organizationId: orgId, code, isDeleted: false, _id: { $ne: component._id } });
    if (exists) throw new AppError('A salary component with this code already exists', 409);
    component.code = code;
  }

  const calculationType = payload.calculationType || component.calculationType;
  if (payload.calculationType || payload.percentageOfComponentId !== undefined) {
    await validateCalculationConfig(organizationId, orgId, { calculationType, percentageOfComponentId: payload.percentageOfComponentId }, component._id);
  }

  const fields = ['name', 'type', 'isStatutory', 'isTaxable', 'isProratable', 'isActive', 'order', 'description'];
  fields.forEach((f) => {
    if (payload[f] !== undefined) component[f] = payload[f];
  });
  if (payload.calculationType !== undefined) {
    component.calculationType = payload.calculationType;
    component.percentageOfComponentId = payload.calculationType === 'PERCENTAGE_OF_COMPONENT' ? payload.percentageOfComponentId : undefined;
  }
  component.updatedBy = user._id;

  await component.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'SALARY_COMPONENT_UPDATED', entityType: 'SalaryComponent', entityId: component._id,
    metadata: { changed: Object.keys(payload) }, ...reqMeta,
  });

  return toDTO(component.toObject());
}

async function isReferenced(organizationId, componentId) {
  const orgId = new Types.ObjectId(organizationId);
  const id = new Types.ObjectId(componentId);
  const referencingStructure = await SalaryStructure.findOne({
    organizationId: orgId,
    isDeleted: false,
    $or: [
      { basicComponentId: id },
      { 'components.componentId': id },
    ],
  }).select('_id').lean();
  return Boolean(referencingStructure);
}

async function deleteComponent(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const component = await SalaryComponent.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  if (!component) throw new AppError('Salary component not found', 404);

  const referenced = await isReferenced(organizationId, component._id);
  if (referenced) {
    throw new AppError('This component is used by one or more salary structures and cannot be deleted', 409);
  }

  component.isDeleted = true;
  component.updatedBy = user._id;
  await component.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'SALARY_COMPONENT_DELETED', entityType: 'SalaryComponent', entityId: component._id,
    metadata: { code: component.code }, ...reqMeta,
  });

  return { success: true, message: 'Salary component deleted' };
}

module.exports = { getComponents, getComponentById, createComponent, updateComponent, deleteComponent, isReferenced };
