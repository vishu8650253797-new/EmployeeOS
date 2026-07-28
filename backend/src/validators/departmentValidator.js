const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('code').optional().trim().isLength({ max: 10 }).withMessage('Code is too long'),
  body('headId').optional({ checkFalsy: true }).isMongoId().withMessage('Valid department head ID required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid department ID'),
  body('name').optional().trim().notEmpty().withMessage('Department name cannot be empty'),
  body('code').optional().trim().isLength({ max: 10 }).withMessage('Code is too long'),
  body('headId').optional({ checkFalsy: true }).isMongoId().withMessage('Valid department head ID required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate,
];

const getById = [
  param('id').isMongoId().withMessage('Invalid department ID'),
  validate,
];

module.exports = { create, update, getById };
