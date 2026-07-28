const { Types } = require('mongoose');
const { Department, Employee } = require('../models');
const AppError = require('../utils/AppError');

async function getEmployeeCounts(organizationId, departmentIds) {
  if (departmentIds.length === 0) return {};
  const counts = await Employee.aggregate([
    {
      $match: {
        organizationId: new Types.ObjectId(organizationId),
        departmentId: { $in: departmentIds.map((id) => new Types.ObjectId(id)) },
        isDeleted: { $ne: true },
      },
    },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
  ]);
  return counts.reduce((acc, cur) => {
    acc[cur._id.toString()] = cur.count;
    return acc;
  }, {});
}

async function getDepartments(organizationId, { search } = {}) {
  const query = { organizationId: new Types.ObjectId(organizationId), isDeleted: { $ne: true } };
  if (search && search.trim()) {
    const q = new RegExp(search.trim(), 'i');
    query.$or = [{ name: q }, { code: q }];
  }

  const departments = await Department.find(query)
    .populate('headId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .lean();

  const counts = await getEmployeeCounts(
    organizationId,
    departments.map((d) => d._id.toString())
  );

  return departments.map((d) => {
    const populatedHead = d.headId && d.headId.firstName ? d.headId : null;
    return {
      ...d,
      id: d._id.toString(),
      headId: populatedHead ? populatedHead._id.toString() : null,
      head: populatedHead ? `${populatedHead.firstName} ${populatedHead.lastName}` : '',
      employeeCount: counts[d._id.toString()] || 0,
    };
  });
}

async function getDepartmentById(organizationId, id) {
  const department = await Department.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
  })
    .populate('headId', 'firstName lastName')
    .lean();

  if (!department) throw new AppError('Department not found', 404);

  const populatedHead = department.headId && department.headId.firstName ? department.headId : null;
  department.id = department._id.toString();
  department.headId = populatedHead ? populatedHead._id.toString() : null;
  department.head = populatedHead ? `${populatedHead.firstName} ${populatedHead.lastName}` : '';
  department.employeeCount = await Employee.countDocuments({
    organizationId: new Types.ObjectId(organizationId),
    departmentId: new Types.ObjectId(id),
    isDeleted: { $ne: true },
  });

  return department;
}

async function createDepartment(organizationId, payload) {
  const department = await Department.create({
    organizationId: new Types.ObjectId(organizationId),
    name: payload.name,
    code: payload.code,
    headId: payload.headId ? new Types.ObjectId(payload.headId) : undefined,
    description: payload.description || '',
    status: payload.status || 'ACTIVE',
  });
  return getDepartmentById(organizationId, department._id);
}

async function updateDepartment(organizationId, id, payload) {
  const existing = await Department.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
  });
  if (!existing) throw new AppError('Department not found', 404);

  const updates = { ...payload, organizationId: new Types.ObjectId(organizationId) };
  delete updates._id;
  delete updates.id;
  if (updates.headId) updates.headId = new Types.ObjectId(updates.headId);

  Object.assign(existing, updates);
  await existing.save();
  return getDepartmentById(organizationId, existing._id);
}

async function deleteDepartment(organizationId, id) {
  const count = await Employee.countDocuments({
    organizationId: new Types.ObjectId(organizationId),
    departmentId: new Types.ObjectId(id),
    isDeleted: { $ne: true },
  });
  if (count > 0) {
    throw new AppError(
      'Department has assigned employees. Please reassign them before deleting.',
      409
    );
  }

  const department = await Department.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
  });
  if (!department) throw new AppError('Department not found', 404);

  department.isDeleted = true;
  department.status = 'INACTIVE';
  await department.save();
  return { success: true, message: 'Department removed successfully' };
}

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
