const { body, param, query } = require('express-validator');
const { validate } = require('./index');
const { SCHEDULE_STATUSES } = require('../models/EmployeeSchedule');

const schedulesQuery = [
  query('status').optional({ checkFalsy: true }).isIn(SCHEDULE_STATUSES).withMessage('Invalid status filter'),
  query('employeeId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid employee ID'),
  query('shiftId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid shift ID'),
  query('departmentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department ID'),
  query('search').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  query('dateFrom').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid dateFrom'),
  query('dateTo').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid dateTo'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const assignSchedule = [
  body('employeeId').isMongoId().withMessage('Valid employeeId is required'),
  body('shiftId').isMongoId().withMessage('Valid shiftId is required'),
  body('effectiveFrom').isISO8601().withMessage('A valid effectiveFrom date is required'),
  body('effectiveTo').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid effectiveTo date'),
  body('daysOfWeek').optional().isArray({ min: 1 }).withMessage('daysOfWeek must be a non-empty array'),
  body('daysOfWeek.*').optional().isInt({ min: 0, max: 6 }).withMessage('daysOfWeek values must be 0-6'),
  body('reason').optional().trim().isLength({ max: 500 }),
  validate,
];

const updateSchedule = [
  param('id').isMongoId().withMessage('Invalid schedule ID'),
  body('shiftId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid shiftId'),
  body('effectiveFrom').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid effectiveFrom date'),
  body('effectiveTo').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid effectiveTo date'),
  body('daysOfWeek').optional().isArray({ min: 1 }).withMessage('daysOfWeek must be a non-empty array'),
  body('daysOfWeek.*').optional().isInt({ min: 0, max: 6 }).withMessage('daysOfWeek values must be 0-6'),
  body('reason').optional().trim().isLength({ max: 500 }),
  validate,
];

const validateSchedule = [
  body('employeeId').isMongoId().withMessage('Valid employeeId is required'),
  body('shiftId').isMongoId().withMessage('Valid shiftId is required'),
  body('effectiveFrom').isISO8601().withMessage('A valid effectiveFrom date is required'),
  body('effectiveTo').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid effectiveTo date'),
  body('daysOfWeek').optional().isArray({ min: 1 }).withMessage('daysOfWeek must be a non-empty array'),
  body('daysOfWeek.*').optional().isInt({ min: 0, max: 6 }).withMessage('daysOfWeek values must be 0-6'),
  validate,
];

const bulkAssignSchedule = [
  body('shiftId').isMongoId().withMessage('Valid shiftId is required'),
  body('effectiveFrom').isISO8601().withMessage('A valid effectiveFrom date is required'),
  body('effectiveTo').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid effectiveTo date'),
  body('daysOfWeek').optional().isArray({ min: 1 }).withMessage('daysOfWeek must be a non-empty array'),
  body('daysOfWeek.*').optional().isInt({ min: 0, max: 6 }).withMessage('daysOfWeek values must be 0-6'),
  body('reason').optional().trim().isLength({ max: 500 }),
  body('employeeIds').optional().isArray().withMessage('employeeIds must be an array'),
  body('employeeIds.*').optional().isMongoId().withMessage('Invalid employee ID in employeeIds'),
  body('departmentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid departmentId'),
  body().custom((value) => {
    const hasEmployees = Array.isArray(value.employeeIds) && value.employeeIds.length > 0;
    if (!hasEmployees && !value.departmentId) {
      throw new Error('Provide employeeIds and/or a departmentId');
    }
    return true;
  }),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid schedule ID'), validate];

module.exports = { schedulesQuery, assignSchedule, updateSchedule, validateSchedule, bulkAssignSchedule, byId };
