const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const payrollAnalyticsController = require('../controllers/payrollAnalyticsController');
const { PAYROLL_VIEW_ROLES } = require('../utils/payrollAccess');

const router = Router();

router.use(authMiddleware, authorize(...PAYROLL_VIEW_ROLES));

router.get('/overview', asyncHandler(payrollAnalyticsController.getOverview));
router.get('/trends', asyncHandler(payrollAnalyticsController.getTrends));
router.get('/department-cost', asyncHandler(payrollAnalyticsController.getDepartmentCost));

module.exports = router;
