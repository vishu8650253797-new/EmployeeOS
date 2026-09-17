const { body, param, query } = require('express-validator');
const { validate } = require('./index');

const balanceQuery = [
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
  validate,
];

const requestsQuery = [
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).withMessage('Invalid status filter'),
  query('leaveTypeId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid leave type ID'),
  query('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid start date'),
  query('endDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid end date'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const createRequest = [
  body('leaveTypeId').isMongoId().withMessage('Valid leave type is required'),
  body('startDate').isISO8601().withMessage('A valid start date is required'),
  body('endDate')
    .isISO8601()
    .withMessage('A valid end date is required')
    .bail()
    .custom((endDate, { req }) => new Date(endDate) >= new Date(req.body.startDate))
    .withMessage('End date cannot be before start date'),
  body('durationType').optional().isIn(['FULL_DAY', 'HALF_DAY']).withMessage('durationType must be FULL_DAY or HALF_DAY'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason must be under 500 characters'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid leave request ID'), validate];

module.exports = { balanceQuery, requestsQuery, createRequest, byId };
