const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const assetAnalyticsController = require('../controllers/assetAnalyticsController');

const router = Router();

// Mounted at /assets/analytics — registered before the generic /assets router
// in routes/index.js so these literal paths are matched first.
const INVENTORY_VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN', 'MANAGER'];

router.get('/overview', authMiddleware, authorize(...INVENTORY_VIEW_ROLES), asyncHandler(assetAnalyticsController.getOverview));
router.get('/status', authMiddleware, authorize(...INVENTORY_VIEW_ROLES), asyncHandler(assetAnalyticsController.getStatusBreakdown));
router.get('/category', authMiddleware, authorize(...INVENTORY_VIEW_ROLES), asyncHandler(assetAnalyticsController.getCategoryBreakdown));
router.get('/department', authMiddleware, authorize(...INVENTORY_VIEW_ROLES), asyncHandler(assetAnalyticsController.getDepartmentBreakdown));
router.get('/maintenance', authMiddleware, authorize(...INVENTORY_VIEW_ROLES), asyncHandler(assetAnalyticsController.getMaintenanceAnalytics));
router.get('/warranty', authMiddleware, authorize(...INVENTORY_VIEW_ROLES), asyncHandler(assetAnalyticsController.getWarrantyAnalytics));

module.exports = router;
