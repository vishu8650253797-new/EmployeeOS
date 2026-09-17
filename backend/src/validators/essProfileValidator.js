const { body, param } = require('express-validator');
const { validate } = require('./index');

// Ported from the one real phone-format rule already in the codebase
// (frontend/src/pages/employees/EmployeeForm.jsx) — the admin form validates
// this client-side only today; self-service opens the same field to every
// employee directly, so it gets the equivalent check enforced server-side.
const PHONE_REGEX = /^[+\d][\d\s()-]{6,}$/;

const updateProfile = [
  body('phone').optional({ checkFalsy: true }).trim().matches(PHONE_REGEX).withMessage('Enter a valid phone number'),
  body('alternatePhone').optional({ checkFalsy: true }).trim().matches(PHONE_REGEX).withMessage('Enter a valid alternate phone number'),
  body('personalEmail').optional({ checkFalsy: true }).trim().isEmail().withMessage('Enter a valid personal email').normalizeEmail(),
  body('address').optional().isObject().withMessage('Invalid address'),
  body('address.street').optional({ checkFalsy: true }).trim().isLength({ max: 200 }).withMessage('Street address is too long'),
  body('address.city').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('City is too long'),
  body('address.state').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('State is too long'),
  body('address.country').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Country is too long'),
  body('address.postalCode').optional({ checkFalsy: true }).trim().isLength({ max: 20 }).withMessage('Postal code is too long'),
  validate,
];

const OPTIONAL_CONTACT_FIELDS = [
  body('alternatePhone').optional({ checkFalsy: true }).trim().matches(PHONE_REGEX).withMessage('Enter a valid alternate phone number'),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
];

const addEmergencyContact = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name must be under 100 characters'),
  body('relationship').trim().notEmpty().withMessage('Relationship is required').isLength({ max: 50 }).withMessage('Relationship must be under 50 characters'),
  body('phone').trim().notEmpty().withMessage('Phone is required').bail().matches(PHONE_REGEX).withMessage('Enter a valid phone number'),
  ...OPTIONAL_CONTACT_FIELDS,
  validate,
];

const updateEmergencyContact = [
  param('contactId').isMongoId().withMessage('Invalid contact ID'),
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Name must be under 100 characters'),
  body('relationship').optional({ checkFalsy: true }).trim().isLength({ max: 50 }).withMessage('Relationship must be under 50 characters'),
  body('phone').optional({ checkFalsy: true }).trim().matches(PHONE_REGEX).withMessage('Enter a valid phone number'),
  ...OPTIONAL_CONTACT_FIELDS,
  validate,
];
const contactIdParam = [param('contactId').isMongoId().withMessage('Invalid contact ID'), validate];

module.exports = { updateProfile, addEmergencyContact, updateEmergencyContact, contactIdParam };
