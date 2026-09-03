const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { User } = require('../models');
const { NOTIFICATION_CATEGORIES } = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// GET /api/users/me — protected current user endpoint
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id || req.user.id).populate('organizationId', 'name slug status');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, user });
}));

// GET/PATCH /api/users/me/notification-preferences — self-service only, never
// another user's preferences (no :id param, always the authenticated user).
router.get('/me/notification-preferences', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('notificationPreferences').lean();
  res.json({ success: true, data: user?.notificationPreferences || {} });
}));

router.patch('/me/notification-preferences', authMiddleware, asyncHandler(async (req, res) => {
  const updates = {};
  for (const category of NOTIFICATION_CATEGORIES) {
    if (typeof req.body[category] === 'boolean') {
      updates[`notificationPreferences.${category}`] = req.body[category];
    }
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true }).select('notificationPreferences');
  res.json({ success: true, message: 'Notification preferences updated', data: user.notificationPreferences });
}));

// GET /api/users — example RBAC-protected admin route
router.get(
  '/',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN'),
  asyncHandler(async (req, res) => {
    const users = await User.find({ organizationId: req.organizationId });
    res.json({ success: true, users });
  })
);

module.exports = router;
