const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const kpiController = require('../controllers/kpiController');

const router = Router();

router.get('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(kpiController.getKPIs));
router.get('/employee/:employeeId', authMiddleware, asyncHandler(kpiController.getEmployeeKPIs));
router.get('/cycle/:cycleId', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(kpiController.getCycleKPIs));
router.get('/:id', authMiddleware, asyncHandler(kpiController.getKPIById));
router.post('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(kpiController.createKPI));
router.put('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(kpiController.updateKPI));
router.delete('/:id', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(kpiController.deleteKPI));
router.put('/:id/value', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(kpiController.updateKPIValue));

module.exports = router;
