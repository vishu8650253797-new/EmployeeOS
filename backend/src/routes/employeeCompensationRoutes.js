const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const employeeCompensationController = require('../controllers/employeeCompensationController');
const { history, byEmployeeId, byId, assign, update } = require('../validators/employeeCompensationValidator');
const { PAYROLL_PREPARE_ROLES } = require('../utils/payrollAccess');

const router = Router();

router.use(authMiddleware);

// GET routes have no route-level role gate — self-access is permitted for an
// employee's own compensation, enforced inside the service via
// payrollAccess.assertSelfOrElevated (the route layer can't tell "my own
// record" from "someone else's" without a DB lookup).
router.get('/', history, asyncHandler(employeeCompensationController.getHistory));
router.get('/employee/:employeeId/current', byEmployeeId, asyncHandler(employeeCompensationController.getCurrent));
router.get('/:id', byId, asyncHandler(employeeCompensationController.getById));

router.post('/', authorize(...PAYROLL_PREPARE_ROLES), assign, asyncHandler(employeeCompensationController.assign));
router.put('/:id', authorize(...PAYROLL_PREPARE_ROLES), update, asyncHandler(employeeCompensationController.update));
router.delete('/:id', authorize(...PAYROLL_PREPARE_ROLES), byId, asyncHandler(employeeCompensationController.cancel));

module.exports = router;
