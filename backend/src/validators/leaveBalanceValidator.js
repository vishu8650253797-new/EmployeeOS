const { body, param } = require('express-validator');
const { validate } = require('./index');

const getEmployee = [param('employeeId').isMongoId().withMessage('Invalid employee ID'), validate];

const update = [
  param('id').isMongoId().withMessage('Invalid balance ID'),
  body('allocatedDays').optional().isFloat({ min: 0 }).withMessage('allocatedDays must be non-negative'),
  body('usedDays').optional().isFloat({ min: 0 }).withMessage('usedDays must be non-negative'),
  body('pendingDays').optional().isFloat({ min: 0 }).withMessage('pendingDays must be non-negative'),
  body('carriedForwardDays').optional().isFloat({ min: 0 }).withMessage('carriedForwardDays must be non-negative'),
  validate,
];

module.exports = { getEmployee, update };
