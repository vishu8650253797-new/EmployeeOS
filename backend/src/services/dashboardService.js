const { Types } = require('mongoose');
const { Employee, Department } = require('../models');

async function getDashboardStats(organizationId) {
  const orgId = new Types.ObjectId(organizationId);
  const baseQuery = { organizationId: orgId, isDeleted: { $ne: true } };

  const [totalEmployees, activeEmployees, inactiveEmployees, onLeave, totalDepartments] = await Promise.all([
    Employee.countDocuments(baseQuery),
    Employee.countDocuments({ ...baseQuery, status: 'ACTIVE' }),
    Employee.countDocuments({ ...baseQuery, status: 'INACTIVE' }),
    Employee.countDocuments({ ...baseQuery, status: 'ON_LEAVE' }),
    Department.countDocuments({ organizationId: orgId, isDeleted: { $ne: true } }),
  ]);

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    onLeave,
    totalDepartments,
  };
}

module.exports = { getDashboardStats };
