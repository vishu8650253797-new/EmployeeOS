const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const employeeScheduleController = require('../controllers/employeeScheduleController');
const { schedulesQuery, assignSchedule, byId } = require('../validators/employeeScheduleValidator');
const { SCHEDULE_MANAGER_ROLES } = require('../utils/scheduleAccess');

const router = Router();

// Manager-scoped, mirroring timesheetRoutes.js exactly — role-gated here,
// fine-grained "is this actually their direct report" scoping happens
// inside employeeScheduleService via assertManagerScope, not here.
router.use(authMiddleware);
router.use(authorize(...SCHEDULE_MANAGER_ROLES));

router.get('/', schedulesQuery, asyncHandler(employeeScheduleController.getSchedules));
router.post('/', assignSchedule, asyncHandler(employeeScheduleController.assign));
router.get('/:id', byId, asyncHandler(employeeScheduleController.getScheduleById));
router.post('/:id/cancel', byId, asyncHandler(employeeScheduleController.cancel));

module.exports = router;
