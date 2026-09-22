const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const essHrRequestController = require('../controllers/essHrRequestController');
const {
  requestsQuery, createRequest, messageBody, byId,
} = require('../validators/hrRequestValidator');

const router = Router();

// authMiddleware is already applied by the parent router (essRoutes.js) — no
// role gate here either; ownership is resolved server-side per request via
// essAccess.resolveSelfEmployee inside hrRequestService.

router.get('/', requestsQuery, asyncHandler(essHrRequestController.getRequests));
router.post('/', createRequest, asyncHandler(essHrRequestController.createRequest));
router.get('/:id', byId, asyncHandler(essHrRequestController.getRequestById));
router.post('/:id/messages', byId, messageBody, asyncHandler(essHrRequestController.addMessage));
router.post('/:id/cancel', byId, asyncHandler(essHrRequestController.cancelRequest));

module.exports = router;
