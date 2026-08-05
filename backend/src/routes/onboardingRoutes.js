const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const onboardingController = require('../controllers/onboardingController');
const {
  createProcess, updateProcess, cancelProcess, addTask, updateTask, updateTaskStatus, byId, byTaskId,
} = require('../validators/onboardingValidator');

const router = Router();

// Processes
router.get('/processes', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(onboardingController.getProcesses));
router.post('/processes', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), createProcess, asyncHandler(onboardingController.createProcess));
router.get('/processes/:id', authMiddleware, byId, asyncHandler(onboardingController.getProcessById));
router.put('/processes/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), updateProcess, asyncHandler(onboardingController.updateProcess));
router.patch('/processes/:id/cancel', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), cancelProcess, asyncHandler(onboardingController.cancelProcess));
router.post('/processes/:id/tasks', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), addTask, asyncHandler(onboardingController.addTask));

// Tasks
router.get('/tasks/my', authMiddleware, asyncHandler(onboardingController.getMyTasks));
router.put('/tasks/:taskId', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), updateTask, asyncHandler(onboardingController.updateTask));
router.patch('/tasks/:taskId/status', authMiddleware, updateTaskStatus, asyncHandler(onboardingController.updateTaskStatus));
router.delete('/tasks/:taskId', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), byTaskId, asyncHandler(onboardingController.deleteTask));

module.exports = router;
