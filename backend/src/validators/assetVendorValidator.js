const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('name').trim().notEmpty().withMessage('Vendor name is required'),
  body('contactPerson').optional().trim(),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email address'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('website').optional().trim(),
  body('notes').optional().trim(),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid vendor ID'),
  body('name').optional().trim().notEmpty().withMessage('Vendor name cannot be empty'),
  body('contactPerson').optional().trim(),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email address'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('website').optional().trim(),
  body('notes').optional().trim(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid vendor ID'), validate];

module.exports = { create, update, byId };
