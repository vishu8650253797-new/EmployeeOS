const { body, param } = require('express-validator');
const { validate } = require('./index');

const DOCUMENT_TYPES = [
  'IDENTITY_DOCUMENT', 'ADDRESS_PROOF', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER',
  'OFFER_LETTER', 'EMPLOYMENT_CONTRACT', 'NDA', 'TAX_DOCUMENT', 'BANK_DOCUMENT',
  'PASSPORT', 'WORK_PERMIT', 'VISA', 'MEDICAL_DOCUMENT', 'CERTIFICATION', 'OTHER',
];

const create = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('code').optional().isIn(DOCUMENT_TYPES).withMessage('Invalid document type code'),
  body('description').optional().trim(),
  body('allowedExtensions').optional().isArray().withMessage('allowedExtensions must be an array'),
  body('maxFileSizeMB').optional().isFloat({ min: 1 }).withMessage('maxFileSizeMB must be a positive number'),
  body('isConfidentialByDefault').optional().isBoolean(),
  body('isMandatory').optional().isBoolean(),
  body('requiresExpiry').optional().isBoolean(),
  body('requiresVerification').optional().isBoolean(),
  body('expiryWarningDays').optional().isInt({ min: 1 }).withMessage('expiryWarningDays must be a positive integer'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid category ID'),
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('code').optional().isIn(DOCUMENT_TYPES).withMessage('Invalid document type code'),
  body('description').optional().trim(),
  body('allowedExtensions').optional().isArray().withMessage('allowedExtensions must be an array'),
  body('maxFileSizeMB').optional().isFloat({ min: 1 }).withMessage('maxFileSizeMB must be a positive number'),
  body('isConfidentialByDefault').optional().isBoolean(),
  body('isMandatory').optional().isBoolean(),
  body('requiresExpiry').optional().isBoolean(),
  body('requiresVerification').optional().isBoolean(),
  body('expiryWarningDays').optional().isInt({ min: 1 }).withMessage('expiryWarningDays must be a positive integer'),
  body('isActive').optional().isBoolean(),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid category ID'), validate];

module.exports = { create, update, byId };
