const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid category ID'),
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid category ID'), validate];

module.exports = { create, update, byId };
