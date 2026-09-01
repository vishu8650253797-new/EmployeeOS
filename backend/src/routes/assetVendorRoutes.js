const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const assetVendorController = require('../controllers/assetVendorController');
const { create, update, byId } = require('../validators/assetVendorValidator');

const router = Router();

// Mounted at /assets/vendors — registered before the generic /assets router.
const FULL_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];

router.get('/', authMiddleware, asyncHandler(assetVendorController.getVendors));
router.get('/:id', authMiddleware, byId, asyncHandler(assetVendorController.getVendorById));
router.post('/', authMiddleware, authorize(...FULL_ROLES), create, asyncHandler(assetVendorController.createVendor));
router.put('/:id', authMiddleware, authorize(...FULL_ROLES), update, asyncHandler(assetVendorController.updateVendor));
router.delete('/:id', authMiddleware, authorize(...FULL_ROLES), byId, asyncHandler(assetVendorController.deleteVendor));

module.exports = router;
