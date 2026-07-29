const { body, param } = require('express-validator');
const { validate } = require('./index');

const create = [
  param('taskId').isMongoId().withMessage('Invalid task ID'),
  body('content').trim().notEmpty().withMessage('Comment content is required'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid comment ID'),
  body('content').trim().notEmpty().withMessage('Comment content cannot be empty'),
  validate,
];

const getById = [param('id').isMongoId().withMessage('Invalid comment ID'), validate];

module.exports = { create, update, getById };
