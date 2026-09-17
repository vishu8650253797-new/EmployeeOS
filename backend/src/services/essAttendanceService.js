const essAccess = require('../utils/essAccess');
const attendanceService = require('./attendanceService');

// Thin ESS-facing layer over the existing attendance module — no summary
// math, timezone handling, or date-filter logic is reimplemented here.
// essAccess.resolveSelfEmployee gives ESS-consistent 404/403 semantics
// ("no employee mapping" / "inactive") before delegating to the existing,
// already self-scoped attendanceService functions.

async function getMyHistory(organizationId, user, query = {}) {
  await essAccess.resolveSelfEmployee(user, organizationId);
  return attendanceService.getMyHistory(user, query);
}

async function getMySummary(organizationId, user, query = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  return attendanceService.getEmployeeSummary(organizationId, employee._id, query, user);
}

async function getMyRecordById(organizationId, user, id) {
  await essAccess.resolveSelfEmployee(user, organizationId);
  // getAttendanceById already enforces self-or-HR/admin ownership internally.
  return attendanceService.getAttendanceById(organizationId, id, user);
}

module.exports = { getMyHistory, getMySummary, getMyRecordById };
