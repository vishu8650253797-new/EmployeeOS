const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const { upload } = require('../config/upload');
const assetController = require('../controllers/assetController');
const assetMaintenanceController = require('../controllers/assetMaintenanceController');
const {
  create, update, byId, assign, reassign, returnAsset, statusTransition, uploadAttachment, byAttachmentId,
} = require('../validators/assetValidator');
const { create: createMaintenance, byAssetId: maintenanceByAssetId } = require('../validators/assetMaintenanceValidator');

const router = Router();

// Mounted at /assets. /assets/categories, /assets/vendors, /assets/requests,
// /assets/maintenance and /assets/analytics are registered as separate
// routers ahead of this one in routes/index.js, so their literal paths never
// reach this router's /:id pattern.
const FULL_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];
const INVENTORY_VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN', 'MANAGER'];

router.get('/', authMiddleware, authorize(...INVENTORY_VIEW_ROLES), asyncHandler(assetController.getAssets));
router.post('/', authMiddleware, authorize(...FULL_ROLES), create, asyncHandler(assetController.createAsset));

router.get('/:id', authMiddleware, authorize(...INVENTORY_VIEW_ROLES), byId, asyncHandler(assetController.getAssetById));
router.put('/:id', authMiddleware, authorize(...FULL_ROLES), update, asyncHandler(assetController.updateAsset));
// deleteAsset is further restricted to SUPER_ADMIN inside assetService itself
// (irreversible — only permitted for a freshly-created, never-assigned asset).
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN'), byId, asyncHandler(assetController.deleteAsset));

router.post('/:id/assign', authMiddleware, authorize(...FULL_ROLES), assign, asyncHandler(assetController.assignAsset));
router.post('/:id/reassign', authMiddleware, authorize(...FULL_ROLES), reassign, asyncHandler(assetController.reassignAsset));
router.post('/:id/return', authMiddleware, authorize(...FULL_ROLES), returnAsset, asyncHandler(assetController.returnAsset));

router.patch('/:id/damage', authMiddleware, authorize(...FULL_ROLES), statusTransition, asyncHandler(assetController.markDamaged));
router.patch('/:id/lost', authMiddleware, authorize(...FULL_ROLES), statusTransition, asyncHandler(assetController.markLost));
router.patch('/:id/recover', authMiddleware, authorize(...FULL_ROLES), statusTransition, asyncHandler(assetController.recoverAsset));
router.patch('/:id/retire', authMiddleware, authorize(...FULL_ROLES), statusTransition, asyncHandler(assetController.retireAsset));
router.patch('/:id/dispose', authMiddleware, authorize(...FULL_ROLES), statusTransition, asyncHandler(assetController.disposeAsset));

router.post(
  '/:id/attachments',
  authMiddleware,
  authorize(...FULL_ROLES),
  upload.single('file'),
  uploadAttachment,
  asyncHandler(assetController.uploadAttachment)
);
router.get(
  '/:id/attachments/:attachmentId/download',
  authMiddleware,
  authorize(...INVENTORY_VIEW_ROLES),
  byAttachmentId,
  asyncHandler(assetController.downloadAttachment)
);
router.delete(
  '/:id/attachments/:attachmentId',
  authMiddleware,
  authorize(...FULL_ROLES),
  byAttachmentId,
  asyncHandler(assetController.deleteAttachment)
);

// Asset-scoped maintenance — access is enforced inside assetMaintenanceService
// (an elevated role, or the employee the asset is currently assigned to).
router.get('/:id/maintenance', authMiddleware, maintenanceByAssetId, asyncHandler(assetMaintenanceController.getMaintenanceForAsset));
router.post('/:id/maintenance', authMiddleware, createMaintenance, asyncHandler(assetMaintenanceController.createMaintenance));

module.exports = router;
