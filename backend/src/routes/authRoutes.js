const { Router } = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { registerValidator, loginValidator } = require('../validators/authValidator');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.post('/register', registerValidator, asyncHandler(authController.register));
router.post('/login', loginValidator, asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', authMiddleware, asyncHandler(authController.logout));
router.get('/me', authMiddleware, asyncHandler(authController.me));

module.exports = router;
