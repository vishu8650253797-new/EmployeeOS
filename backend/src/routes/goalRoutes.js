const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const goalController = require('../controllers/goalController');

const router = Router();

router.get('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(goalController.getGoals));
router.get('/my', authMiddleware, asyncHandler(goalController.getMyGoals));
router.get('/employee/:employeeId', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(goalController.getEmployeeGoals));
router.get('/cycle/:cycleId', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(goalController.getCycleGoals));
router.get('/:id', authMiddleware, asyncHandler(goalController.getGoalById));
router.get('/:id/progress-history', authMiddleware, asyncHandler(goalController.getGoalProgressHistory));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(goalController.createGoal));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(goalController.updateGoal));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(goalController.deleteGoal));
router.put('/:id/progress', authMiddleware, asyncHandler(goalController.updateGoalProgress));
router.put('/:id/status', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(goalController.updateGoalStatus));

module.exports = router;
