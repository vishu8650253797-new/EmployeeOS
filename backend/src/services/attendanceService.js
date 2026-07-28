const { Types } = require('mongoose');
const { Attendance, Employee, User, Organization } = require('../models');
const AppError = require('../utils/AppError');
const { broadcast } = require('../utils/socketServer');
const {
  getOrgDate,
  getOrgTimeInMinutes,
  timeStringToMinutes,
  getAttendanceSettings,
  formatMinutes,
  formatTime,
} = require('../utils/attendanceUtils');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const HR_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

async function resolveEmployee(user) {
  if (user.employeeId) {
    const emp = await Employee.findOne({
      _id: user.employeeId,
      organizationId: user.organizationId,
      isDeleted: { $ne: true },
      status: { $in: ['ACTIVE', 'ON_LEAVE'] },
    }).lean();
    if (emp) return emp;
  }
  return Employee.findOne({
    email: user.email,
    organizationId: user.organizationId,
    isDeleted: { $ne: true },
    status: { $in: ['ACTIVE', 'ON_LEAVE'] },
  }).lean();
}

function isAdminOrHr(role) {
  return HR_ROLES.includes(role);
}

function canViewEmployee(user, employee) {
  if (isAdminOrHr(user.role)) return true;
  if (user.employeeId && user.employeeId.toString() === employee._id.toString()) return true;
  return false;
}

async function populateRecord(recordId) {
  if (!recordId) return null;
  return Attendance.findById(recordId)
    .populate({
      path: 'employeeId',
      select: 'firstName lastName employeeId departmentId email',
      populate: { path: 'departmentId', select: 'name code' },
    })
    .lean();
}

function toAttendanceDTO(record, timeZone) {
  const emp = record.employeeId || {};
  const dept = emp.departmentId || {};
  return {
    ...record,
    id: record._id.toString(),
    employeeId: emp._id ? emp._id.toString() : null,
    employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
    employeeCode: emp.employeeId || '',
    employeeEmail: emp.email || '',
    department: dept.name || '—',
    departmentId: dept._id ? dept._id.toString() : null,
    date: record.date,
    checkInTime: formatTime(timeZone, record.checkIn),
    checkOutTime: formatTime(timeZone, record.checkOut),
    workingHours: formatMinutes(record.workingMinutes),
    workingMinutes: record.workingMinutes,
    late: formatMinutes(record.lateMinutes),
    lateMinutes: record.lateMinutes,
    earlyDeparture: formatMinutes(record.earlyDepartureMinutes),
    earlyDepartureMinutes: record.earlyDepartureMinutes,
    checkedIn: !!record.checkIn,
    checkedOut: !!record.checkOut,
  };
}

