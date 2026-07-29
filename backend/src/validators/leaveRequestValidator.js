const { body, param, query } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('leaveTypeId').isMongoId().withMessage('Valid leave type ID is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('durationType').optional().isIn(['FULL_DAY', 'HALF_DAY']).withMessage('durationType must be FULL_DAY or HALF_DAY'),
  body('reason').optional().trim(),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid leave request ID'), validate];

const byEmployeeId = [param('employeeId').isMongoId().withMessage('Invalid employee ID'), validate];

const status = [
  query('status')
    .optional()
    .isIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
    .withMessage('Invalid status filter'),
  validate,
];

module.exports = { create, byId, byEmployeeId, status };
