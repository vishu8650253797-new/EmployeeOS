const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const leaveBalanceController = require('../controllers/leaveBalanceController');
const { getEmployee, update } = require('../validators/leaveBalanceValidator');

const router = Router();

router.get('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), asyncHandler(leaveBalanceController.getLeaveBalances));
router.get('/my', authMiddleware, asyncHandler(leaveBalanceController.getMyLeaveBalances));
router.get('/employee/:employeeId', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), getEmployee, asyncHandler(leaveBalanceController.getEmployeeLeaveBalances));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), update, asyncHandler(leaveBalanceController.updateLeaveBalance));

module.exports = router;