function buildPagination(total, page, limit) {
  return {
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

async function checkIn(user) {
  const settings = await getAttendanceSettings(user.organizationId);
  const now = new Date();
  const date = getOrgDate(settings.timeZone, now);

  const employee = await resolveEmployee(user);
  if (!employee) throw new AppError('Employee record not found or inactive', 400);

  const existing = await Attendance.findOne({
    organizationId: new Types.ObjectId(user.organizationId),
    employeeId: employee._id,
    date,
  });
  if (existing) throw new AppError('You have already checked in today.', 409);

  const checkInMinutes = getOrgTimeInMinutes(settings.timeZone, now);
  const startMinutes = timeStringToMinutes(settings.workStartTime);
  const lateMinutes = Math.max(0, checkInMinutes - startMinutes);
  const status = lateMinutes > settings.lateThresholdMinutes ? 'LATE' : 'PRESENT';

  const record = await Attendance.create({
    organizationId: new Types.ObjectId(user.organizationId),
    employeeId: employee._id,
    date,
    checkIn: now,
    status,
    lateMinutes,
    workingMinutes: 0,
    earlyDepartureMinutes: 0,
  });

  const result = toAttendanceDTO(await populateRecord(record._id), settings.timeZone);
  broadcast('attendance:updated', result);
  return result;
}

async function checkOut(user) {
  const settings = await getAttendanceSettings(user.organizationId);
  const now = new Date();
  const date = getOrgDate(settings.timeZone, now);

  const employee = await resolveEmployee(user);
  if (!employee) throw new AppError('Employee record not found or inactive', 400);

  const record = await Attendance.findOne({
    organizationId: new Types.ObjectId(user.organizationId),
    employeeId: employee._id,
    date,
  });
  if (!record) throw new AppError('You must check in before checking out.', 400);
  if (record.checkOut) throw new AppError('You have already checked out today.', 409);

  record.checkOut = now;
  const workingMinutes = Math.floor((now - record.checkIn) / (1000 * 60));
  record.workingMinutes = Math.max(0, workingMinutes);

  const checkInMinutes = getOrgTimeInMinutes(settings.timeZone, record.checkIn);
  const checkOutMinutes = getOrgTimeInMinutes(settings.timeZone, now);
  const startMinutes = timeStringToMinutes(settings.workStartTime);
  const endMinutes = timeStringToMinutes(settings.workEndTime);

  const lateMinutes = Math.max(0, checkInMinutes - startMinutes);
  const earlyDepartureMinutes = Math.max(0, endMinutes - checkOutMinutes);
  record.lateMinutes = lateMinutes;
  record.earlyDepartureMinutes = earlyDepartureMinutes;

  if (lateMinutes > settings.lateThresholdMinutes) {
    record.status = 'LATE';
  } else if (record.workingMinutes < settings.minimumWorkingMinutes) {
    record.status = 'HALF_DAY';
  } else {
    record.status = 'PRESENT';
  }

  await record.save();
  const result = toAttendanceDTO(await populateRecord(record._id), settings.timeZone);
  broadcast('attendance:updated', result);
  return result;
}

async function getTodayAttendance(user) {
  const settings = await getAttendanceSettings(user.organizationId);
  const today = getOrgDate(settings.timeZone);
  const organizationId = new Types.ObjectId(user.organizationId);

  if (isAdminOrHr(user.role)) {
    const records = await Attendance.find({ organizationId, date: today })
      .populate({
        path: 'employeeId',
        select: 'firstName lastName employeeId departmentId',
        populate: { path: 'departmentId', select: 'name' },
      })
      .lean();
    const totalEmployees = await Employee.countDocuments({
      organizationId,
      isDeleted: { $ne: true },
      status: { $in: ['ACTIVE', 'ON_LEAVE'] },
    });
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const onLeave = records.filter((r) => r.status === 'ON_LEAVE').length;
    const halfDay = records.filter((r) => r.status === 'HALF_DAY').length;
    const attendanceRate = totalEmployees
      ? Number(((present / totalEmployees) * 100).toFixed(2))
      : 0;
    return {
      date: today,
      totalEmployees,
      present,
      late,
      absent,
      onLeave,
      halfDay,
      attendanceRate,
      records: records.map((r) => toAttendanceDTO(r, settings.timeZone)),
    };
  }

  const employee = await resolveEmployee(user);
  if (!employee) throw new AppError('Employee record not found', 404);
  const record = await Attendance.findOne({
    organizationId,
    employeeId: employee._id,
    date: today,
  }).lean();

  if (!record) {
    return {
      checkedIn: false,
      checkedOut: false,
      checkIn: null,
      checkOut: null,
      workingMinutes: 0,
      workingHours: '0h 0m',
      status: null,
    };
  }

  return toAttendanceDTO(await populateRecord(record._id), settings.timeZone);
}

async function getMyHistory(user, query = {}) {
  const employee = await resolveEmployee(user);
  if (!employee) throw new AppError('Employee record not found', 404);

  const settings = await getAttendanceSettings(user.organizationId);
  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, month, year, startDate, endDate } = query;

  const filter = {
    organizationId: new Types.ObjectId(user.organizationId),
    employeeId: employee._id,
  };

  if (query.date) {
    filter.date = query.date;
  } else if (startDate && endDate) {
    filter.date = { $gte: startDate, $lte: endDate };
  } else if (month && year) {
    const monthStr = String(month).padStart(2, '0');
    filter.date = { $regex: `^${year}-${monthStr}` };
  }

  const pageNum = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Attendance.countDocuments(filter),
  ]);

  const populated = await Promise.all(records.map((r) => populateRecord(r._id)));
  return {
    records: populated.map((r) => toAttendanceDTO(r, settings.timeZone)),
    pagination: buildPagination(total, pageNum, limitNum),
  };
}

