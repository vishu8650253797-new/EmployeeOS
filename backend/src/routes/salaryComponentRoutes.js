const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const salaryComponentController = require('../controllers/salaryComponentController');
const { create, update, byId } = require('../validators/salaryComponentValidator');
const { PAYROLL_VIEW_ROLES, PAYROLL_PREPARE_ROLES } = require('../utils/payrollAccess');

const router = Router();

router.use(authMiddleware);

router.get('/', authorize(...PAYROLL_VIEW_ROLES), asyncHandler(salaryComponentController.getComponents));
router.get('/:id', authorize(...PAYROLL_VIEW_ROLES), byId, asyncHandler(salaryComponentController.getComponentById));
router.post('/', authorize(...PAYROLL_PREPARE_ROLES), create, asyncHandler(salaryComponentController.createComponent));
router.put('/:id', authorize(...PAYROLL_PREPARE_ROLES), update, asyncHandler(salaryComponentController.updateComponent));
router.delete('/:id', authorize(...PAYROLL_PREPARE_ROLES), byId, asyncHandler(salaryComponentController.deleteComponent));

module.exports = router;
