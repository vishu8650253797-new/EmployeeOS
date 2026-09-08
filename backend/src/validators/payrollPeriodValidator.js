const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('A valid year is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('A valid month (1-12) is required'),
  body('startDate').optional().isISO8601().withMessage('Invalid startDate'),
  body('endDate').optional().isISO8601().withMessage('Invalid endDate'),
  body('payDate').optional().isISO8601().withMessage('Invalid payDate'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid payroll period ID'), validate];

module.exports = { create, byId };
