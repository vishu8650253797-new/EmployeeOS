const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const notificationController = require('../controllers/notificationController');
const { byId } = require('../validators/notificationValidator');

const router = Router();

router.get('/', authMiddleware, asyncHandler(notificationController.getNotifications));
router.get('/unread-count', authMiddleware, asyncHandler(notificationController.getUnreadCount));
router.put('/:id/read', authMiddleware, byId, asyncHandler(notificationController.markAsRead));
router.put('/read-all', authMiddleware, asyncHandler(notificationController.markAllAsRead));

module.exports = router;
