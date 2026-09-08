const { body, param, query } = require('express-validator');
const { validate } = require('./index');

const componentOverrideEntry = [
  body('componentOverrides.*.componentId').isMongoId().withMessage('Each override requires a valid componentId'),
  body('componentOverrides.*.value').isNumeric().withMessage('Each override requires a numeric value'),
];

const history = [
  query('employeeId').isMongoId().withMessage('A valid employeeId is required'),
  validate,
];

const byEmployeeId = [param('employeeId').isMongoId().withMessage('Invalid employee ID'), validate];

const byId = [param('id').isMongoId().withMessage('Invalid compensation ID'), validate];

const assign = [
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('structureId').isMongoId().withMessage('Valid structure ID is required'),
  body('effectiveFrom').isISO8601().withMessage('A valid effectiveFrom date is required'),
  body('currency').optional().trim(),
  body('componentOverrides').optional().isArray().withMessage('componentOverrides must be an array'),
  ...componentOverrideEntry,
  body('ctcAnnualMinorUnits').optional().isInt({ min: 0 }).withMessage('ctcAnnualMinorUnits must be a non-negative integer'),
  body('revisionReason').optional().trim(),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid compensation ID'),
  body('effectiveFrom').optional().isISO8601().withMessage('Invalid effectiveFrom date'),
  body('componentOverrides').optional().isArray().withMessage('componentOverrides must be an array'),
  ...componentOverrideEntry,
  body('ctcAnnualMinorUnits').optional().isInt({ min: 0 }).withMessage('ctcAnnualMinorUnits must be a non-negative integer'),
  body('revisionReason').optional().trim(),
  validate,
];

module.exports = { history, byEmployeeId, byId, assign, update };
