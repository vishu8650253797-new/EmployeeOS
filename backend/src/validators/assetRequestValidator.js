const { body, param } = require('express-validator');
const { validate } = require('./index');

const REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const create = [
  body('assetCategoryId').isMongoId().withMessage('Valid asset category ID is required'),
  body('requestedAssetType').optional().trim(),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('priority').optional().isIn(REQUEST_PRIORITIES).withMessage('Invalid priority'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid request ID'), validate];

const reject = [
  param('id').isMongoId().withMessage('Invalid request ID'),
  body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required'),
  validate,
];

const fulfill = [
  param('id').isMongoId().withMessage('Invalid request ID'),
  body('assetId').isMongoId().withMessage('Valid asset ID is required'),
  validate,
];

module.exports = { create, byId, reject, fulfill };
