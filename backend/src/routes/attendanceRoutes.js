const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const attendanceController = require('../controllers/attendanceController');
const {
  checkIn,
  checkOut,
  myHistory,
  list,
  byId,
  byEmployee,
  byDepartment,
  stats,
} = require('../validators/attendanceValidator');

const router = Router();

router.post('/check-in', authMiddleware, checkIn, asyncHandler(attendanceController.checkIn));
router.post('/check-out', authMiddleware, checkOut, asyncHandler(attendanceController.checkOut));
router.get('/today', authMiddleware, asyncHandler(attendanceController.getTodayAttendance));
router.get('/my-history', authMiddleware, myHistory, asyncHandler(attendanceController.getMyHistory));

router.get('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), list, asyncHandler(attendanceController.getAttendance));
router.get('/stats', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN'), stats, asyncHandler(attendanceController.getAttendanceStats));
router.get('/:id', authMiddleware, byId, asyncHandler(attendanceController.getAttendanceById));

router.get(
  '/employee/:employeeId',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'),
  byEmployee,
  asyncHandler(attendanceController.getEmployeeAttendance)
);

router.get(
  '/employee/:employeeId/summary',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'),
  byEmployee,
  asyncHandler(attendanceController.getEmployeeSummary)
);

router.get(
  '/department/:departmentId',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'),
  byDepartment,
  asyncHandler(attendanceController.getDepartmentAttendance)
);

router.get(
  '/department/:departmentId/stats',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'),
  byDepartment,
  asyncHandler(attendanceController.getDepartmentStats)
);

module.exports = router;
