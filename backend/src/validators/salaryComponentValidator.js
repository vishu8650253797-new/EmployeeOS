const { body, param } = require('express-validator');
const { validate } = require('./index');
const { COMPONENT_TYPES, CALCULATION_TYPES } = require('../models/SalaryComponent');

const create = [
  body('code').trim().notEmpty().withMessage('Component code is required'),
  body('name').trim().notEmpty().withMessage('Component name is required'),
  body('type').isIn(COMPONENT_TYPES).withMessage('Invalid component type'),
  body('calculationType').isIn(CALCULATION_TYPES).withMessage('Invalid calculation type'),
  body('percentageOfComponentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid percentageOfComponentId'),
  body('isStatutory').optional().isBoolean().withMessage('isStatutory must be a boolean'),
  body('isTaxable').optional().isBoolean().withMessage('isTaxable must be a boolean'),
  body('isProratable').optional().isBoolean().withMessage('isProratable must be a boolean'),
  body('order').optional().isInt().withMessage('order must be an integer'),
  body('description').optional().trim(),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid component ID'),
  body('code').optional().trim().notEmpty().withMessage('Component code cannot be empty'),
  body('name').optional().trim().notEmpty().withMessage('Component name cannot be empty'),
  body('type').optional().isIn(COMPONENT_TYPES).withMessage('Invalid component type'),
  body('calculationType').optional().isIn(CALCULATION_TYPES).withMessage('Invalid calculation type'),
  body('percentageOfComponentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid percentageOfComponentId'),
  body('isStatutory').optional().isBoolean().withMessage('isStatutory must be a boolean'),
  body('isTaxable').optional().isBoolean().withMessage('isTaxable must be a boolean'),
  body('isProratable').optional().isBoolean().withMessage('isProratable must be a boolean'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('order').optional().isInt().withMessage('order must be an integer'),
  body('description').optional().trim(),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid component ID'), validate];

module.exports = { create, update, byId };
