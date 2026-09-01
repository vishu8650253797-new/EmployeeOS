const crypto = require('crypto');
const { Organization, User } = require('../models');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/generateTokens');
const { AppError } = require('../middleware/errorMiddleware');
const emailService = require('./emailService');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes, matches the frontend's messaging

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  delete obj.refreshToken;
  return obj;
}

async function register({ firstName, lastName, email, password, organizationName, role = 'SUPER_ADMIN', phone }) {
  const organization = await Organization.create({
    name: organizationName,
    slug: `${organizationName.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    status: 'active',
  });

  const user = await User.create({
    organizationId: organization._id,
    firstName,
    lastName,
    email,
    password,
    phone,
    role: role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'EMPLOYEE',
    department: 'Administration',
    jobTitle: role === 'SUPER_ADMIN' ? 'Super Admin' : 'Employee',
    status: 'active',
  });

  const accessToken = signAccessToken({ userId: user._id, role: user.role, organizationId: organization._id });
  const refreshToken = signRefreshToken({ userId: user._id });

  user.refreshToken = refreshToken;
  await user.save();

  return { user: sanitizeUser(user), accessToken, refreshToken, organization };
}

async function login({ email, password }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new AppError('Invalid credentials', 401);
  }
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.status !== 'active') {
    throw new AppError('Account is not active', 403);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  user.lastLogin = new Date();
  const accessToken = signAccessToken({ userId: user._id, role: user.role, organizationId: user.organizationId });
  const refreshToken = signRefreshToken({ userId: user._id });

  user.refreshToken = refreshToken;
  await user.save();

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new AppError('Refresh token required', 401);

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.userId).select('+password +refreshToken');
  if (!user || user.refreshToken !== refreshToken || user.status !== 'active') {
    throw new AppError('Refresh token not recognized', 401);
  }

  const newAccessToken = signAccessToken({
    userId: user._id,
    role: user.role,
    organizationId: user.organizationId,
  });
  const newRefreshToken = signRefreshToken({ userId: user._id });

  user.refreshToken = newRefreshToken;
  await user.save();

  return { user: sanitizeUser(user), accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout(userId) {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId).populate('organizationId', 'name slug status');
  if (!user) throw new AppError('User not found', 404);
  return sanitizeUser(user);
}

// Never reveals whether an email is registered — always resolves the same way
// so the endpoint can't be used to enumerate accounts.
async function forgotPassword(email, clientUrl) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (user && user.status === 'active') {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const resetUrl = `${clientUrl || process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    await emailService.sendPasswordResetEmail({ to: user.email, firstName: user.firstName, resetUrl });
  }
  return { success: true };
}

async function resetPassword(token, newPassword) {
  if (!token) throw new AppError('Reset token is required', 400);
  const user = await User.findOne({
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: new Date() },
  }).select('+password +resetPasswordToken +resetPasswordExpires');
  if (!user) throw new AppError('This reset link is invalid or has expired', 400);

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.refreshToken = null; // invalidate existing sessions
  await user.save();

  return { success: true };
}

module.exports = { register, login, refresh, logout, getCurrentUser, forgotPassword, resetPassword, sanitizeUser };
