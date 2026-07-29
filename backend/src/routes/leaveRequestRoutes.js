const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const leaveRequestController = require('../controllers/leaveRequestController');
const { create, byId, byEmployeeId, status } = require('../validators/leaveRequestValidator');

const router = Router();

router.get('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), status, asyncHandler(leaveRequestController.getLeaveRequests));
router.get('/my', authMiddleware, status, asyncHandler(leaveRequestController.getMyLeaveRequests));
router.get('/employee/:employeeId', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), byEmployeeId, asyncHandler(leaveRequestController.getEmployeeLeaveRequests));
router.get('/:id', authMiddleware, byId, asyncHandler(leaveRequestController.getLeaveRequestById));
router.post('/', authMiddleware, create, asyncHandler(leaveRequestController.createLeaveRequest));
router.put('/:id/approve', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), byId, asyncHandler(leaveRequestController.approveLeaveRequest));
router.put('/:id/reject', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), byId, asyncHandler(leaveRequestController.rejectLeaveRequest));
router.put('/:id/cancel', authMiddleware, byId, asyncHandler(leaveRequestController.cancelLeaveRequest));

module.exports = router;
