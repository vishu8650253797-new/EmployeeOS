const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const essTimesheetController = require('../controllers/essTimesheetController');
const { timesheetsQuery, prepareTimesheet, byId } = require('../validators/timesheetValidator');

const router = Router();

// authMiddleware is already applied by the parent router (essRoutes.js) — no
// role gate here either; ownership is resolved server-side per request via
// essAccess.resolveSelfEmployee inside timesheetService.
//
// Employee preparation/review/submission (Step 13C) plus correction &
// resubmission of a rejected timesheet (Step 13E). Manager review/approval/
// reopen lives at the separate /api/timesheets/* router (Steps 13D/13E).

router.get('/', timesheetsQuery, asyncHandler(essTimesheetController.getTimesheets));
router.get('/current', asyncHandler(essTimesheetController.getCurrentTimesheet));
router.post('/prepare', prepareTimesheet, asyncHandler(essTimesheetController.prepareTimesheet));
router.get('/:id', byId, asyncHandler(essTimesheetController.getTimesheetById));
router.get('/:id/entries', byId, asyncHandler(essTimesheetController.getTimesheetEntries));
router.post('/:id/submit', byId, asyncHandler(essTimesheetController.submitTimesheet));
router.post('/:id/resubmit', byId, asyncHandler(essTimesheetController.resubmitTimesheet));

module.exports = router;
