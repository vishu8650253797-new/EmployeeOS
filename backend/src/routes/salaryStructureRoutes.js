const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const salaryStructureController = require('../controllers/salaryStructureController');
const { create, update, byId } = require('../validators/salaryStructureValidator');
const { PAYROLL_VIEW_ROLES, PAYROLL_PREPARE_ROLES } = require('../utils/payrollAccess');

const router = Router();

router.use(authMiddleware);

router.get('/', authorize(...PAYROLL_VIEW_ROLES), asyncHandler(salaryStructureController.getStructures));
router.get('/:id', authorize(...PAYROLL_VIEW_ROLES), byId, asyncHandler(salaryStructureController.getStructureById));
router.post('/', authorize(...PAYROLL_PREPARE_ROLES), create, asyncHandler(salaryStructureController.createStructure));
router.put('/:id', authorize(...PAYROLL_PREPARE_ROLES), update, asyncHandler(salaryStructureController.updateStructure));
router.delete('/:id', authorize(...PAYROLL_PREPARE_ROLES), byId, asyncHandler(salaryStructureController.deleteStructure));

module.exports = router;
