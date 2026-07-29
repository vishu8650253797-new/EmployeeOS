const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const taskController = require('../controllers/taskController');
const { create, update, getById, statusUpdate, assign } = require('../validators/taskValidator');

const router = Router();

router.get('/', authMiddleware, asyncHandler(taskController.getTasks));
router.get('/:id', authMiddleware, getById, asyncHandler(taskController.getTaskById));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), create, asyncHandler(taskController.createTask));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), update, asyncHandler(taskController.updateTask));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), getById, asyncHandler(taskController.deleteTask));
router.patch('/:id/status', authMiddleware, statusUpdate, asyncHandler(taskController.updateTaskStatus));
router.patch('/:id/assign', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), assign, asyncHandler(taskController.assignTask));

module.exports = router;
