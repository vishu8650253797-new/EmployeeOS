const AppError = require('./AppError');

// Roles that can fully manage the asset lifecycle (create, assign, retire, etc).
const FULL_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];
// Roles that may browse the full organization-wide inventory (read-only for MANAGER).
const INVENTORY_VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN', 'MANAGER'];
// Roles that may approve/reject/fulfill asset requests.
const REQUEST_APPROVER_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];

function canManageAssets(role) {
  return FULL_ROLES.includes(role);
}

function canViewInventory(role) {
  return INVENTORY_VIEW_ROLES.includes(role);
}

function canApproveRequests(role) {
  return REQUEST_APPROVER_ROLES.includes(role);
}

// Verifies the acting user is either an elevated admin or the employee themselves
// (or their linked user account), guarding IDOR on "my assets" style endpoints.
function assertSelfOrElevated(user, employeeId) {
  if (canViewInventory(user.role)) return true;
  if (user.employeeId && employeeId && user.employeeId.toString() === employeeId.toString()) return true;
  throw new AppError('Forbidden: you do not have access to this employee\'s assets', 403);
}

module.exports = {
  FULL_ROLES,
  INVENTORY_VIEW_ROLES,
  REQUEST_APPROVER_ROLES,
  canManageAssets,
  canViewInventory,
  canApproveRequests,
  assertSelfOrElevated,
};
