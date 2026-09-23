const { body, param, query } = require('express-validator');
const { validate } = require('./index');
const { TIMESHEET_STATUSES } = require('../models/Timesheet');

const timesheetsQuery = [
  query('status').optional().isIn(TIMESHEET_STATUSES).withMessage('Invalid status filter'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const prepareTimesheet = [
  body('periodStart').optional({ checkFalsy: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('periodStart must be YYYY-MM-DD'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid timesheet ID'), validate];

const managerTimesheetsQuery = [
  query('status').optional().isIn(TIMESHEET_STATUSES).withMessage('Invalid status filter'),
  query('employeeId').optional().isMongoId().withMessage('Invalid employee ID'),
  query('periodStart').optional({ checkFalsy: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('periodStart must be YYYY-MM-DD'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const rejectTimesheet = [
  param('id').isMongoId().withMessage('Invalid timesheet ID'),
  body('reason').trim().notEmpty().withMessage('A rejection reason is required').isLength({ max: 1000 }).withMessage('Reason must be under 1000 characters'),
  validate,
];

module.exports = { timesheetsQuery, prepareTimesheet, byId, managerTimesheetsQuery, rejectTimesheet };
