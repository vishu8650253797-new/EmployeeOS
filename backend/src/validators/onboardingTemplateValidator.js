const { body, param } = require('express-validator');
const { validate } = require('./index');

const TASK_CATEGORIES = ['DOCUMENTATION', 'IT_SETUP', 'TRAINING', 'HR', 'FINANCE', 'FACILITIES', 'COMPLIANCE', 'HANDOVER', 'OTHER'];
const ASSIGNEE_ROLES = ['HR_ADMIN', 'MANAGER', 'IT_ADMIN', 'FINANCE', 'EMPLOYEE'];

const taskRules = (prefix) => [
  body(`${prefix}.*.title`).trim().notEmpty().withMessage('Each task requires a title'),
  body(`${prefix}.*.description`).optional().trim(),
  body(`${prefix}.*.category`).optional().isIn(TASK_CATEGORIES).withMessage('Invalid task category'),
  body(`${prefix}.*.defaultAssigneeRole`).optional().isIn(ASSIGNEE_ROLES).withMessage('Invalid assignee role'),
  body(`${prefix}.*.dueOffsetDays`).optional().isInt({ min: 0 }).withMessage('dueOffsetDays must be a non-negative integer'),
  body(`${prefix}.*.order`).optional().isInt({ min: 0 }).withMessage('order must be a non-negative integer'),
  body(`${prefix}.*.isRequired`).optional().isBoolean().withMessage('isRequired must be a boolean'),
];

const create = [
  body('name').trim().notEmpty().withMessage('Template name is required'),
  body('type').isIn(['ONBOARDING', 'OFFBOARDING']).withMessage('Type must be ONBOARDING or OFFBOARDING'),
  body('description').optional().trim(),
  body('departmentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department ID'),
  body('tasks').optional().isArray().withMessage('Tasks must be an array'),
  ...taskRules('tasks'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid template ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('type').optional().isIn(['ONBOARDING', 'OFFBOARDING']).withMessage('Type must be ONBOARDING or OFFBOARDING'),
  body('description').optional().trim(),
  body('departmentId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department ID'),
  body('tasks').optional().isArray().withMessage('Tasks must be an array'),
  ...taskRules('tasks'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid template ID'), validate];

module.exports = { create, update, byId };
