const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const essScheduleController = require('../controllers/essScheduleController');

const router = Router();

// authMiddleware is already applied by the parent router (essRoutes.js).
// Minimal, read-only foundation (Step 14A) — an employee viewing their own
// current shift assignment. No calendar/UI workflow yet; that's later
// Step 14 work.
router.get('/', asyncHandler(essScheduleController.getMySchedule));

module.exports = router;
