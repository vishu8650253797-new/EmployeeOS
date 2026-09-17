const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const essLeaveController = require('../controllers/essLeaveController');
const {
  balanceQuery, requestsQuery, createRequest, byId,
} = require('../validators/essLeaveValidator');

const router = Router();

// authMiddleware is already applied by the parent router (essRoutes.js) —
// no role gate here either, ownership is resolved server-side per request
// via essAccess.resolveSelfEmployee inside essLeaveService.

router.get('/types', asyncHandler(essLeaveController.getLeaveTypes));
router.get('/balance', balanceQuery, asyncHandler(essLeaveController.getBalance));
router.get('/requests', requestsQuery, asyncHandler(essLeaveController.getRequests));
router.post('/requests', createRequest, asyncHandler(essLeaveController.createRequest));
router.get('/requests/:id', byId, asyncHandler(essLeaveController.getRequestById));
router.post('/requests/:id/cancel', byId, asyncHandler(essLeaveController.cancelRequest));

module.exports = router;
