const { body, param } = require('express-validator');
const { validate } = require('./index');
const {
  OFFBOARDING_TYPES, CLEARANCE_STATUSES, ACCESS_DEACTIVATION_STATUSES,
  KNOWLEDGE_TRANSFER_STATUSES,
} = require('../models/Offboarding');

const initiate = [
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('offboardingType').isIn(OFFBOARDING_TYPES).withMessage('Invalid offboarding type'),
  body('reason').optional().trim(),
  body('subReason').optional().trim(),
  body('resignationDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid resignation date'),
  body('terminationDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid termination date'),
  body('lastWorkingDate').isISO8601().withMessage('A valid last working date is required'),
  body('remarks').optional().trim(),
  body('employeeComments').optional().trim(),
  body('saveAsDraft').optional().isBoolean().withMessage('saveAsDraft must be a boolean'),
  validate,
];

const update = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('reason').optional().trim(),
  body('subReason').optional().trim(),
  body('lastWorkingDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid last working date'),
  body('remarks').optional().trim(),
  body('employeeComments').optional().trim(),
  body('hrComments').optional().trim(),
  body('managerComments').optional().trim(),
  validate,
];

const byId = [param('id').isMongoId().withMessage('Invalid offboarding ID'), validate];

const approve = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('level').isIn(['MANAGER', 'HR']).withMessage('level must be MANAGER or HR'),
  body('comments').optional().trim(),
  validate,
];

const reject = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('level').isIn(['MANAGER', 'HR']).withMessage('level must be MANAGER or HR'),
  body('reason').optional().trim(),
  validate,
];

const cancel = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('reason').optional().trim(),
  validate,
];

const updateClearance = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  param('clearanceId').isMongoId().withMessage('Invalid clearance ID'),
  body('status').optional().isIn(CLEARANCE_STATUSES).withMessage('Invalid clearance status'),
  body('comments').optional().trim(),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
  validate,
];

const scheduleExitInterview = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('scheduledDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid scheduled date'),
  body('interviewerId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid interviewer ID'),
  validate,
];

const updateExitInterview = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('action').optional().isIn(['COMPLETE', 'WAIVE']).withMessage('Invalid action'),
  body('satisfactionRating').optional({ checkFalsy: true }).isInt({ min: 1, max: 5 }).withMessage('satisfactionRating must be between 1 and 5'),
  body('rehireEligible').optional().isBoolean().withMessage('rehireEligible must be a boolean'),
  body('reasonForLeaving').optional().trim(),
  body('feedback').optional().trim(),
  body('suggestions').optional().trim(),
  body('managementFeedback').optional().trim(),
  body('workplaceFeedback').optional().trim(),
  body('interviewerNotes').optional().trim(),
  validate,
];

const updateKnowledgeTransfer = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('status').optional().isIn(KNOWLEDGE_TRANSFER_STATUSES).withMessage('Invalid knowledge transfer status'),
  body('handoverOwnerId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid handover owner ID'),
  body('replacementEmployeeId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid replacement employee ID'),
  validate,
];

const requestAccessDeactivation = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('scheduledDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid scheduled date'),
  body('comments').optional().trim(),
  validate,
];

const updateAccessDeactivation = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('status').isIn(ACCESS_DEACTIVATION_STATUSES).withMessage('Invalid access deactivation status'),
  body('comments').optional().trim(),
  validate,
];

const requestDocument = [
  param('id').isMongoId().withMessage('Invalid offboarding ID'),
  body('categoryId').isMongoId().withMessage('Valid document category ID is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
  validate,
];

module.exports = {
  initiate, update, byId, approve, reject, cancel, updateClearance,
  scheduleExitInterview, updateExitInterview, updateKnowledgeTransfer,
  requestAccessDeactivation, updateAccessDeactivation, requestDocument,
};
