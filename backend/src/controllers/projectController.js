const projectService = require('../services/projectService');

exports.getProjects = async (req, res) => {
  const { data, pagination } = await projectService.getProjects(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getProjectById = async (req, res) => {
  const data = await projectService.getProjectById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createProject = async (req, res) => {
  const data = await projectService.createProject(req.organizationId, req.body, req.user._id);
  res.status(201).json({ success: true, message: 'Project created', data });
};

exports.updateProject = async (req, res) => {
  const data = await projectService.updateProject(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'Project updated', data });
};

exports.deleteProject = async (req, res) => {
  const result = await projectService.deleteProject(req.organizationId, req.params.id);
  res.json(result);
};

exports.addProjectMember = async (req, res) => {
  const { employeeId } = req.body;
  const data = await projectService.addProjectMember(req.organizationId, req.params.id, employeeId);
  res.json({ success: true, message: 'Member added', data });
};

exports.removeProjectMember = async (req, res) => {
  const { employeeId } = req.body;
  const data = await projectService.removeProjectMember(req.organizationId, req.params.id, employeeId);
  res.json({ success: true, message: 'Member removed', data });
};

exports.getProjectStatistics = async (req, res) => {
  const data = await projectService.getProjectStatistics(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.calculateProjectProgress = async (req, res) => {
  const data = await projectService.calculateProjectProgress(req.organizationId, req.params.id);
  res.json({ success: true, data });
};
