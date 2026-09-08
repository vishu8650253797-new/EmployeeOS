const { body, param } = require('express-validator');
const { validate } = require('./index');

const componentEntry = (prefix) => [
  body(`${prefix}.*.componentId`).isMongoId().withMessage('Each component entry requires a valid componentId'),
  body(`${prefix}.*.value`).isNumeric().withMessage('Each component entry requires a numeric value'),
  body(`${prefix}.*.isOverridable`).optional().isBoolean().withMessage('isOverridable must be a boolean'),
];

const create = [
  body('name').trim().notEmpty().withMessage('Structure name is required'),
  body('description').optional().trim(),
  body('currency').optional().trim(),
  body('basicComponentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid basicComponentId'),
  body('components').optional().isArray().withMessage('components must be an array'),
  ...componentEntry('components'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid structure ID'),
  body('name').optional().trim().notEmpty().withMessage('Structure name cannot be empty'),
  body('description').optional().trim(),
  body('currency').optional().trim(),
  body('basicComponentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid basicComponentId'),
  body('components').optional().isArray().withMessage('components must be an array'),
  ...componentEntry('components'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid structure ID'), validate];

module.exports = { create, update, byId };
