const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const essAttendanceController = require('../controllers/essAttendanceController');
const { myHistory, byId } = require('../validators/attendanceValidator');

const router = Router();

// Reuses the existing attendanceValidator chains as-is (myHistory already
// validates page/limit/month/year/startDate/endDate; byId validates a
// MongoId param) rather than duplicating equivalent rules.
router.get('/', myHistory, asyncHandler(essAttendanceController.getMyHistory));
router.get('/summary', myHistory, asyncHandler(essAttendanceController.getMySummary));
router.get('/:id', byId, asyncHandler(essAttendanceController.getRecordById));

module.exports = router;
