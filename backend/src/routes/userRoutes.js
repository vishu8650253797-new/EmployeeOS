const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { User } = require('../models');
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
