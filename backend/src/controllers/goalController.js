const goalService = require('../services/goalService');

exports.getGoals = async (req, res) => {
  const { data, pagination } = await goalService.getGoals(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getGoalById = async (req, res) => {
  const data = await goalService.getGoalById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.getMyGoals = async (req, res) => {
  const data = await goalService.getMyGoals(req.organizationId, req.user.employeeId, req.query);
  res.json({ success: true, data });
};

exports.getEmployeeGoals = async (req, res) => {
  const data = await goalService.getEmployeeGoals(req.organizationId, req.params.employeeId, req.query);
  res.json({ success: true, data });
};

exports.getCycleGoals = async (req, res) => {
  const data = await goalService.getCycleGoals(req.organizationId, req.params.cycleId);
  res.json({ success: true, data });
};

exports.createGoal = async (req, res) => {
  const data = await goalService.createGoal(req.organizationId, req.body, req.user._id);
  res.status(201).json({ success: true, message: 'Goal created', data });
};

exports.updateGoal = async (req, res) => {
  const data = await goalService.updateGoal(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'Goal updated', data });
};

exports.deleteGoal = async (req, res) => {
  const result = await goalService.deleteGoal(req.organizationId, req.params.id);
  res.json(result);
};

exports.updateGoalProgress = async (req, res) => {
  const data = await goalService.updateGoalProgress(req.organizationId, req.params.id, req.body, req.user);
  res.json({ success: true, message: 'Goal progress updated', data });
};

exports.updateGoalStatus = async (req, res) => {
  const data = await goalService.updateGoalStatus(req.organizationId, req.params.id, req.body.status);
  res.json({ success: true, message: 'Goal status updated', data });
};

exports.getGoalProgressHistory = async (req, res) => {
  const data = await goalService.getGoalProgressHistory(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};
