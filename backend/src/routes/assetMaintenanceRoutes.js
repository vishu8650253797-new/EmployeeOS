const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const assetMaintenanceController = require('../controllers/assetMaintenanceController');
const { byMaintenanceId, update } = require('../validators/assetMaintenanceValidator');

const router = Router();

// Mounted at /assets/maintenance — registered before the generic /assets
// router so these literal paths never fall through to its /:id pattern.
// Asset-scoped nested routes (GET/POST /assets/:id/maintenance) live in
// assetRoutes.js instead.
router.get('/', authMiddleware, asyncHandler(assetMaintenanceController.getMaintenanceList));
router.get('/:maintenanceId', authMiddleware, byMaintenanceId, asyncHandler(assetMaintenanceController.getMaintenanceById));
router.put('/:maintenanceId', authMiddleware, update, asyncHandler(assetMaintenanceController.updateMaintenance));

module.exports = router;
