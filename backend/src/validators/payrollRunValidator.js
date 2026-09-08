const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('payrollPeriodId').optional().isMongoId().withMessage('Invalid payrollPeriodId'),
  body('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Invalid year'),
  body('month').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
  body('runType').optional().isIn(['REGULAR', 'SUPPLEMENTARY']).withMessage('Invalid runType'),
  body('employeeScope').optional().isArray().withMessage('employeeScope must be an array'),
  body('employeeScope.*').optional().isMongoId().withMessage('Invalid employee ID in employeeScope'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid payroll run ID'), validate];

const reject = [
  param('id').isMongoId().withMessage('Invalid payroll run ID'),
  body('reason').trim().notEmpty().withMessage('A rejection reason is required'),
  validate,
];

const cancel = [
  param('id').isMongoId().withMessage('Invalid payroll run ID'),
  body('reason').optional().trim(),
  validate,
];

const updateRecord = [
  param('id').isMongoId().withMessage('Invalid payroll run ID'),
  param('recordId').isMongoId().withMessage('Invalid payroll record ID'),
  body('adjustmentNote').trim().notEmpty().withMessage('adjustmentNote is required'),
  body('earnings').optional().isArray().withMessage('earnings must be an array'),
  body('deductions').optional().isArray().withMessage('deductions must be an array'),
  validate,
];

module.exports = { create, byId, reject, cancel, updateRecord };
