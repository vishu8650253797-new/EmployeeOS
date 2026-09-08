const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const payrollPeriodController = require('../controllers/payrollPeriodController');
const { create, byId } = require('../validators/payrollPeriodValidator');
const { PAYROLL_VIEW_ROLES, PAYROLL_PREPARE_ROLES, PAYROLL_APPROVE_ROLES } = require('../utils/payrollAccess');

const router = Router();

router.use(authMiddleware);

router.get('/', authorize(...PAYROLL_VIEW_ROLES), asyncHandler(payrollPeriodController.list));
router.get('/:id', authorize(...PAYROLL_VIEW_ROLES), byId, asyncHandler(payrollPeriodController.getById));
router.post('/', authorize(...PAYROLL_PREPARE_ROLES), create, asyncHandler(payrollPeriodController.create));
router.put('/:id/close', authorize(...PAYROLL_APPROVE_ROLES), byId, asyncHandler(payrollPeriodController.close));
router.delete('/:id', authorize(...PAYROLL_PREPARE_ROLES), byId, asyncHandler(payrollPeriodController.remove));

module.exports = router;
