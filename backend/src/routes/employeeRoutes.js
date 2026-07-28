const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const employeeController = require('../controllers/employeeController');
const { create, update, getById } = require('../validators/employeeValidator');

const router = Router();

router.get(
  '/',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'),
  asyncHandler(employeeController.getEmployees)
);

router.get(
  '/:id',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'),
  getById,
  asyncHandler(employeeController.getEmployeeById)
);

router.post(
  '/',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN'),
  create,
  asyncHandler(employeeController.createEmployee)
);

router.put(
  '/:id',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN'),
  update,
  asyncHandler(employeeController.updateEmployee)
);

router.delete(
  '/:id',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN'),
  getById,
  asyncHandler(employeeController.deleteEmployee)
);

module.exports = router;
