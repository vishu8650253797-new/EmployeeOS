const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const departmentController = require('../controllers/departmentController');
const { create, update, getById } = require('../validators/departmentValidator');

const router = Router();

router.get(
  '/',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'),
  asyncHandler(departmentController.getDepartments)
);

router.get(
  '/:id',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'),
  getById,
  asyncHandler(departmentController.getDepartmentById)
);

router.post(
  '/',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN'),
  create,
  asyncHandler(departmentController.createDepartment)
);

router.put(
  '/:id',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN'),
  update,
  asyncHandler(departmentController.updateDepartment)
);

router.delete(
  '/:id',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN'),
  getById,
  asyncHandler(departmentController.deleteDepartment)
);

module.exports = router;
