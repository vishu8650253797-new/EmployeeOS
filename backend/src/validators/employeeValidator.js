const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('jobTitle').trim().notEmpty().withMessage('Job title is required'),
  body('joiningDate').isISO8601().toDate().withMessage('Valid joining date is required'),
  body('departmentId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Valid department ID required'),
  body('managerId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Valid manager ID required'),
  body('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE', 'IT_ADMIN'])
    .withMessage('Invalid role'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ON_LEAVE'])
    .withMessage('Invalid status'),
  body('employmentType')
    .optional()
    .isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY'])
    .withMessage('Invalid employment type'),
  body('dateOfBirth')
    .optional({ checkFalsy: true })
    .isISO8601()
    .toDate()
    .withMessage('Invalid date of birth'),
  body('gender')
    .optional({ checkFalsy: true })
    .isIn(['Male', 'Female', 'Other', 'Prefer not to say'])
    .withMessage('Invalid gender'),
  body('phone').optional().trim(),
  body('avatar').optional().trim(),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid employee ID'),
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('jobTitle').optional().trim().notEmpty().withMessage('Job title cannot be empty'),
  body('joiningDate').optional().isISO8601().toDate().withMessage('Valid joining date required'),
  body('departmentId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Valid department ID required'),
  body('managerId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Valid manager ID required'),
  body('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE', 'IT_ADMIN'])
    .withMessage('Invalid role'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ON_LEAVE'])
    .withMessage('Invalid status'),
  body('employmentType')
    .optional()
    .isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY'])
    .withMessage('Invalid employment type'),
  body('dateOfBirth')
    .optional({ checkFalsy: true })
    .isISO8601()
    .toDate()
    .withMessage('Invalid date of birth'),
  body('gender')
    .optional({ checkFalsy: true })
    .isIn(['Male', 'Female', 'Other', 'Prefer not to say'])
    .withMessage('Invalid gender'),
  validate,
];

const getById = [
  param('id').isMongoId().withMessage('Invalid employee ID'),
  validate,
];

module.exports = { create, update, getById };
