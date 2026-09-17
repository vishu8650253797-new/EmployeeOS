const essAccess = require('../utils/essAccess');
const leaveTypeService = require('./leaveTypeService');
const leaveBalanceService = require('./leaveBalanceService');
const leaveRequestService = require('./leaveRequestService');
const auditLogService = require('./auditLogService');

// Thin ESS-facing layer over the existing leave module. No leave business
// logic (duration calculation, weekend/overlap handling, balance
// reservation, approval, notifications, socket emits) is reimplemented
// here — every function resolves the caller's own employee via
// essAccess.resolveSelfEmployee (never a client-supplied employeeId) and
// then delegates straight to leaveTypeService/leaveBalanceService/
// leaveRequestService, which already do all of that correctly.

async function getLeaveTypes(organizationId, user) {
  await essAccess.resolveSelfEmployee(user, organizationId);
  const { data } = await leaveTypeService.getLeaveTypes(organizationId, { status: 'ACTIVE', limit: 100 });
  return data;
}

async function getBalance(organizationId, user, year) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  return leaveBalanceService.getMyBalances(organizationId, employee._id, year);
}

async function getRequests(organizationId, user, filters = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  return leaveRequestService.getMyLeaveRequests(organizationId, employee._id, filters);
}

async function getRequestById(organizationId, user, id) {
  await essAccess.resolveSelfEmployee(user, organizationId);
  // getLeaveRequestById already enforces owner-or-elevated internally
  // (leaveRequestService.assertOwnerOrElevated) — a non-owner ESS caller
  // gets a 403 from that existing check, same as any other caller.
  return leaveRequestService.getLeaveRequestById(organizationId, id, user);
}

async function createRequest(organizationId, user, payload, reqMeta = {}) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);

  // The employeeId is always the resolved self id, never the client's —
  // createLeaveRequest's own assertOwnerOrElevated would also reject a
  // mismatched id, but overriding it here means a client-supplied
  // employeeId in the body is never even consulted, not merely rejected.
  const safePayload = {
    employeeId: employee._id.toString(),
    leaveTypeId: payload.leaveTypeId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    durationType: payload.durationType,
    reason: payload.reason,
  };

  const request = await leaveRequestService.createLeaveRequest(organizationId, safePayload, user);

  await auditLogService.recordAction({
    organizationId, userId: user._id, action: 'ESS_LEAVE_REQUEST_CREATED',
    entityType: 'LeaveRequest', entityId: request.id, metadata: { leaveTypeId: payload.leaveTypeId }, ...reqMeta,
  });

  return request;
}

async function cancelRequest(organizationId, user, id, reqMeta = {}) {
  await essAccess.resolveSelfEmployee(user, organizationId);
  // cancelLeaveRequest already enforces owner-or-elevated + the
  // pending/approved-only cancellation rule and restores balance
  // consistently with how approve/reject adjust it.
  const request = await leaveRequestService.cancelLeaveRequest(organizationId, id, user);

  await auditLogService.recordAction({
    organizationId, userId: user._id, action: 'ESS_LEAVE_REQUEST_CANCELLED',
    entityType: 'LeaveRequest', entityId: id, metadata: {}, ...reqMeta,
  });

  return request;
}

module.exports = { getLeaveTypes, getBalance, getRequests, getRequestById, createRequest, cancelRequest };
