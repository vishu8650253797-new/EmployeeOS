const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const employeeScheduleController = require('../controllers/employeeScheduleController');
const { schedulesQuery, assignSchedule, updateSchedule, validateSchedule, bulkAssignSchedule, byId } = require('../validators/employeeScheduleValidator');
const { SCHEDULE_MANAGER_ROLES } = require('../utils/scheduleAccess');

const router = Router();

// Manager-scoped, mirroring timesheetRoutes.js exactly — role-gated here,
// fine-grained "is this actually their direct report" scoping happens
// inside employeeScheduleService via assertManagerScope, not here.
router.use(authMiddleware);
router.use(authorize(...SCHEDULE_MANAGER_ROLES));

router.get('/', schedulesQuery, asyncHandler(employeeScheduleController.getSchedules));
router.post('/', assignSchedule, asyncHandler(employeeScheduleController.assign));

// Static sub-paths registered before /:id so they aren't swallowed by the
// param route (the same route-ordering rule already followed elsewhere in
// this codebase, e.g. timesheetRoutes.js's /summary).
router.post('/validate', validateSchedule, asyncHandler(employeeScheduleController.validateAssignment));
router.post('/bulk', bulkAssignSchedule, asyncHandler(employeeScheduleController.bulkAssign));

router.get('/:id', byId, asyncHandler(employeeScheduleController.getScheduleById));
router.patch('/:id', updateSchedule, asyncHandler(employeeScheduleController.updateSchedule));
router.post('/:id/cancel', byId, asyncHandler(employeeScheduleController.cancel));

module.exports = router;
