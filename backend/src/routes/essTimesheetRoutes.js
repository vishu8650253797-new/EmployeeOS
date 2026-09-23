const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const essTimesheetController = require('../controllers/essTimesheetController');
const { timesheetsQuery, prepareTimesheet, byId } = require('../validators/timesheetValidator');

const router = Router();

// authMiddleware is already applied by the parent router (essRoutes.js) — no
// role gate here either; ownership is resolved server-side per request via
// essAccess.resolveSelfEmployee inside timesheetService.
//
// Employee preparation/review/submission only (Step 13C). No manager
// review/approval surface exists yet — that's Step 13D.

router.get('/', timesheetsQuery, asyncHandler(essTimesheetController.getTimesheets));
router.get('/current', asyncHandler(essTimesheetController.getCurrentTimesheet));
router.post('/prepare', prepareTimesheet, asyncHandler(essTimesheetController.prepareTimesheet));
router.get('/:id', byId, asyncHandler(essTimesheetController.getTimesheetById));
router.get('/:id/entries', byId, asyncHandler(essTimesheetController.getTimesheetEntries));
router.post('/:id/submit', byId, asyncHandler(essTimesheetController.submitTimesheet));

module.exports = router;
