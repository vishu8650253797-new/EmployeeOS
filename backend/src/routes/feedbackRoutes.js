const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const feedbackController = require('../controllers/feedbackController');

const router = Router();

router.get('/', authMiddleware, asyncHandler(feedbackController.getFeedback));
router.get('/employee/:employeeId', authMiddleware, asyncHandler(feedbackController.getEmployeeFeedback));
router.get('/requests', authMiddleware, asyncHandler(feedbackController.getFeedbackRequests));
router.get('/:id', authMiddleware, asyncHandler(feedbackController.getFeedbackById));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(feedbackController.createFeedback));
router.put('/:id', authMiddleware, asyncHandler(feedbackController.updateFeedback));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(feedbackController.deleteFeedback));
router.post('/requests', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(feedbackController.createFeedbackRequest));
router.put('/requests/:id/submit', authMiddleware, asyncHandler(feedbackController.submitFeedbackRequest));
router.put('/requests/:id/decline', authMiddleware, asyncHandler(feedbackController.declineFeedbackRequest));

module.exports = router;
