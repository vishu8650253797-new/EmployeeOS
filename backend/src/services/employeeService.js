const { Types } = require('mongoose');
const { Employee, Department } = require('../models');
const AppError = require('../utils/AppError');
const { withTransaction } = require('../utils/withTransaction');
const auditLogService = require('./auditLogService');
const storageService = require('./storage');
const { getExtension, matchesFileSignature, EXTENSION_MIME_MAP } = require('../utils/fileValidation');
const { disconnectUserSockets } = require('../socket/socketServer');

const DEACTIVATED_STATUSES = ['INACTIVE', 'SUSPENDED'];

const DEFAULTS = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' };
const ELEVATED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];
const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png'];

function assertSelfOrHR(actor, employeeId) {
  if (ELEVATED_ROLES.includes(actor.role)) return;
  if (actor.employeeId && actor.employeeId.toString() === employeeId.toString()) return;
  throw new AppError('You are not authorized to access this employee record', 403);
}

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

  const previousStatus = existing.status;
  Object.assign(existing, updates);
  await existing.save();

  // The real-time channel must not keep granting access on a stale session once
  // an employee is suspended/deactivated — cut their live socket(s) immediately
  // rather than waiting for the access token to expire naturally.
  if (existing.userId && DEACTIVATED_STATUSES.includes(existing.status) && existing.status !== previousStatus) {
    disconnectUserSockets(existing.userId, 'Your account has been deactivated.');
  }

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

  if (employee.userId) {
    disconnectUserSockets(employee.userId, 'Your account has been deactivated.');
  }

  return { success: true, message: 'Employee removed successfully' };
}

async function findActiveEmployee(organizationId, id, selectFields) {
  const query = Employee.findOne({
    _id: id,
    organizationId: new Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
  });
  if (selectFields) query.select(selectFields);
  const employee = await query;
  if (!employee) throw new AppError('Employee not found', 404);
  return employee;
}

async function getBankDetails(organizationId, id, actor) {
  assertSelfOrHR(actor, id);
  const employee = await findActiveEmployee(organizationId, id, '+bankDetails.accountNumber');
  return employee.bankDetails || {};
}

async function updateBankDetails(organizationId, id, payload, actor, reqMeta = {}) {
  assertSelfOrHR(actor, id);
  const employee = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const emp = await Employee.findOne(
      { _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: { $ne: true } },
      null,
      opts
    );
    if (!emp) throw new AppError('Employee not found', 404);

    const fields = ['accountHolderName', 'accountNumber', 'bankName', 'branchName', 'routingCode', 'currency'];
    fields.forEach((f) => {
      if (payload[f] !== undefined) emp.bankDetails[f] = payload[f];
    });
    emp.bankDetails.updatedAt = new Date();
    emp.bankDetails.updatedBy = actor._id;
    await emp.save(opts);

    await auditLogService.recordAction({
      organizationId, userId: actor._id, action: 'EMPLOYEE_BANK_DETAILS_UPDATED',
      entityType: 'Employee', entityId: emp._id,
      metadata: { fieldsChanged: fields.filter((f) => payload[f] !== undefined) },
      session, ...reqMeta,
    });
    return emp;
  });
  return getBankDetails(organizationId, employee._id, actor);
}

async function getTaxInfo(organizationId, id, actor) {
  assertSelfOrHR(actor, id);
  const employee = await findActiveEmployee(organizationId, id, '+taxInfo.taxId');
  return employee.taxInfo || {};
}

async function updateTaxInfo(organizationId, id, payload, actor, reqMeta = {}) {
  assertSelfOrHR(actor, id);
  const employee = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const emp = await Employee.findOne(
      { _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: { $ne: true } },
      null,
      opts
    );
    if (!emp) throw new AppError('Employee not found', 404);

    const fields = ['taxId', 'taxRegime', 'taxCountry'];
    fields.forEach((f) => {
      if (payload[f] !== undefined) emp.taxInfo[f] = payload[f];
    });
    emp.taxInfo.updatedAt = new Date();
    emp.taxInfo.updatedBy = actor._id;
    await emp.save(opts);

    await auditLogService.recordAction({
      organizationId, userId: actor._id, action: 'EMPLOYEE_TAX_INFO_UPDATED',
      entityType: 'Employee', entityId: emp._id,
      metadata: { fieldsChanged: fields.filter((f) => payload[f] !== undefined) },
      session, ...reqMeta,
    });
    return emp;
  });
  return getTaxInfo(organizationId, employee._id, actor);
}

async function updatePhoto(organizationId, id, file, actor, reqMeta = {}) {
  assertSelfOrHR(actor, id);
  if (!file) throw new AppError('A photo file is required', 400);

  const extension = getExtension(file.originalname);
  if (!extension || !AVATAR_EXTENSIONS.includes(extension)) {
    throw new AppError('Profile photo must be a JPG or PNG image', 400);
  }
  const expectedMimeTypes = EXTENSION_MIME_MAP[extension];
  if (!expectedMimeTypes || !expectedMimeTypes.includes(file.mimetype)) {
    throw new AppError('File content type does not match its extension', 400);
  }
  if (!matchesFileSignature(file.buffer, extension)) {
    throw new AppError('File content does not match its declared type', 400);
  }

  const previous = await findActiveEmployee(organizationId, id, '+avatarStorageKey');
  const previousStorageKey = previous.avatarStorageKey;

  const { storageKey } = await storageService.uploadAvatar({
    buffer: file.buffer, organizationId, employeeId: id, extension,
  });

  const employee = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const emp = await Employee.findOne(
      { _id: id, organizationId: new Types.ObjectId(organizationId), isDeleted: { $ne: true } },
      null,
      opts
    );
    if (!emp) throw new AppError('Employee not found', 404);

    emp.avatarStorageKey = storageKey;
    emp.avatarMimeType = file.mimetype;
    emp.avatar = `/api/employees/${id}/photo`;
    await emp.save(opts);

    await auditLogService.recordAction({
      organizationId, userId: actor._id, action: 'EMPLOYEE_PHOTO_UPDATED',
      entityType: 'Employee', entityId: emp._id,
      metadata: { fileSize: file.size, mimeType: file.mimetype },
      session, ...reqMeta,
    });
    return emp;
  });

  if (previousStorageKey && previousStorageKey !== storageKey) {
    try {
      await storageService.deleteFile(previousStorageKey);
    } catch (err) {
      console.error('[employee] failed to delete previous avatar:', err.message);
    }
  }

  return getEmployeeById(organizationId, employee._id);
}

async function getPhoto(organizationId, id, actor) {
  assertSelfOrHR(actor, id);
  const employee = await findActiveEmployee(organizationId, id, '+avatarStorageKey +avatarMimeType');
  if (!employee.avatarStorageKey) throw new AppError('No profile photo uploaded for this employee', 404);

  const { stream, size } = await storageService.getFileStream(employee.avatarStorageKey);
  return {
    stream,
    size,
    mimeType: employee.avatarMimeType || 'application/octet-stream',
    filename: `${employee.firstName}-${employee.lastName}-photo`.replace(/\s+/g, '-'),
  };
}

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getBankDetails,
  updateBankDetails,
  getTaxInfo,
  updateTaxInfo,
  updatePhoto,
  getPhoto,
};
