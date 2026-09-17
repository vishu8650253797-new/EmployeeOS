const { Organization } = require('../models');
const essAccess = require('../utils/essAccess');
const auditLogService = require('./auditLogService');

// Best-effort — a logging failure must never mask the real auth/lookup error.
async function recordAccessDenied(organizationId, userId, action, reason, reqMeta) {
  try {
    await auditLogService.recordAction({
      organizationId, userId, action, entityType: 'User', entityId: userId, metadata: { reason }, ...reqMeta,
    });
  } catch (err) {
    console.error('[ess] audit logging failed:', err);
  }
}

// Returns the minimum safe self-service context for the calling user: no
// tokens, no sensitive financial data, no other employee's information —
// just enough for the ESS shell to render a welcome state and know which
// capabilities are available. Routine successful reads are intentionally
// NOT audited (matching the existing codebase convention of auditing
// mutations and sensitive file access, not plain list/summary reads) — only
// the two failure paths below are, since those represent an access-mapping
// problem worth tracking.
async function getMyContext(organizationId, user, reqMeta = {}) {
  let employee;
  try {
    employee = await essAccess.resolveSelfEmployee(user, organizationId);
  } catch (err) {
    const action = err.statusCode === 404 ? 'ESS_ACCESS_DENIED_NO_MAPPING' : 'ESS_ACCESS_DENIED_INACTIVE_EMPLOYEE';
    await recordAccessDenied(organizationId, user._id, action, err.message, reqMeta);
    throw err;
  }

  const organization = await Organization.findById(organizationId).select('name').lean();

  return {
    employeeId: employee._id.toString(),
    userId: user._id.toString(),
    displayName: `${employee.firstName} ${employee.lastName}`.trim(),
    jobTitle: employee.jobTitle,
    employeeStatus: employee.status,
    accountStatus: user.status,
    role: user.role,
    organizationName: organization?.name || null,
    capabilities: essAccess.computeCapabilities(employee),
  };
}

module.exports = { getMyContext };
