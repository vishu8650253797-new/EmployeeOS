const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const performanceAnalyticsController = require('../controllers/performanceAnalyticsController');

const router = Router();

router.get('/overview', authMiddleware, asyncHandler(performanceAnalyticsController.getOverviewAnalytics));
router.get('/departments', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), asyncHandler(performanceAnalyticsController.getDepartmentAnalytics));
router.get('/trends/:employeeId', authMiddleware, asyncHandler(performanceAnalyticsController.getPerformanceTrends));
router.get('/top-performers', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(performanceAnalyticsController.getTopPerformers));
router.get('/at-risk', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(performanceAnalyticsController.getAtRiskEmployees));
router.get('/employee/:employeeId/summary', authMiddleware, asyncHandler(performanceAnalyticsController.getEmployeePerformanceSummary));

module.exports = router;
