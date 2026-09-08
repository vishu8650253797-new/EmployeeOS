const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const payrollRunController = require('../controllers/payrollRunController');
const { create, byId, reject, cancel, updateRecord } = require('../validators/payrollRunValidator');
const { PAYROLL_VIEW_ROLES, PAYROLL_PREPARE_ROLES, PAYROLL_APPROVE_ROLES } = require('../utils/payrollAccess');

const router = Router();

router.use(authMiddleware);

router.get('/', authorize(...PAYROLL_VIEW_ROLES), asyncHandler(payrollRunController.list));
router.get('/:id', authorize(...PAYROLL_VIEW_ROLES), byId, asyncHandler(payrollRunController.getById));
router.get('/:id/records', authorize(...PAYROLL_VIEW_ROLES), byId, asyncHandler(payrollRunController.getRecords));

router.post('/', authorize(...PAYROLL_PREPARE_ROLES), create, asyncHandler(payrollRunController.create));
router.post('/:id/process', authorize(...PAYROLL_PREPARE_ROLES), byId, asyncHandler(payrollRunController.process));
router.post('/:id/recalculate', authorize(...PAYROLL_PREPARE_ROLES), byId, asyncHandler(payrollRunController.recalculate));
router.put('/:id/records/:recordId', authorize(...PAYROLL_PREPARE_ROLES), updateRecord, asyncHandler(payrollRunController.updateRecord));
router.post('/:id/submit', authorize(...PAYROLL_PREPARE_ROLES), byId, asyncHandler(payrollRunController.submit));

router.post('/:id/approve', authorize(...PAYROLL_APPROVE_ROLES), byId, asyncHandler(payrollRunController.approve));
router.post('/:id/reject', authorize(...PAYROLL_APPROVE_ROLES), reject, asyncHandler(payrollRunController.reject));
router.post('/:id/finalize', authorize(...PAYROLL_APPROVE_ROLES), byId, asyncHandler(payrollRunController.finalize));

router.post('/:id/cancel', authorize(...PAYROLL_PREPARE_ROLES), cancel, asyncHandler(payrollRunController.cancel));

module.exports = router;
