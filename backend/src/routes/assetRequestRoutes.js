const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const assetRequestController = require('../controllers/assetRequestController');
const { create, byId, reject, fulfill } = require('../validators/assetRequestValidator');

const router = Router();

// Mounted at /assets/requests — registered before the generic /assets router.
// Self-vs-approver access (an employee sees only their own requests, cannot
// approve their own, etc.) is enforced inside assetRequestService, not by a
// role gate here — mirrors the employee bank-details/tax-info route pattern.
router.get('/', authMiddleware, asyncHandler(assetRequestController.getRequests));
router.get('/:id', authMiddleware, byId, asyncHandler(assetRequestController.getRequestById));
router.post('/', authMiddleware, create, asyncHandler(assetRequestController.createRequest));
router.put('/:id/approve', authMiddleware, byId, asyncHandler(assetRequestController.approveRequest));
router.put('/:id/reject', authMiddleware, reject, asyncHandler(assetRequestController.rejectRequest));
router.put('/:id/cancel', authMiddleware, byId, asyncHandler(assetRequestController.cancelRequest));
router.put('/:id/fulfill', authMiddleware, fulfill, asyncHandler(assetRequestController.fulfillRequest));

module.exports = router;
