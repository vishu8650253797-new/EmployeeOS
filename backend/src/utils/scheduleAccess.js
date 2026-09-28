// Shift definitions are org-wide configuration (who can define "Morning
// Shift" for the organization) — an HR/admin concern, not manager-scoped,
// mirroring how SalaryComponent/DocumentCategory (other org-config
// catalogs) are gated.
const SHIFT_ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

// Assigning a shift to a specific employee IS manager-scoped, though —
// mirrors the exact roles timesheetService.js's MANAGER_SCOPED_ROLES uses.
const SCHEDULE_MANAGER_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

function canManageShifts(role) {
  return SHIFT_ADMIN_ROLES.includes(role);
}

function canManageSchedules(role) {
  return SCHEDULE_MANAGER_ROLES.includes(role);
}

module.exports = { SHIFT_ADMIN_ROLES, SCHEDULE_MANAGER_ROLES, canManageShifts, canManageSchedules };
