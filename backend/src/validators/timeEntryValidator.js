const { body, param, query } = require('express-validator');
const { validate } = require('./index');
const { TIME_ENTRY_STATUSES } = require('../models/TimeEntry');

const entriesQuery = [
  query('status').optional().isIn(TIME_ENTRY_STATUSES).withMessage('Invalid status filter'),
  query('startDate').optional({ checkFalsy: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('startDate must be YYYY-MM-DD'),
  query('endDate').optional({ checkFalsy: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('endDate must be YYYY-MM-DD'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const endEntry = [
  param('id').isMongoId().withMessage('Invalid time entry ID'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be under 500 characters'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid time entry ID'), validate];

module.exports = { entriesQuery, endEntry, byId };
