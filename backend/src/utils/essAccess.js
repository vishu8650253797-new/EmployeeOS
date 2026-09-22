const { Types } = require('mongoose');
const { Employee } = require('../models');
const AppError = require('./AppError');

// Employee Self-Service (ESS) foundation — identity resolution and ownership
// boundary shared by every future ESS endpoint. This is intentionally the
// one place that resolves "the calling user's own employee record" with full
// validation (org + isDeleted + status); existing modules each inline their
// own lighter-weight version of this (see leaveRequestController.js,
// documentController.js, attendanceService.js) and are left untouched here —
// this file exists so new ESS code doesn't add yet another copy.

// Capability identifiers for future ESS modules. Availability is computed
// here, server-side, so the frontend never has to hard-code what a user can
// do — it only renders whatever this returns.
const ESS_CAPABILITIES = [
  { key: 'profile', label: 'My Profile' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'documents', label: 'Documents' },
  { key: 'requests', label: 'HR Requests' },
  { key: 'notifications', label: 'Notifications' },
];

// Capabilities not backed by a real module yet — shown as "coming soon"
// rather than silently omitted, so the shell can render a placeholder card.
const NOT_YET_IMPLEMENTED = [];

// Capabilities that stay available even when the employee's account is
// under a restriction (e.g. suspended) — viewing your own identity and
// notifications should never itself be blocked.
const ALWAYS_AVAILABLE = ['profile', 'notifications'];

// An INACTIVE employee (e.g. fully offboarded) has no self-service access at
// all — resolveSelfEmployee rejects before this is ever reached. SUSPENDED
// employees still resolve, but see everything else as "restricted".
function computeCapabilities(employee) {
  const isRestricted = employee.status === 'SUSPENDED';
  return ESS_CAPABILITIES.reduce((acc, cap) => {
    let status = 'available';
    if (NOT_YET_IMPLEMENTED.includes(cap.key)) status = 'coming_soon';
    else if (isRestricted && !ALWAYS_AVAILABLE.includes(cap.key)) status = 'restricted';
    acc[cap.key] = { label: cap.label, status };
    return acc;
  }, {});
}

// The authenticated session is the only source of truth for "who am I" —
// never a client-supplied employeeId. `user` is the full Mongoose User doc
// authMiddleware already attached to req.user; `organizationId` is
// req.organizationId (also derived from that same session, never from the
// client). Pass `{ lean: false }` when the caller needs a live Mongoose
// document to mutate (e.g. inside a transaction) rather than a plain object.
async function resolveSelfEmployee(user, organizationId, { lean = true } = {}) {
  if (!user.employeeId) {
    throw new AppError('No employee record is linked to your account', 404);
  }

  let query = Employee.findOne({
    _id: user.employeeId,
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: false,
  });
  if (lean) query = query.lean();
  const employee = await query;

  if (!employee) {
    throw new AppError('No employee record is linked to your account', 404);
  }
  if (employee.status === 'INACTIVE') {
    throw new AppError('Your employee record is inactive', 403);
  }

  return employee;
}

// Generic ownership guard for future ESS endpoints that take a resource's
// employeeId (e.g. a leave request, a document) — reusable across ESS
// features instead of each one reimplementing its own self-vs-other check.
function assertIsSelf(user, employeeId) {
  if (user.employeeId && employeeId && user.employeeId.toString() === employeeId.toString()) return true;
  throw new AppError('Forbidden: you can only access your own self-service data', 403);
}

module.exports = {
  ESS_CAPABILITIES,
  computeCapabilities,
  resolveSelfEmployee,
  assertIsSelf,
};
