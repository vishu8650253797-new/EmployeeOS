const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  body('projectId').isMongoId().withMessage('Invalid project ID'),
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']).withMessage('Invalid status'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('assigneeIds').optional().isArray().withMessage('Assignee IDs must be an array'),
  body('assigneeIds.*').optional().isMongoId().withMessage('Invalid assignee ID'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
  body('estimatedHours').optional().isFloat({ min: 0 }).withMessage('Estimated hours must be non-negative'),
  body('labels').optional().isArray().withMessage('Labels must be an array'),
  body('parentTaskId').optional().isMongoId().withMessage('Invalid parent task ID'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid task ID'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim(),
  body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']).withMessage('Invalid status'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('assigneeIds').optional().isArray().withMessage('Assignee IDs must be an array'),
  body('assigneeIds.*').optional().isMongoId().withMessage('Invalid assignee ID'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
  body('estimatedHours').optional().isFloat({ min: 0 }).withMessage('Estimated hours must be non-negative'),
  body('actualHours').optional().isFloat({ min: 0 }).withMessage('Actual hours must be non-negative'),
  body('labels').optional().isArray().withMessage('Labels must be an array'),
  body('parentTaskId').optional().isMongoId().withMessage('Invalid parent task ID'),
  validate,
];

const getById = [param('id').isMongoId().withMessage('Invalid task ID'), validate];

const statusUpdate = [
  param('id').isMongoId().withMessage('Invalid task ID'),
  body('status').isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']).withMessage('Invalid status'),
  validate,
];

const assign = [
  param('id').isMongoId().withMessage('Invalid task ID'),
  body('assigneeIds').isArray().withMessage('Assignee IDs must be an array'),
  body('assigneeIds.*').isMongoId().withMessage('Invalid assignee ID'),
  validate,
];

module.exports = { create, update, getById, statusUpdate, assign };
