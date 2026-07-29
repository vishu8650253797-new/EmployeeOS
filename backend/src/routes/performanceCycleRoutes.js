const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const performanceCycleController = require('../controllers/performanceCycleController');

const router = Router();

router.get('/', authMiddleware, asyncHandler(performanceCycleController.getCycles));
router.get('/active', authMiddleware, asyncHandler(performanceCycleController.getActiveCycle));
router.get('/:id', authMiddleware, asyncHandler(performanceCycleController.getCycleById));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), asyncHandler(performanceCycleController.createCycle));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), asyncHandler(performanceCycleController.updateCycle));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), asyncHandler(performanceCycleController.deleteCycle));

module.exports = router;
