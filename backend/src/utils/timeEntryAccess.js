// Foundation-level RBAC scaffold for Time Tracking. Self-service ownership
// (an employee's own entries) is resolved via essAccess.resolveSelfEmployee,
// exactly like every other ESS module. Elevated access below is a scaffold
// only — no admin-side routes exist yet in Step 13A; Step 13B's manager
// review / correction workflow will consume this same constant rather than
// inventing its own role list.
const TIME_ENTRY_ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

function canManageTimeEntries(role) {
  return TIME_ENTRY_ADMIN_ROLES.includes(role);
}

module.exports = { TIME_ENTRY_ADMIN_ROLES, canManageTimeEntries };
