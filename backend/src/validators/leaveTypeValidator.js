const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('name').trim().notEmpty().withMessage('Leave type name is required'),
  body('code').trim().notEmpty().withMessage('Leave type code is required'),
  body('totalDays').isInt({ min: 0 }).withMessage('Total days must be a non-negative integer'),
  body('isPaid').optional().isBoolean().withMessage('isPaid must be boolean'),
  body('requiresApproval').optional().isBoolean().withMessage('requiresApproval must be boolean'),
  body('allowHalfDay').optional().isBoolean().withMessage('allowHalfDay must be boolean'),
  body('allowCarryForward').optional().isBoolean().withMessage('allowCarryForward must be boolean'),
  body('maxCarryForwardDays').optional().isInt({ min: 0 }).withMessage('maxCarryForwardDays must be non-negative'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid leave type ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('code').optional().trim().notEmpty().withMessage('Code cannot be empty'),
  body('totalDays').optional().isInt({ min: 0 }).withMessage('Total days must be non-negative'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate,
];

const getById = [param('id').isMongoId().withMessage('Invalid leave type ID'), validate];

module.exports = { create, update, getById };
