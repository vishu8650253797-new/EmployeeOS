const { Types } = require('mongoose');
const { SalaryStructure, SalaryComponent, EmployeeCompensation } = require('../models');
const AppError = require('../utils/AppError');
const auditLogService = require('./auditLogService');
const { resolveEvaluationOrder, PayrollCalculationError } = require('./payrollCalculationEngine');

function toDTO(structure) {
  return { ...structure, id: structure._id.toString() };
}

async function fetchComponentDocs(orgId, componentIds) {
  const docs = await SalaryComponent.find({ _id: { $in: componentIds }, organizationId: orgId, isDeleted: false }).lean();
  return new Map(docs.map((d) => [d._id.toString(), d]));
}

// Splits the structure's flat `components` list into the engine's
// earning/deduction/employer-contribution families by looking up each
// referenced SalaryComponent's type, and merges in the structure's own
// `value` for each — the engine itself never touches the database.
async function buildEngineInput(orgId, componentsPayload) {
  const componentIds = componentsPayload.map((c) => c.componentId);
  const docsById = await fetchComponentDocs(orgId, componentIds);

  const missing = componentsPayload.filter((c) => !docsById.has(c.componentId.toString()));
  if (missing.length > 0) {
    throw new AppError('One or more referenced salary components do not exist in this organization', 400);
  }

  const merged = componentsPayload.map((c) => {
    const doc = docsById.get(c.componentId.toString());
    return {
      componentId: doc._id,
      code: doc.code,
      name: doc.name,
      type: doc.type,
      calculationType: doc.calculationType,
      percentageOfComponentId: doc.percentageOfComponentId,
      isProratable: doc.isProratable,
      value: c.value,
    };
  });

  return {
    earningComponents: merged.filter((c) => c.type === 'EARNING'),
    deductionComponents: merged.filter((c) => c.type === 'DEDUCTION'),
    employerContributionComponents: merged.filter((c) => c.type === 'EMPLOYER_CONTRIBUTION'),
  };
}

// Runs the exact same evaluation-order logic the run-time engine uses, so a
// structure with a circular or otherwise invalid component reference is
// rejected the moment it is saved — long before any payroll run touches it.
async function validateStructureComponents(orgId, componentsPayload, basicComponentId) {
  if (!componentsPayload || componentsPayload.length === 0) return;

  const ids = componentsPayload.map((c) => c.componentId.toString());
  if (new Set(ids).size !== ids.length) {
    throw new AppError('A salary structure cannot list the same component more than once', 400);
  }

  const { earningComponents, deductionComponents, employerContributionComponents } = await buildEngineInput(orgId, componentsPayload);

  const usesBasic = earningComponents.some((c) => c.calculationType === 'PERCENTAGE_OF_BASIC')
    || deductionComponents.some((c) => c.calculationType === 'PERCENTAGE_OF_BASIC')
    || employerContributionComponents.some((c) => c.calculationType === 'PERCENTAGE_OF_BASIC');
  if (usesBasic && !basicComponentId) {
    throw new AppError('basicComponentId is required because one or more components use PERCENTAGE_OF_BASIC', 400);
  }

  try {
    resolveEvaluationOrder({
      earningComponents, deductionComponents, employerContributionComponents,
      basicComponentId: basicComponentId ? basicComponentId.toString() : null,
    });
  } catch (err) {
    if (err instanceof PayrollCalculationError) throw new AppError(err.message, 400);
    throw err;
  }
}

async function getStructures(organizationId, filters = {}) {
  const query = { organizationId: new Types.ObjectId(organizationId), isDeleted: false };
  if (filters.isActive === 'true') query.isActive = true;
  if (filters.isActive === 'false') query.isActive = false;

  const structures = await SalaryStructure.find(query).sort({ name: 1 }).lean();
  return { data: structures.map(toDTO) };
}

