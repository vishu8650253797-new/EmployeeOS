const { body, param } = require('express-validator');
const { validate } = require('./index');

const ASSET_CONDITIONS = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'];
const ATTACHMENT_CATEGORIES = [
  'PURCHASE_INVOICE', 'WARRANTY_CARD', 'PURCHASE_ORDER', 'PHOTOGRAPH', 'REPAIR_INVOICE', 'MAINTENANCE_DOCUMENT', 'OTHER',
];

const create = [
  body('name').trim().notEmpty().withMessage('Asset name is required'),
  body('categoryId').isMongoId().withMessage('Valid category ID is required'),
  body('assetTag').optional().trim(),
  body('serialNumber').optional().trim(),
  body('brand').optional().trim(),
  body('model').optional().trim(),
  body('description').optional().trim(),
  body('purchaseDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid purchase date'),
  body('purchasePrice').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Purchase price must be non-negative'),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  body('vendorId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid vendor ID'),
  body('warrantyStartDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid warranty start date'),
  body('warrantyEndDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid warranty end date'),
  body('condition').optional().isIn(ASSET_CONDITIONS).withMessage('Invalid asset condition'),
  body('location').optional().trim(),
  body('purchaseOrderNumber').optional().trim(),
  body('invoiceNumber').optional().trim(),
  body('notes').optional().trim(),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('name').optional().trim().notEmpty().withMessage('Asset name cannot be empty'),
  body('categoryId').optional().isMongoId().withMessage('Invalid category ID'),
  body('serialNumber').optional().trim(),
  body('brand').optional().trim(),
  body('model').optional().trim(),
  body('description').optional().trim(),
  body('purchaseDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid purchase date'),
  body('purchasePrice').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Purchase price must be non-negative'),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  body('vendorId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid vendor ID'),
  body('warrantyStartDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid warranty start date'),
  body('warrantyEndDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid warranty end date'),
  body('condition').optional().isIn(ASSET_CONDITIONS).withMessage('Invalid asset condition'),
  body('location').optional().trim(),
  body('purchaseOrderNumber').optional().trim(),
  body('invoiceNumber').optional().trim(),
  body('notes').optional().trim(),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid asset ID'), validate];

const assign = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('departmentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department ID'),
  body('assignmentNotes').optional().trim(),
  body('onboardingTaskId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid onboarding task ID'),
  validate,
];

const reassign = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('departmentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department ID'),
  body('assignmentNotes').optional().trim(),
  validate,
];

const returnAsset = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('condition').isIn(ASSET_CONDITIONS).withMessage('Invalid asset condition'),
  body('returnNotes').optional().trim(),
  validate,
];

const statusTransition = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('notes').optional().trim(),
  validate,
];

const uploadAttachment = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('title').optional().trim(),
  body('category').optional().isIn(ATTACHMENT_CATEGORIES).withMessage('Invalid attachment category'),
  validate,
];

const byAttachmentId = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  param('attachmentId').isMongoId().withMessage('Invalid attachment ID'),
  validate,
];

module.exports = {
  create, update, byId, assign, reassign, returnAsset, statusTransition, uploadAttachment, byAttachmentId,
};
