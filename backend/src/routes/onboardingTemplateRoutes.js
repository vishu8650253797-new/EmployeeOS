const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const onboardingTemplateController = require('../controllers/onboardingTemplateController');
const { create, update, byId } = require('../validators/onboardingTemplateValidator');

const router = Router();

router.get('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(onboardingTemplateController.getTemplates));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), create, asyncHandler(onboardingTemplateController.createTemplate));
router.get('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), byId, asyncHandler(onboardingTemplateController.getTemplateById));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), update, asyncHandler(onboardingTemplateController.updateTemplate));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), byId, asyncHandler(onboardingTemplateController.deleteTemplate));

module.exports = router;
