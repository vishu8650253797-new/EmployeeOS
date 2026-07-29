const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const performanceReviewController = require('../controllers/performanceReviewController');

const router = Router();

router.get('/', authMiddleware, asyncHandler(performanceReviewController.getReviews));
router.get('/my', authMiddleware, asyncHandler(performanceReviewController.getMyReviews));
router.get('/employee/:employeeId', authMiddleware, asyncHandler(performanceReviewController.getEmployeeReviews));
router.get('/cycle/:cycleId', authMiddleware, asyncHandler(performanceReviewController.getCycleReviews));
router.get('/:id', authMiddleware, asyncHandler(performanceReviewController.getReviewById));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(performanceReviewController.createReview));
router.put('/:id', authMiddleware, asyncHandler(performanceReviewController.updateReview));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), asyncHandler(performanceReviewController.deleteReview));
router.put('/:id/submit', authMiddleware, asyncHandler(performanceReviewController.submitReview));
router.put('/:id/approve', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(performanceReviewController.approveReview));
router.put('/:id/complete', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(performanceReviewController.completeReview));
router.put('/:id/reopen', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), asyncHandler(performanceReviewController.reopenReview));

module.exports = router;