async function getAttendance(organizationId, query = {}) {
  const settings = await getAttendanceSettings(organizationId);
  const {
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
    date,
    startDate,
    endDate,
    employeeId,
    departmentId,
    status,
    search,
    sortBy = 'date',
    sortOrder = 'desc',
  } = query;

  const filter = { organizationId: new Types.ObjectId(organizationId) };
  if (date) filter.date = date;
  else if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };
  if (employeeId) filter.employeeId = new Types.ObjectId(employeeId);
  if (status && ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'].includes(status)) {
    filter.status = status;
  }

  const employeeFilter = { organizationId: new Types.ObjectId(organizationId), isDeleted: { $ne: true } };
  if (departmentId) employeeFilter.departmentId = new Types.ObjectId(departmentId);

  let employeeIds = [];
  let employeeMap = new Map();

  if (employeeId) {
    const emp = await Employee.findOne({ _id: employeeId, ...employeeFilter }).lean();
    if (!emp) throw new AppError('Employee not found', 404);
    employeeIds = [emp._id];
    employeeMap.set(emp._id.toString(), emp);
  } else if (search || departmentId) {
    if (search) {
      const q = new RegExp(search.trim(), 'i');
      employeeFilter.$or = [
        { firstName: q },
        { lastName: q },
        { email: q },
        { employeeId: q },
      ];
    }
    const employees = await Employee.find(employeeFilter).lean();
    employeeIds = employees.map((e) => e._id);
    employees.forEach((e) => employeeMap.set(e._id.toString(), e));
    if (employeeIds.length === 0) {
      return { records: [], pagination: buildPagination(0, page, limit) };
    }
    filter.employeeId = { $in: employeeIds };
  }

  const safeSortBy = ['date', 'createdAt', 'status'].includes(sortBy) ? sortBy : 'date';
  const sort = { [safeSortBy]: sortOrder === 'asc' ? 1 : -1 };

  const pageNum = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [records, total] = await Promise.all([
    Attendance.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    Attendance.countDocuments(filter),
  ]);

  const populated = await Promise.all(records.map((r) => populateRecord(r._id)));
  const dtoRecords = populated.map((r) => toAttendanceDTO(r, settings.timeZone));

  if ((search || departmentId) && employeeMap.size > 0) {
    const filtered = dtoRecords.filter((r) => {
      if (search) {
        const searchLower = search.trim().toLowerCase();
        const text = `${r.employeeName} ${r.employeeCode} ${r.employeeEmail}`.toLowerCase();
        return text.includes(searchLower);
      }
      return true;
    });
    const start = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(start, start + limitNum);
    return { records: paginated, pagination: buildPagination(filtered.length, pageNum, limitNum) };
  }

  return { records: dtoRecords, pagination: buildPagination(total, pageNum, limitNum) };
}

async function getAttendanceById(organizationId, id, user) {
  const settings = await getAttendanceSettings(organizationId);
  const record = await Attendance.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  })
    .populate({
      path: 'employeeId',
      select: 'firstName lastName employeeId departmentId email',
      populate: { path: 'departmentId', select: 'name' },
    })
    .lean();

  if (!record) throw new AppError('Attendance record not found', 404);
  const employee = record.employeeId || {};
  if (!isAdminOrHr(user.role) && user.employeeId && user.employeeId.toString() !== employee._id?.toString()) {
    throw new AppError('You are not authorized to view this attendance data', 403);
  }
  return toAttendanceDTO(record, settings.timeZone);
}

async function getEmployeeAttendance(organizationId, employeeId, query = {}, user) {
  const settings = await getAttendanceSettings(organizationId);
  const organizationIdObj = new Types.ObjectId(organizationId);

  const employee = await Employee.findOne({ _id: employeeId, organizationId: organizationIdObj }).lean();
  if (!employee) throw new AppError('Employee not found', 404);
  if (!canViewEmployee(user, employee)) throw new AppError('You are not authorized to view this attendance data', 403);

  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, date, startDate, endDate, status } = query;
  const filter = { organizationId: organizationIdObj, employeeId: employee._id };
  if (date) filter.date = date;
  else if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };
  if (status) filter.status = status;

  const pageNum = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [records, total] = await Promise.all([
    Attendance.find(filter).sort({ date: -1 }).skip(skip).limit(limitNum).lean(),
    Attendance.countDocuments(filter),
  ]);

  const populated = await Promise.all(records.map((r) => populateRecord(r._id)));
  return { records: populated.map((r) => toAttendanceDTO(r, settings.timeZone)), pagination: buildPagination(total, pageNum, limitNum) };
}

async function getDepartmentAttendance(organizationId, departmentId, query = {}) {
  const settings = await getAttendanceSettings(organizationId);
  const organizationIdObj = new Types.ObjectId(organizationId);
  const employees = await Employee.find({ organizationId: organizationIdObj, departmentId: new Types.ObjectId(departmentId) })
    .select('_id')
    .lean();
  const employeeIds = employees.map((e) => e._id);
  if (employeeIds.length === 0) {
    return { records: [], pagination: buildPagination(0, query.page || DEFAULT_PAGE, query.limit || DEFAULT_LIMIT) };
  }

  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, date, startDate, endDate, status } = query;
  const filter = { organizationId: organizationIdObj, employeeId: { $in: employeeIds } };
  if (date) filter.date = date;
  else if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };
  if (status) filter.status = status;

  const pageNum = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [records, total] = await Promise.all([
    Attendance.find(filter).sort({ date: -1 }).skip(skip).limit(limitNum).lean(),
    Attendance.countDocuments(filter),
  ]);

  const populated = await Promise.all(records.map((r) => populateRecord(r._id)));
  return { records: populated.map((r) => toAttendanceDTO(r, settings.timeZone)), pagination: buildPagination(total, pageNum, limitNum) };
}

