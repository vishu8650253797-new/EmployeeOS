const { Router } = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator } = require('../validators/authValidator');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.post('/register', registerValidator, asyncHandler(authController.register));
router.post('/login', loginValidator, asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', authMiddleware, asyncHandler(authController.logout));
router.get('/me', authMiddleware, asyncHandler(authController.me));
router.post('/forgot-password', forgotPasswordValidator, asyncHandler(authController.forgotPassword));
router.post('/reset-password', resetPasswordValidator, asyncHandler(authController.resetPassword));

module.exports = router;
