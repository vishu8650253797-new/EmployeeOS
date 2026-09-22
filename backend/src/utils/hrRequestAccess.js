const HR_REQUEST_ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

function canManageHrRequests(role) {
  return HR_REQUEST_ADMIN_ROLES.includes(role);
}

module.exports = { HR_REQUEST_ADMIN_ROLES, canManageHrRequests };