// Enriches each component entry with its code/name/type/calculationType for display.
async function enrichComponents(orgId, structure) {
  if (!structure.components || structure.components.length === 0) return structure;
  const docsById = await fetchComponentDocs(orgId, structure.components.map((c) => c.componentId));
  return {
    ...structure,
    components: structure.components.map((c) => {
      const doc = docsById.get(c.componentId.toString());
      return {
        ...c,
        code: doc?.code,
        name: doc?.name,
        type: doc?.type,
        calculationType: doc?.calculationType,
      };
    }),
  };
}

async function getStructureById(organizationId, id) {
  const orgId = new Types.ObjectId(organizationId);
  const structure = await SalaryStructure.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
  if (!structure) throw new AppError('Salary structure not found', 404);
  return toDTO(await enrichComponents(orgId, structure));
}

async function createStructure(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);

  const exists = await SalaryStructure.findOne({ organizationId: orgId, name: payload.name.trim(), isDeleted: false });
  if (exists) throw new AppError('A salary structure with this name already exists', 409);

  const components = payload.components || [];
  await validateStructureComponents(orgId, components, payload.basicComponentId);

  const structure = await SalaryStructure.create({
    organizationId: orgId,
    name: payload.name.trim(),
    description: payload.description || '',
    currency: payload.currency || 'INR',
    basicComponentId: payload.basicComponentId || undefined,
    components,
    isActive: payload.isActive !== undefined ? payload.isActive : true,
    isDefault: payload.isDefault || false,
    createdBy: user._id,
    updatedBy: user._id,
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'SALARY_STRUCTURE_CREATED', entityType: 'SalaryStructure', entityId: structure._id,
    metadata: { name: structure.name }, ...reqMeta,
  });

  return getStructureById(organizationId, structure._id);
}

async function updateStructure(organizationId, id, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const structure = await SalaryStructure.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  if (!structure) throw new AppError('Salary structure not found', 404);

  if (payload.name && payload.name.trim() !== structure.name) {
    const exists = await SalaryStructure.findOne({
      organizationId: orgId, name: payload.name.trim(), isDeleted: false, _id: { $ne: structure._id },
    });
    if (exists) throw new AppError('A salary structure with this name already exists', 409);
    structure.name = payload.name.trim();
  }

  const nextComponents = payload.components !== undefined ? payload.components : structure.components;
  const nextBasicComponentId = payload.basicComponentId !== undefined ? payload.basicComponentId : structure.basicComponentId;
  await validateStructureComponents(orgId, nextComponents, nextBasicComponentId);

  if (payload.components !== undefined) structure.components = payload.components;
  if (payload.basicComponentId !== undefined) structure.basicComponentId = payload.basicComponentId || undefined;

  const fields = ['description', 'currency', 'isActive', 'isDefault'];
  fields.forEach((f) => {
    if (payload[f] !== undefined) structure[f] = payload[f];
  });
  structure.updatedBy = user._id;

  await structure.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'SALARY_STRUCTURE_UPDATED', entityType: 'SalaryStructure', entityId: structure._id,
    metadata: { changed: Object.keys(payload) }, ...reqMeta,
  });

  return getStructureById(organizationId, structure._id);
}

async function deleteStructure(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const structure = await SalaryStructure.findOne({ _id: id, organizationId: orgId, isDeleted: false });
  if (!structure) throw new AppError('Salary structure not found', 404);

  const activeCompensation = await EmployeeCompensation.findOne({
    organizationId: orgId, structureId: structure._id, status: 'ACTIVE',
  }).select('_id').lean();
  if (activeCompensation) {
    throw new AppError('This structure is currently assigned to one or more employees and cannot be deleted', 409);
  }

  structure.isDeleted = true;
  structure.updatedBy = user._id;
  await structure.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'SALARY_STRUCTURE_DELETED', entityType: 'SalaryStructure', entityId: structure._id,
    metadata: { name: structure.name }, ...reqMeta,
  });

  return { success: true, message: 'Salary structure deleted' };
}

module.exports = {
  getStructures, getStructureById, createStructure, updateStructure, deleteStructure, buildEngineInput,
};
