// Role configuration — will connect to backend RBAC later.
// Navigation and actions can be filtered by role permissions.

export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  HR_ADMIN: 'HR Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  FINANCE: 'Finance',
  IT_ADMIN: 'IT Admin',
};

export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'],
  [ROLES.HR_ADMIN]: [
    'employees:read', 'employees:write', 'employees:delete',
    'departments:read', 'departments:write', 'departments:delete',
    'attendance:read', 'attendance:write',
    'leave:read', 'leave:approve',
    'reports:read', 'documents:read', 'documents:write',
  ],
  [ROLES.MANAGER]: [
    'employees:read',
    'departments:read',
    'attendance:read',
    'leave:read', 'leave:approve',
    'tasks:read', 'tasks:write',
    'performance:read', 'performance:write',
  ],
  [ROLES.EMPLOYEE]: [
    'employees:read:self',
    'attendance:read:self',
    'leave:read:self', 'leave:request',
    'tasks:read:self',
    'documents:read:self',
  ],
  [ROLES.FINANCE]: [
    'employees:read',
    'payroll:read', 'payroll:write',
    'reports:read',
  ],
  [ROLES.IT_ADMIN]: [
    'employees:read',
    'documents:read', 'documents:write',
    'settings:read', 'settings:write',
  ],
};

export function hasPermission(role, permission) {
  const perms = PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}
