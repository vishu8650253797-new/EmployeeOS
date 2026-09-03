const { verifyAccessToken } = require('../utils/generateTokens');
const { User, Employee, Organization } = require('../models');
const auditLogService = require('../services/auditLogService');
const { isRateLimited } = require('./socketRateLimit');

const MAX_HANDSHAKES_PER_WINDOW = 30;
const HANDSHAKE_WINDOW_MS = 60 * 1000;

// Best-effort, never blocks the (already-decided) auth outcome. Only called once
// we have enough trusted context (a real user/org) to attribute the event —
// a garbage/expired token has no organization to scope the log to, and is by
// far the noisiest case (every idle tab reconnect after 15 minutes), so it's
// deliberately not audited to avoid flooding the log with routine expiry.
async function auditAuthFailure(organizationId, userId, reason) {
  try {
    await auditLogService.recordAction({
      organizationId, userId, actorType: 'USER', action: 'SOCKET_AUTH_FAILURE',
      entityType: 'User', entityId: userId, metadata: { reason },
    });
  } catch (err) {
    console.error('[socket] failed to audit auth failure:', err);
  }
}

async function socketAuthMiddleware(socket, next) {
  try {
    const ip = socket.handshake.address || 'unknown';
    if (isRateLimited(`connect:${ip}`, MAX_HANDSHAKES_PER_WINDOW, HANDSHAKE_WINDOW_MS)) {
      return next(new Error('Too many connection attempts. Please try again shortly.'));
    }

    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      if (user) await auditAuthFailure(user.organizationId, user._id, 'user_inactive');
      return next(new Error('User not found or inactive'));
    }

    const organization = await Organization.findById(user.organizationId).select('status').lean();
    if (!organization || organization.status !== 'active') {
      await auditAuthFailure(user.organizationId, user._id, 'organization_inactive');
      return next(new Error('Organization not found or inactive'));
    }

    let employee = null;
    if (user.employeeId) {
      employee = await Employee.findById(user.employeeId).lean();
    } else {
      employee = await Employee.findOne({ userId: user._id }).lean();
    }

    socket.user = {
      id: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
      employeeId: employee ? employee._id.toString() : null,
      departmentId: employee ? (employee.departmentId ? employee.departmentId.toString() : null) : null,
    };

    next();
  } catch (error) {
    next(new Error('Invalid or expired token'));
  }
}

module.exports = { socketAuthMiddleware };
