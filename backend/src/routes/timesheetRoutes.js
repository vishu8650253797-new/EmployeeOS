const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const timesheetController = require('../controllers/timesheetController');
const { managerTimesheetsQuery, rejectTimesheet, reopenTimesheet, byId } = require('../validators/timesheetValidator');

const router = Router();

// Manager/HR review surface (Steps 13D/13E) — role-gated the same way
// leaveRequestRoutes.js gates leave approval; fine-grained "is this actually
// their direct report" scoping happens inside timesheetService via
// assertManagerScope, not here.
router.use(authMiddleware);
router.use(authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'));

router.get('/', managerTimesheetsQuery, asyncHandler(timesheetController.getTimesheets));
router.get('/:id', byId, asyncHandler(timesheetController.getTimesheetById));
router.get('/:id/entries', byId, asyncHandler(timesheetController.getTimesheetEntries));
router.post('/:id/approve', byId, asyncHandler(timesheetController.approveTimesheet));
router.post('/:id/reject', rejectTimesheet, asyncHandler(timesheetController.rejectTimesheet));
router.post('/:id/reopen', reopenTimesheet, asyncHandler(timesheetController.reopenTimesheet));

module.exports = router;
