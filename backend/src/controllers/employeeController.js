const employeeService = require('../services/employeeService');

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
