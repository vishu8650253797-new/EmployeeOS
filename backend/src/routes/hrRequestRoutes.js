const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const hrRequestController = require('../controllers/hrRequestController');
const {
  requestsQuery, messageBody, statusUpdate, byId,
} = require('../validators/hrRequestValidator');
const { HR_REQUEST_ADMIN_ROLES } = require('../utils/hrRequestAccess');

const router = Router();

router.use(authMiddleware);
router.use(authorize(...HR_REQUEST_ADMIN_ROLES));

router.get('/', requestsQuery, asyncHandler(hrRequestController.getRequests));
router.get('/:id', byId, asyncHandler(hrRequestController.getRequestById));
router.post('/:id/messages', byId, messageBody, asyncHandler(hrRequestController.addMessage));
router.patch('/:id/status', byId, statusUpdate, asyncHandler(hrRequestController.updateStatus));

module.exports = router;
