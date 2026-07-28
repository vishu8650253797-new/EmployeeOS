const attendanceService = require('../services/attendanceService');
const AppError = require('../utils/AppError');

exports.checkIn = async (req, res) => {
  const record = await attendanceService.checkIn(req.user);
  res.status(201).json({ success: true, message: 'Checked in successfully', data: record });
};

exports.checkOut = async (req, res) => {
  const record = await attendanceService.checkOut(req.user);
  res.status(200).json({ success: true, message: 'Checked out successfully', data: record });
};

exports.getTodayAttendance = async (req, res) => {
  const data = await attendanceService.getTodayAttendance(req.user);
  res.status(200).json({ success: true, message: 'Today attendance retrieved successfully', data });
};

exports.getMyHistory = async (req, res) => {
  const data = await attendanceService.getMyHistory(req.user, req.query);
  res.status(200).json({ success: true, message: 'Attendance history retrieved successfully', data });
};

exports.getAttendance = async (req, res) => {
  const data = await attendanceService.getAttendance(req.organizationId, req.query);
  res.status(200).json({ success: true, message: 'Attendance records retrieved successfully', data });
};

exports.getAttendanceById = async (req, res) => {
  const data = await attendanceService.getAttendanceById(req.organizationId, req.params.id, req.user);
  res.status(200).json({ success: true, message: 'Attendance record retrieved successfully', data });
};

exports.getEmployeeAttendance = async (req, res) => {
  const data = await attendanceService.getEmployeeAttendance(
    req.organizationId,
    req.params.employeeId,
    req.query,
    req.user
  );
  res.status(200).json({ success: true, message: 'Employee attendance retrieved successfully', data });
};

exports.getDepartmentAttendance = async (req, res) => {
  const data = await attendanceService.getDepartmentAttendance(
    req.organizationId,
    req.params.departmentId,
    req.query
  );
  res.status(200).json({ success: true, message: 'Department attendance retrieved successfully', data });
};

exports.getAttendanceStats = async (req, res) => {
  const data = await attendanceService.getAttendanceStats(req.organizationId, req.query);
  res.status(200).json({ success: true, message: 'Attendance statistics retrieved successfully', data });
};

exports.getDepartmentStats = async (req, res) => {
  const data = await attendanceService.getDepartmentStats(
    req.organizationId,
    req.params.departmentId,
    req.query
  );
  res.status(200).json({ success: true, message: 'Department statistics retrieved successfully', data });
};

exports.getEmployeeSummary = async (req, res) => {
  const data = await attendanceService.getEmployeeSummary(
    req.organizationId,
    req.params.employeeId,
    req.query
  );
  res.status(200).json({ success: true, message: 'Employee summary retrieved successfully', data });
};
