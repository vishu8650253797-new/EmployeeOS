const departmentService = require('../services/departmentService');

exports.getDepartments = async (req, res) => {
  const departments = await departmentService.getDepartments(req.organizationId, req.query);
  res.json({ success: true, data: departments });
};

exports.getDepartmentById = async (req, res) => {
  const department = await departmentService.getDepartmentById(req.organizationId, req.params.id);
  res.json({ success: true, data: department });
};

exports.createDepartment = async (req, res) => {
  const department = await departmentService.createDepartment(req.organizationId, req.body);
  res.status(201).json({
    success: true,
    message: 'Department created successfully',
    data: department,
  });
};

exports.updateDepartment = async (req, res) => {
  const department = await departmentService.updateDepartment(req.organizationId, req.params.id, req.body);
  res.json({
    success: true,
    message: 'Department updated successfully',
    data: department,
  });
};

exports.deleteDepartment = async (req, res) => {
  const result = await departmentService.deleteDepartment(req.organizationId, req.params.id);
  res.json(result);
};
