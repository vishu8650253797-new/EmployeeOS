const { Organization, User, Employee } = require('../../src/models');
const { signAccessToken } = require('../../src/utils/generateTokens');

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${counter}`;
}

async function createOrganization(overrides = {}) {
  return Organization.create({
    name: unique('Org-'),
    slug: unique('org-'),
    ...overrides,
  });
}

async function createUser(organizationId, overrides = {}) {
  const user = await User.create({
    organizationId,
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    email: overrides.email || `${unique('user')}@example.com`,
    password: overrides.password || 'Password123!',
    role: overrides.role || 'EMPLOYEE',
    status: overrides.status || 'active',
    employeeId: overrides.employeeId,
  });
  return user;
}

async function createEmployee(organizationId, overrides = {}) {
  const employee = await Employee.create({
    organizationId,
    employeeId: overrides.employeeId || unique('EMP-'),
    firstName: overrides.firstName || 'Emp',
    lastName: overrides.lastName || 'Loyee',
    email: overrides.email || `${unique('employee')}@example.com`,
    jobTitle: overrides.jobTitle || 'Engineer',
    joiningDate: overrides.joiningDate || new Date(),
    managerId: overrides.managerId,
    userId: overrides.userId,
    isDeleted: false,
  });
  return employee;
}

// Creates a user + linked employee record, and links the employee back to the user.
async function createUserWithEmployee(organizationId, overrides = {}) {
  const employee = await createEmployee(organizationId, overrides);
  const user = await createUser(organizationId, { ...overrides, employeeId: employee._id });
  employee.userId = user._id;
  await employee.save();
  return { user, employee };
}

function authHeaderFor(user) {
  const token = signAccessToken({ userId: user._id, role: user.role, organizationId: user.organizationId });
  return `Bearer ${token}`;
}

module.exports = {
  createOrganization,
  createUser,
  createEmployee,
  createUserWithEmployee,
  authHeaderFor,
};
