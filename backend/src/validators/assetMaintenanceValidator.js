const { body, param } = require('express-validator');
const { validate } = require('./index');

const MAINTENANCE_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'CANCELLED'];
const MAINTENANCE_ISSUE_TYPES = ['HARDWARE', 'SOFTWARE', 'PERFORMANCE', 'DAMAGE', 'OTHER'];
const MAINTENANCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const create = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('issueType').optional().isIn(MAINTENANCE_ISSUE_TYPES).withMessage('Invalid issue type'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('priority').optional().isIn(MAINTENANCE_PRIORITIES).withMessage('Invalid priority'),
  body('vendorId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid vendor ID'),
  body('notes').optional().trim(),
  validate,
];

const byAssetId = [param('id').isMongoId().withMessage('Invalid asset ID'), validate];

const byMaintenanceId = [param('maintenanceId').isMongoId().withMessage('Invalid maintenance ID'), validate];

const update = [
  param('maintenanceId').isMongoId().withMessage('Invalid maintenance ID'),
  body('status').optional().isIn(MAINTENANCE_STATUSES).withMessage('Invalid maintenance status'),
  body('issueType').optional().isIn(MAINTENANCE_ISSUE_TYPES).withMessage('Invalid issue type'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('priority').optional().isIn(MAINTENANCE_PRIORITIES).withMessage('Invalid priority'),
  body('assignedTechnicianId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid technician ID'),
  body('maintenanceCost').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Maintenance cost must be non-negative'),
  body('vendorId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid vendor ID'),
  body('resolution').optional().trim(),
  body('notes').optional().trim(),
  validate,
];

module.exports = { create, byAssetId, byMaintenanceId, update };
