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

module.exports = { timesheetsQuery, prepareTimesheet, byId };
