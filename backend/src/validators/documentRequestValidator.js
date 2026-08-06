const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('categoryId').isMongoId().withMessage('Valid category ID is required'),
  body('processId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid process ID'),
  body('title').trim().notEmpty().withMessage('Request title is required'),
  body('description').optional().trim(),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid request ID'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim(),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
  validate,
];

const uploadForRequest = [
  param('id').isMongoId().withMessage('Invalid request ID'),
  body('title').optional().trim(),
  body('description').optional().trim(),
  body('documentNumber').optional().trim(),
  body('issueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid issue date'),
  body('expiryDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid expiry date'),
  body('isConfidential').optional().isBoolean().withMessage('isConfidential must be a boolean'),
  validate,
];

const reject = [
  param('id').isMongoId().withMessage('Invalid request ID'),
  body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid request ID'), validate];

const byEmployeeId = [param('employeeId').isMongoId().withMessage('Invalid employee ID'), validate];

module.exports = { create, update, uploadForRequest, reject, byId, byEmployeeId };
