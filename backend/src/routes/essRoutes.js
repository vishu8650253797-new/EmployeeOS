const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const essController = require('../controllers/essController');
const {
  updateProfile, addEmergencyContact, updateEmergencyContact, contactIdParam,
} = require('../validators/essProfileValidator');
const essLeaveRoutes = require('./essLeaveRoutes');
const essAttendanceRoutes = require('./essAttendanceRoutes');
const essHrRequestRoutes = require('./essHrRequestRoutes');
const essTimeEntryRoutes = require('./essTimeEntryRoutes');
const essTimesheetRoutes = require('./essTimesheetRoutes');

const router = Router();

// No role gate here — every authenticated user is entitled to their own
// self-service context; ownership (not role) is what scopes the response,
// resolved entirely server-side from the authenticated session (see
// utils/essAccess.js).
router.use(authMiddleware);

router.get('/me', asyncHandler(essController.getMe));

router.get('/me/profile', asyncHandler(essController.getProfile));
router.patch('/me/profile', updateProfile, asyncHandler(essController.updateProfile));

router.post('/me/profile/emergency-contacts', addEmergencyContact, asyncHandler(essController.addEmergencyContact));
router.patch('/me/profile/emergency-contacts/:contactId', updateEmergencyContact, asyncHandler(essController.updateEmergencyContact));
router.delete('/me/profile/emergency-contacts/:contactId', contactIdParam, asyncHandler(essController.removeEmergencyContact));

// Profile photo reuses the existing employee photo endpoint as-is
// (PATCH/GET /api/employees/:id/photo) — it is already self-or-HR gated
// inside employeeService (assertSelfOrHR), already validates file type via
// magic-byte signature checking, and already uses the shared storage
// service. No new upload endpoint is added here; the frontend calls that
// endpoint directly with the employeeId returned by GET /api/ess/me.

router.use('/leave', essLeaveRoutes);
router.use('/attendance', essAttendanceRoutes);
router.use('/requests', essHrRequestRoutes);
router.use('/time-entries', essTimeEntryRoutes);
router.use('/timesheets', essTimesheetRoutes);

module.exports = router;