async function getAttendanceStats(organizationId, query = {}) {
  const settings = await getAttendanceSettings(organizationId);
  const organizationIdObj = new Types.ObjectId(organizationId);
  const date = query.date || getOrgDate(settings.timeZone);

  const [records, totalEmployees] = await Promise.all([
    Attendance.find({ organizationId: organizationIdObj, date }).lean(),
    Employee.countDocuments({
      organizationId: organizationIdObj,
      isDeleted: { $ne: true },
      status: { $in: ['ACTIVE', 'ON_LEAVE'] },
    }),
  ]);

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const onLeave = records.filter((r) => r.status === 'ON_LEAVE').length;
  const halfDay = records.filter((r) => r.status === 'HALF_DAY').length;
  const attendanceRate = totalEmployees ? Number(((present / totalEmployees) * 100).toFixed(2)) : 0;

  return {
    date,
    totalEmployees,
    present,
    late,
    absent,
    onLeave,
    halfDay,
    attendanceRate,
    unmarked: Math.max(0, totalEmployees - (present + late + absent + onLeave + halfDay)),
  };
}

async function getDepartmentStats(organizationId, departmentId, query = {}) {
  const settings = await getAttendanceSettings(organizationId);
  const organizationIdObj = new Types.ObjectId(organizationId);
  const date = query.date || getOrgDate(settings.timeZone);

  const [employees, records] = await Promise.all([
    Employee.find({ organizationId: organizationIdObj, departmentId: new Types.ObjectId(departmentId) }).lean(),
    Attendance.find({ organizationId: organizationIdObj, date }).populate('employeeId', 'departmentId').lean(),
  ]);

  const employeeIds = new Set(employees.map((e) => e._id.toString()));
  const deptRecords = records.filter((r) => employeeIds.has(r.employeeId?._id?.toString() || r.employeeId?.toString()));
  const totalEmployees = employees.length;
  const present = deptRecords.filter((r) => r.status === 'PRESENT').length;
  const late = deptRecords.filter((r) => r.status === 'LATE').length;
  const absent = deptRecords.filter((r) => r.status === 'ABSENT').length;
  const onLeave = deptRecords.filter((r) => r.status === 'ON_LEAVE').length;
  const halfDay = deptRecords.filter((r) => r.status === 'HALF_DAY').length;
  const attendanceRate = totalEmployees ? Number(((present / totalEmployees) * 100).toFixed(2)) : 0;

  return {
    date,
    totalEmployees,
    present,
    late,
    absent,
    onLeave,
    halfDay,
    attendanceRate,
    unmarked: Math.max(0, totalEmployees - (present + late + absent + onLeave + halfDay)),
  };
}

async function getEmployeeSummary(organizationId, employeeId, query = {}) {
  const settings = await getAttendanceSettings(organizationId);
  const organizationIdObj = new Types.ObjectId(organizationId);
  const employee = await Employee.findOne({ _id: employeeId, organizationId: organizationIdObj }).lean();
  if (!employee) throw new AppError('Employee not found', 404);

  const { startDate, endDate } = query;
  const filter = { organizationId: organizationIdObj, employeeId: employee._id };
  if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };

  const records = await Attendance.find(filter).lean();
  const totalDays = records.length;
  const present = records.filter((r) => r.status === 'PRESENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const onLeave = records.filter((r) => r.status === 'ON_LEAVE').length;
  const halfDay = records.filter((r) => r.status === 'HALF_DAY').length;
  const totalWorkingMinutes = records.reduce((sum, r) => sum + (r.workingMinutes || 0), 0);
  const averageWorkingMinutes = totalDays ? Math.round(totalWorkingMinutes / totalDays) : 0;
  const attendanceRate = totalDays ? Number(((present / totalDays) * 100).toFixed(2)) : 0;

  return {
    employeeId,
    employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    totalDays,
    present,
    late,
    absent,
    onLeave,
    halfDay,
    totalWorkingMinutes,
    averageWorkingMinutes,
    averageWorkingHours: formatMinutes(averageWorkingMinutes),
    attendanceRate,
  };
}

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMyHistory,
  getAttendance,
  getAttendanceById,
  getEmployeeAttendance,
  getDepartmentAttendance,
  getAttendanceStats,
  getDepartmentStats,
  getEmployeeSummary,
};
