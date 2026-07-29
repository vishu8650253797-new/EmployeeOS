const { verifyAccessToken } = require('../utils/generateTokens');
const { User, Employee } = require('../models');

async function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
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
