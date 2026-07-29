const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const taskCommentController = require('../controllers/taskCommentController');
const { create, update, getById } = require('../validators/taskCommentValidator');

const router = Router();

router.get('/task/:taskId', authMiddleware, asyncHandler(taskCommentController.getTaskComments));
router.get('/:id', authMiddleware, getById, asyncHandler(taskCommentController.getCommentById));
router.post('/task/:taskId', authMiddleware, create, asyncHandler(taskCommentController.createTaskComment));
router.put('/:id', authMiddleware, update, asyncHandler(taskCommentController.updateTaskComment));
router.delete('/:id', authMiddleware, getById, asyncHandler(taskCommentController.deleteTaskComment));

module.exports = router;
