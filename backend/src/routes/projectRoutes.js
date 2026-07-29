const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const projectController = require('../controllers/projectController');
const { create, update, getById } = require('../validators/projectValidator');

const router = Router();

router.get('/', authMiddleware, asyncHandler(projectController.getProjects));
router.get('/:id', authMiddleware, getById, asyncHandler(projectController.getProjectById));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), create, asyncHandler(projectController.createProject));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), update, asyncHandler(projectController.updateProject));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), getById, asyncHandler(projectController.deleteProject));
router.post('/:id/members', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(projectController.addProjectMember));
router.delete('/:id/members', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(projectController.removeProjectMember));
router.get('/:id/statistics', authMiddleware, getById, asyncHandler(projectController.getProjectStatistics));
router.post('/:id/progress', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), getById, asyncHandler(projectController.calculateProjectProgress));

module.exports = router;
