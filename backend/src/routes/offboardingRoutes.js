const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const offboardingController = require('../controllers/offboardingController');
const {
  initiate, update, byId, approve, reject, cancel, updateClearance,
  scheduleExitInterview, updateExitInterview, updateKnowledgeTransfer,
  requestAccessDeactivation, updateAccessDeactivation, requestDocument,
} = require('../validators/offboardingValidator');

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(offboardingController.list));
router.get('/dashboard', asyncHandler(offboardingController.getDashboard));
router.post('/', initiate, asyncHandler(offboardingController.initiate));

router.get('/:id', byId, asyncHandler(offboardingController.getById));
router.patch('/:id', update, asyncHandler(offboardingController.update));
router.post('/:id/submit', byId, asyncHandler(offboardingController.submit));
router.post('/:id/approve', approve, asyncHandler(offboardingController.approve));
router.post('/:id/reject', reject, asyncHandler(offboardingController.reject));
router.post('/:id/cancel', cancel, asyncHandler(offboardingController.cancel));
router.post('/:id/complete', byId, asyncHandler(offboardingController.complete));

router.get('/:id/timeline', byId, asyncHandler(offboardingController.getTimeline));

router.get('/:id/clearances', byId, asyncHandler(offboardingController.getClearances));
router.patch('/:id/clearances/:clearanceId', updateClearance, asyncHandler(offboardingController.updateClearance));

router.get('/:id/assets', byId, asyncHandler(offboardingController.getAssets));
router.post('/:id/assets/refresh-clearance', byId, asyncHandler(offboardingController.refreshAssetClearance));

router.get('/:id/exit-interview', byId, asyncHandler((req, res) =>
  offboardingController.getById(req, res)));
router.post('/:id/exit-interview', scheduleExitInterview, asyncHandler(offboardingController.scheduleExitInterview));
router.patch('/:id/exit-interview', updateExitInterview, asyncHandler(offboardingController.updateExitInterview));

router.patch('/:id/knowledge-transfer', updateKnowledgeTransfer, asyncHandler(offboardingController.updateKnowledgeTransfer));

router.get('/:id/access', byId, asyncHandler((req, res) => offboardingController.getById(req, res)));
router.post('/:id/access/deactivate', requestAccessDeactivation, asyncHandler(offboardingController.requestAccessDeactivation));
router.patch('/:id/access', updateAccessDeactivation, asyncHandler(offboardingController.updateAccessDeactivation));

router.get('/:id/settlement-preparation', byId, authorize('SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'), asyncHandler(offboardingController.getSettlementPreparation));

router.get('/:id/documents', byId, asyncHandler(offboardingController.getDocuments));
router.post('/:id/documents', requestDocument, asyncHandler(offboardingController.requestDocument));

module.exports = router;
