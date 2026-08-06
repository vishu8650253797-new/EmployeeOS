const employeeService = require('../services/employeeService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

function streamFile(res, { stream, size, filename, mimeType }, disposition) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', size);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

exports.getEmployees = async (req, res) => {
  const { employees, pagination } = await employeeService.getEmployees(req.organizationId, req.query);
  res.json({ success: true, data: employees, pagination });
};

exports.getEmployeeById = async (req, res) => {
  const employee = await employeeService.getEmployeeById(req.organizationId, req.params.id);
  res.json({ success: true, data: employee });
};

exports.createEmployee = async (req, res) => {
  const employee = await employeeService.createEmployee(req.organizationId, req.body);
  res.status(201).json({
    success: true,
    message: 'Employee created successfully',
    data: employee,
  });
};

exports.updateEmployee = async (req, res) => {
  const employee = await employeeService.updateEmployee(req.organizationId, req.params.id, req.body);
  res.json({
    success: true,
    message: 'Employee updated successfully',
    data: employee,
  });
};

exports.deleteEmployee = async (req, res) => {
  const result = await employeeService.deleteEmployee(req.organizationId, req.params.id);
  res.json(result);
};

exports.getBankDetails = async (req, res) => {
  const data = await employeeService.getBankDetails(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.updateBankDetails = async (req, res) => {
  const data = await employeeService.updateBankDetails(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Bank details updated', data });
};

exports.getTaxInfo = async (req, res) => {
  const data = await employeeService.getTaxInfo(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.updateTaxInfo = async (req, res) => {
  const data = await employeeService.updateTaxInfo(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Tax information updated', data });
};

exports.updatePhoto = async (req, res) => {
  const data = await employeeService.updatePhoto(req.organizationId, req.params.id, req.file, req.user, reqMeta(req));
  res.json({ success: true, message: 'Profile photo updated', data });
};

exports.getPhoto = async (req, res) => {
  const file = await employeeService.getPhoto(req.organizationId, req.params.id, req.user);
  streamFile(res, file, 'inline');
};
