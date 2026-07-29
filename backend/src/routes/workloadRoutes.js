const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const workloadController = require('../controllers/workloadController');

const router = Router();

router.get('/', authMiddleware, authorize('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), asyncHandler(workloadController.getWorkload));
router.get('/my', authMiddleware, asyncHandler(workloadController.getMyWorkload));

module.exports = router;
