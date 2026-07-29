const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const leaveTypeController = require('../controllers/leaveTypeController');
const { create, update, getById } = require('../validators/leaveTypeValidator');

const router = Router();

router.get('/', authMiddleware, asyncHandler(leaveTypeController.getLeaveTypes));
router.get('/:id', authMiddleware, getById, asyncHandler(leaveTypeController.getLeaveTypeById));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), create, asyncHandler(leaveTypeController.createLeaveType));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), update, asyncHandler(leaveTypeController.updateLeaveType));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), getById, asyncHandler(leaveTypeController.deleteLeaveType));

module.exports = router;
