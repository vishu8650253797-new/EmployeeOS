const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const payslipController = require('../controllers/payslipController');
const { byId } = require('../validators/payslipValidator');
const { PAYROLL_VIEW_ROLES } = require('../utils/payrollAccess');

const router = Router();

router.use(authMiddleware);

// Self-service — any authenticated user with a linked employee record.
router.get('/me', asyncHandler(payslipController.getMyPayslips));
router.get('/me/:id', byId, asyncHandler(payslipController.getMyPayslipById));

// Elevated, org-wide views.
router.get('/', authorize(...PAYROLL_VIEW_ROLES), asyncHandler(payslipController.getPayslips));
router.get('/:id', authorize(...PAYROLL_VIEW_ROLES), byId, asyncHandler(payslipController.getPayslipById));

module.exports = router;
