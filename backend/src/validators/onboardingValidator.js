const { body, param } = require('express-validator');
const { validate } = require('./index');

const TASK_CATEGORIES = ['DOCUMENTATION', 'IT_SETUP', 'TRAINING', 'HR', 'FINANCE', 'FACILITIES', 'COMPLIANCE', 'HANDOVER', 'OTHER'];

const createProcess = [
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('type').isIn(['ONBOARDING', 'OFFBOARDING']).withMessage('Type must be ONBOARDING or OFFBOARDING'),
  body('templateId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid template ID'),
  body('title').optional().trim(),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid start date'),
  body('targetDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid target date'),
  body('targetDate').custom((target, { req }) => {
    const start = req.body.startDate;
    if (target && start && new Date(target) < new Date(start)) {
      throw new Error('Target date cannot be before start date');
    }
    return true;
  }),
  body('notes').optional().trim(),
  validate,
];

const updateProcess = [
  param('id').isMongoId().withMessage('Invalid process ID'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid start date'),
  body('targetDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid target date'),
  body('targetDate').custom((target, { req }) => {
    const start = req.body.startDate;
    if (target && start && new Date(target) < new Date(start)) {
      throw new Error('Target date cannot be before start date');
    }
    return true;
  }),
  body('notes').optional().trim(),
  validate,
];

const cancelProcess = [
  param('id').isMongoId().withMessage('Invalid process ID'),
  body('reason').optional().trim(),
  validate,
];

const confirmJoiningDate = [
  param('id').isMongoId().withMessage('Invalid process ID'),
  body('joiningDate').isISO8601().withMessage('Valid joining date is required'),
  body('syncToEmployee').optional().isBoolean().withMessage('syncToEmployee must be a boolean'),
  validate,
];

const DOCUMENT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const triggerDocumentCollection = [
  param('id').isMongoId().withMessage('Invalid process ID'),
  body('documents').optional().isArray().withMessage('documents must be an array'),
  body('documents.*.categoryId').isMongoId().withMessage('Each document needs a valid categoryId'),
  body('documents.*.title').trim().notEmpty().withMessage('Each document needs a title'),
  body('documents.*.description').optional().trim(),
  body('documents.*.priority').optional().isIn(DOCUMENT_PRIORITIES).withMessage('Invalid document priority'),
  body('documents.*.dueOffsetDays').optional().isInt({ min: 0 }).withMessage('dueOffsetDays must be a non-negative integer'),
  validate,
];

const addTask = [
  param('id').isMongoId().withMessage('Invalid process ID'),
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('description').optional().trim(),
  body('category').optional().isIn(TASK_CATEGORIES).withMessage('Invalid task category'),
  body('assigneeId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid assignee ID'),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
  body('isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
  body('notes').optional().trim(),
  validate,
];

const updateTask = [
  param('taskId').isMongoId().withMessage('Invalid task ID'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim(),
  body('category').optional().isIn(TASK_CATEGORIES).withMessage('Invalid task category'),
  body('assigneeId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid assignee ID'),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
  body('isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
  body('notes').optional().trim(),
  validate,
];

const updateTaskStatus = [
  param('taskId').isMongoId().withMessage('Invalid task ID'),
  body('status').isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).withMessage('Invalid task status'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid process ID'), validate];

const byTaskId = [param('taskId').isMongoId().withMessage('Invalid task ID'), validate];

module.exports = {
  createProcess, updateProcess, cancelProcess, confirmJoiningDate, triggerDocumentCollection,
  addTask, updateTask, updateTaskStatus, byId, byTaskId,
};
