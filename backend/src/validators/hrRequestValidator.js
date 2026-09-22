const { body, param, query } = require('express-validator');
const { validate } = require('./index');
const { HR_REQUEST_CATEGORIES, HR_REQUEST_STATUSES } = require('../models/HrRequest');

const requestsQuery = [
  query('status').optional().isIn(HR_REQUEST_STATUSES).withMessage('Invalid status filter'),
  query('category').optional().isIn(HR_REQUEST_CATEGORIES).withMessage('Invalid category filter'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const createRequest = [
  body('category').isIn(HR_REQUEST_CATEGORIES).withMessage('Valid category is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 200 }).withMessage('Subject must be under 200 characters'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }).withMessage('Description must be under 5000 characters'),
  validate,
];

const messageBody = [
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }).withMessage('Message must be under 2000 characters'),
  validate,
];

const statusUpdate = [
  body('status').isIn(HR_REQUEST_STATUSES).withMessage('Invalid status'),
  body('note').optional().trim().isLength({ max: 500 }).withMessage('Note must be under 500 characters'),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid request ID'), validate];

module.exports = { requestsQuery, createRequest, messageBody, statusUpdate, byId };
