const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('key').trim().notEmpty().withMessage('Project key is required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid start date'),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
  body('ownerId').isMongoId().withMessage('Invalid owner ID'),
  body('departmentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department ID'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid project ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('key').optional().trim().notEmpty().withMessage('Key cannot be empty'),
  body('description').optional().trim(),
  body('status').optional().isIn(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid start date'),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
  body('ownerId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid owner ID'),
  body('departmentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department ID'),
  validate,
];

const getById = [param('id').isMongoId().withMessage('Invalid project ID'), validate];

module.exports = { create, update, getById };
