const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const dashboardController = require('../controllers/dashboardController');

const router = Router();

router.get('/stats', authMiddleware, asyncHandler(dashboardController.getStats));

module.exports = router;
