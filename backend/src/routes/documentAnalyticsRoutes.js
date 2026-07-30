const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const documentAnalyticsController = require('../controllers/documentAnalyticsController');

const router = Router();

router.use(authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'));

router.get('/overview', asyncHandler(documentAnalyticsController.getOverview));
router.get('/expiry', asyncHandler(documentAnalyticsController.getExpiryAnalytics));
router.get('/categories', asyncHandler(documentAnalyticsController.getCategoryAnalytics));
router.get('/departments', asyncHandler(documentAnalyticsController.getDepartmentAnalytics));
router.get('/compliance', asyncHandler(documentAnalyticsController.getComplianceReport));

module.exports = router;
