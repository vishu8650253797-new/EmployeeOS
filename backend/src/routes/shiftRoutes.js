const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const shiftController = require('../controllers/shiftController');
const { shiftsQuery, createShift, updateShift, setShiftStatus, byId } = require('../validators/shiftValidator');
const { SHIFT_ADMIN_ROLES } = require('../utils/scheduleAccess');

const router = Router();

// Shift definitions are org-wide configuration — HR/admin only, not
// manager-scoped (assigning a shift TO an employee is the manager-scoped
// part, handled by employeeScheduleRoutes.js).
router.use(authMiddleware);
router.use(authorize(...SHIFT_ADMIN_ROLES));

router.get('/', shiftsQuery, asyncHandler(shiftController.getShifts));
router.post('/', createShift, asyncHandler(shiftController.createShift));
router.get('/:id', byId, asyncHandler(shiftController.getShiftById));
router.put('/:id', updateShift, asyncHandler(shiftController.updateShift));
router.patch('/:id/status', setShiftStatus, asyncHandler(shiftController.setShiftStatus));
router.delete('/:id', byId, asyncHandler(shiftController.archiveShift));

module.exports = router;
