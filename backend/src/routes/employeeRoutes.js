const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const employeeController = require('../controllers/employeeController');
const { photoUpload } = require('../config/upload');
const {
  create, update, getById, updateBankDetails, updateTaxInfo, photoValidator,
} = require('../validators/employeeValidator');

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

// Pre-boarding: self-or-HR access is enforced inside employeeService, not by role gate here.
router.get('/:id/bank-details', authMiddleware, getById, asyncHandler(employeeController.getBankDetails));
router.put('/:id/bank-details', authMiddleware, updateBankDetails, asyncHandler(employeeController.updateBankDetails));
router.get('/:id/tax-info', authMiddleware, getById, asyncHandler(employeeController.getTaxInfo));
router.put('/:id/tax-info', authMiddleware, updateTaxInfo, asyncHandler(employeeController.updateTaxInfo));
router.patch('/:id/photo', authMiddleware, photoUpload.single('photo'), photoValidator, asyncHandler(employeeController.updatePhoto));
router.get('/:id/photo', authMiddleware, getById, asyncHandler(employeeController.getPhoto));

module.exports = router;
