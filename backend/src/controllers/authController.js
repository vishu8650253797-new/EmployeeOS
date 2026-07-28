const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const { AppError } = require('../middleware/errorMiddleware');

const ACCESS_COOKIE_NAME = 'employeeos_access_token';
const REFRESH_COOKIE_NAME = 'employeeos_refresh_token';
const SESSION_COOKIE_NAME = 'employeeos_session';

const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};
const sessionCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

function handleValidationErrors(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    throw new AppError(message, 400);
  }
}

exports.register = async (req, res, next) => {
  try {
    handleValidationErrors(req);
    const { user, accessToken, refreshToken } = await authService.register(req.body);

    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.cookie(SESSION_COOKIE_NAME, '1', {
      ...sessionCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    handleValidationErrors(req);
    const { user, accessToken, refreshToken } = await authService.login(req.body);

    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie(SESSION_COOKIE_NAME, '1', {
      ...sessionCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Login successful',
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME] || req.body.refreshToken;
    const { user, accessToken, refreshToken: newRefreshToken } = await authService.refresh(refreshToken);

    res.cookie(ACCESS_COOKIE_NAME, accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie(SESSION_COOKIE_NAME, '1', { ...sessionCookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ success: true, user, accessToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
    const accessToken = req.cookies[ACCESS_COOKIE_NAME];

    if (req.user) {
      await authService.logout(req.user._id || req.user.id);
    }

    res.clearCookie(ACCESS_COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
    res.clearCookie(REFRESH_COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
    res.clearCookie(SESSION_COOKIE_NAME, { ...sessionCookieOptions, maxAge: 0 });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user._id || req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
