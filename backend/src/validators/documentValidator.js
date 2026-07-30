const { body, param, query } = require('express-validator');
const { validate } = require('./index');

const upload = [
  body('categoryId').isMongoId().withMessage('Valid category ID is required'),
  body('title').trim().notEmpty().withMessage('Document title is required'),
  body('employeeId').optional().isMongoId().withMessage('Invalid employee ID'),
  body('requestId').optional().isMongoId().withMessage('Invalid request ID'),
  body('description').optional().trim(),
  body('documentNumber').optional().trim(),
  body('issueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid issue date'),
  body('expiryDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid expiry date'),
  body('isConfidential').optional().isBoolean().withMessage('isConfidential must be a boolean'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid document ID'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim(),
  body('documentNumber').optional().trim(),
  body('issueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid issue date'),
  body('expiryDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid expiry date'),
  body('isConfidential').optional().isBoolean().withMessage('isConfidential must be a boolean'),
  validate,
];

const replace = [
  param('id').isMongoId().withMessage('Invalid document ID'),
  body('changeReason').optional().trim(),
  validate,
];

const reject = [
  param('id').isMongoId().withMessage('Invalid document ID'),
  body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid document ID'), validate];

const byEmployeeId = [param('employeeId').isMongoId().withMessage('Invalid employee ID'), validate];

const byCategoryId = [param('categoryId').isMongoId().withMessage('Invalid category ID'), validate];

const versionDownload = [
  param('id').isMongoId().withMessage('Invalid document ID'),
  param('versionId').custom((v) => v === 'current' || /^[0-9a-fA-F]{24}$/.test(v)).withMessage('Invalid version ID'),
  validate,
];

const expiringQuery = [
  query('days').optional().isInt({ min: 1 }).withMessage('days must be a positive integer'),
  validate,
];

module.exports = { upload, update, replace, reject, byId, byEmployeeId, byCategoryId, versionDownload, expiringQuery };
