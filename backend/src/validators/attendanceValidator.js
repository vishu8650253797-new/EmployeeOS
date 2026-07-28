const { body, query, param } = require('express-validator');
const { validate } = require('./index');

const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'];

const checkIn = [
  body('notes').optional().trim().escape(),
  validate,
];

const checkOut = checkIn;

const myHistory = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('month').optional().isInt({ min: 1, max: 12 }).toInt(),
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  validate,
];

const list = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('date').optional().isISO8601().withMessage('Invalid date'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('employeeId').optional().isMongoId().withMessage('Invalid employee ID'),
  query('departmentId').optional().isMongoId().withMessage('Invalid department ID'),
  query('status').optional().isIn(validStatuses).withMessage('Invalid status'),
  query('search').optional().trim().escape(),
  query('sortBy').optional().isIn(['date', 'status', 'createdAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order'),
  validate,
];

const byId = [
  param('id').isMongoId().withMessage('Invalid attendance ID'),
  validate,
];

const byEmployee = [
  param('employeeId').isMongoId().withMessage('Invalid employee ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('date').optional().isISO8601().withMessage('Invalid date'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('status').optional().isIn(validStatuses).withMessage('Invalid status'),
  validate,
];

const byDepartment = [
  param('departmentId').isMongoId().withMessage('Invalid department ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('date').optional().isISO8601().withMessage('Invalid date'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('status').optional().isIn(validStatuses).withMessage('Invalid status'),
  validate,
];

const stats = [
  query('date').optional().isISO8601().withMessage('Invalid date'),
  validate,
];

module.exports = {
  checkIn,
  checkOut,
  myHistory,
  list,
  byId,
  byEmployee,
  byDepartment,
  stats,
};
