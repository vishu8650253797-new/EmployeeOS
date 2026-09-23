const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const essTimeEntryController = require('../controllers/essTimeEntryController');
const { entriesQuery, endEntry, byId } = require('../validators/timeEntryValidator');

const router = Router();

// authMiddleware is already applied by the parent router (essRoutes.js) — no
// role gate here either; ownership is resolved server-side per request via
// essAccess.resolveSelfEmployee inside timeEntryService.
//
// Foundation-level surface only (Step 13A): start/end a single entry, list
// and view your own. No breaks, corrections, submission, or manager
// review yet — those are Step 13B.

router.post('/start', asyncHandler(essTimeEntryController.startEntry));
router.post('/:id/end', endEntry, asyncHandler(essTimeEntryController.endEntry));
router.get('/', entriesQuery, asyncHandler(essTimeEntryController.getEntries));
router.get('/:id', byId, asyncHandler(essTimeEntryController.getEntryById));

module.exports = router;
