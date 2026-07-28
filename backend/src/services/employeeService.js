const { Types } = require('mongoose');
const { Employee, Department } = require('../models');
const AppError = require('../utils/AppError');

const DEFAULTS = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' };

function buildLocation(address = {}) {
  const { city, country } = address;
  if (city && country) return `${city}, ${country}`;
  return city || country || '';
}

function safeSort(sortBy) {
  const allowed = ['createdAt', 'firstName', 'lastName', 'employeeId', 'status', 'joiningDate', 'departmentId'];
  return allowed.includes(sortBy) ? sortBy : 'createdAt';
}

async function getNextEmployeeId(organizationId) {
  const existing = await Employee.find({
    organizationId,
    employeeId: /^EMP-\d{4}$/,
  })
    .select('employeeId')
    .lean();
  let max = 0;
  existing.forEach((e) => {
    const num = parseInt(e.employeeId.split('-')[1], 10);
    if (!Number.isNaN(num) && num > max) max = num;
  });
  return `EMP-${String(max + 1).padStart(4, '0')}`;
}

async function getEmployees(organizationId, filters = {}) {
  const { search, department, status, role, employmentType, sortBy, sortOrder, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || DEFAULTS.page, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULTS.limit, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId), isDeleted: { $ne: true } };

  if (department) {
    if (/^[0-9a-fA-F]{24}$/.test(department)) {
      query.departmentId = new Types.ObjectId(department);
    } else {
      const dept = await Department.findOne({
        organizationId: new Types.ObjectId(organizationId),
        name: new RegExp(`^${department}$`, 'i'),
        isDeleted: { $ne: true },
      }).lean();
      query.departmentId = dept ? dept._id : null;
    }
  }

  if (status) query.status = status;
  if (role) query.role = role;
  if (employmentType) query.employmentType = employmentType;

  if (search && search.trim()) {
    const q = new RegExp(search.trim(), 'i');
    query.$or = [
      { firstName: q },
      { lastName: q },
      { email: q },
      { employeeId: q },
      { jobTitle: q },
    ];
  }

  const sort = {};
  sort[safeSort(sortBy)] = sortOrder === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    Employee.find(query)
      .populate('departmentId', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Employee.countDocuments(query),
  ]);

  const employees = data.map((e) => ({
    ...e,
    id: e._id.toString(),
    department: e.departmentId ? e.departmentId.name : '',
    departmentId: e.departmentId ? e.departmentId._id.toString() : null,
  }));

  return {
    employees,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

async function getEmployeeById(organizationId, id) {
  const employee = await Employee.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
  })
    .populate('departmentId', 'name code')
    .lean();

  if (!employee) throw new AppError('Employee not found', 404);

  employee.id = employee._id.toString();
  employee.department = employee.departmentId ? employee.departmentId.name : '';
  employee.departmentId = employee.departmentId ? employee.departmentId._id.toString() : null;
  return employee;
}

async function validateDepartment(organizationId, departmentId) {
  if (!departmentId) return;
  const dept = await Department.findOne({
    _id: new Types.ObjectId(departmentId),
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
  });
  if (!dept) throw new AppError('Department not found or inactive', 400);
}

async function createEmployee(organizationId, payload) {
  await validateDepartment(organizationId, payload.departmentId);
  const employeeId = await getNextEmployeeId(organizationId);
  const location = buildLocation(payload.address);

  const employee = await Employee.create({
    organizationId: new Types.ObjectId(organizationId),
    employeeId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email.toLowerCase(),
    phone: payload.phone || '',
    avatar: payload.avatar || '',
    departmentId: payload.departmentId ? new Types.ObjectId(payload.departmentId) : undefined,
    jobTitle: payload.jobTitle,
    manager: payload.manager || '',
    managerId: payload.managerId ? new Types.ObjectId(payload.managerId) : undefined,
    role: payload.role || 'EMPLOYEE',
    employmentType: payload.employmentType || 'FULL_TIME',
    status: payload.status || 'ACTIVE',
    joiningDate: payload.joiningDate,
    dateOfBirth: payload.dateOfBirth || undefined,
    gender: payload.gender || undefined,
    address: payload.address || {},
    location,
    emergencyContact: payload.emergencyContact || {},
  });

  return getEmployeeById(organizationId, employee._id);
}

async function updateEmployee(organizationId, id, payload) {
  const existing = await Employee.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
  });
  if (!existing) throw new AppError('Employee not found', 404);

  await validateDepartment(organizationId, payload.departmentId);

  const updates = { ...payload, organizationId: new Types.ObjectId(organizationId) };
  delete updates.employeeId;
  delete updates._id;
  delete updates.id;
  if (updates.email) updates.email = updates.email.toLowerCase();
  if (updates.departmentId) updates.departmentId = new Types.ObjectId(updates.departmentId);
  if (updates.managerId) updates.managerId = new Types.ObjectId(updates.managerId);
  if (updates.address) updates.location = buildLocation(updates.address);
  else if (updates.location === undefined && existing.location) updates.location = existing.location;

  Object.assign(existing, updates);
  await existing.save();
  return getEmployeeById(organizationId, existing._id);
}

async function deleteEmployee(organizationId, id) {
  const employee = await Employee.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
  });
  if (!employee) throw new AppError('Employee not found', 404);

  employee.isDeleted = true;
  employee.status = 'INACTIVE';
  await employee.save();
  return { success: true, message: 'Employee removed successfully' };
}

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
