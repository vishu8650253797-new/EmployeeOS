const { body, param, query } = require('express-validator');
const { validate } = require('./index');
const { SHIFT_STATUSES, TIME_PATTERN } = require('../models/Shift');

const shiftsQuery = [
  // checkFalsy: the frontend sends `status=''`/`search=''` for "no filter"
  // (mirrors AssetInventory.jsx's convention) rather than omitting the
  // param entirely — plain .optional() only skips undefined, not ''.
  query('status').optional({ checkFalsy: true }).isIn(SHIFT_STATUSES).withMessage('Invalid status filter'),
  query('search').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const createShift = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('code').trim().notEmpty().withMessage('Code is required').isLength({ max: 20 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('startTime').matches(TIME_PATTERN).withMessage('startTime must be in HH:MM 24-hour format'),
  body('endTime').matches(TIME_PATTERN).withMessage('endTime must be in HH:MM 24-hour format'),
  body('breakMinutes').optional().isInt({ min: 0 }).withMessage('breakMinutes must be a non-negative integer'),
  validate,
];

const updateShift = [
  param('id').isMongoId().withMessage('Invalid shift ID'),
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('code').optional().trim().notEmpty().isLength({ max: 20 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('startTime').optional().matches(TIME_PATTERN).withMessage('startTime must be in HH:MM 24-hour format'),
  body('endTime').optional().matches(TIME_PATTERN).withMessage('endTime must be in HH:MM 24-hour format'),
  body('breakMinutes').optional().isInt({ min: 0 }).withMessage('breakMinutes must be a non-negative integer'),
  validate,
];

const setShiftStatus = [
  param('id').isMongoId().withMessage('Invalid shift ID'),
  body('status').isIn(SHIFT_STATUSES).withMessage('Invalid status'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid shift ID'), validate];

module.exports = { shiftsQuery, createShift, updateShift, setShiftStatus, byId };
