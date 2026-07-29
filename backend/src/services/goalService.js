const EmployeeGoal = require('../models/EmployeeGoal');
const GoalProgress = require('../models/GoalProgress');
const { getSocketInstance } = require('../socket/socketServer');
const AppError = require('../utils/AppError');

const ELEVATED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

exports.getGoals = async (organizationId, query = {}) => {
  const {
    page = 1,
    limit = 20,
    search,
    employee,
    cycle,
    category,
    priority,
    status,
    department,
    dueDate
  } = query;

  const filter = { organizationId };

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (employee) {
    filter.employeeId = employee;
  }

  if (cycle) {
    filter.cycleId = cycle;
  }

  if (category) {
    filter.category = category;
  }

  if (priority) {
    filter.priority = priority;
  }

  if (status) {
    filter.status = status;
  }

  if (dueDate) {
    filter.dueDate = { $lte: new Date(dueDate) };
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    EmployeeGoal.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employeeId', 'firstName lastName employeeId')
      .populate('cycleId', 'name type')
      .populate('createdBy', 'firstName lastName email'),
    EmployeeGoal.countDocuments(filter)
  ]);

  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

exports.getGoalById = async (organizationId, goalId) => {
  const goal = await EmployeeGoal.findOne({
    _id: goalId,
    organizationId
  })
    .populate('employeeId', 'firstName lastName employeeId')
    .populate('cycleId', 'name type')
    .populate('createdBy', 'firstName lastName email');

  if (!goal) {
    throw new Error('Goal not found');
  }

  return goal;
};

exports.getMyGoals = async (organizationId, employeeId, query = {}) => {
  const { cycle, status, category } = query;

  const filter = {
    organizationId,
    employeeId
  };

  if (cycle) filter.cycleId = cycle;
  if (status) filter.status = status;
  if (category) filter.category = category;

  return await EmployeeGoal.find(filter)
    .sort({ dueDate: 1 })
    .populate('cycleId', 'name type');
};

exports.getEmployeeGoals = async (organizationId, employeeId, query = {}) => {
  const { cycle, status } = query;

  const filter = {
    organizationId,
    employeeId
  };

  if (cycle) filter.cycleId = cycle;
  if (status) filter.status = status;

  return await EmployeeGoal.find(filter)
    .sort({ dueDate: 1 })
    .populate('cycleId', 'name type');
};

exports.getCycleGoals = async (organizationId, cycleId) => {
  return await EmployeeGoal.find({
    organizationId,
    cycleId
  })
    .sort({ createdAt: -1 })
    .populate('employeeId', 'firstName lastName employeeId');
};

exports.createGoal = async (organizationId, goalData, userId) => {
  const goal = new EmployeeGoal({
    ...goalData,
    organizationId,
    createdBy: userId
  });

  await goal.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('goal:created', {
      goalId: goal._id,
      employeeId: goal.employeeId,
      title: goal.title,
      priority: goal.priority
    });
    io.to(`user:${goal.employeeId}`).emit('goal:created', {
      goalId: goal._id,
      title: goal.title,
      priority: goal.priority
    });
  }

  return goal;
};

exports.updateGoal = async (organizationId, goalId, goalData) => {
  const goal = await EmployeeGoal.findOneAndUpdate(
    { _id: goalId, organizationId },
    goalData,
    { new: true, runValidators: true }
  );

  if (!goal) {
    throw new Error('Goal not found');
  }

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('goal:updated', {
      goalId: goal._id,
      employeeId: goal.employeeId,
      status: goal.status
    });
    io.to(`user:${goal.employeeId}`).emit('goal:updated', {
      goalId: goal._id,
      status: goal.status
    });
  }

  return goal;
};

exports.deleteGoal = async (organizationId, goalId) => {
  const goal = await EmployeeGoal.findOneAndDelete({
    _id: goalId,
    organizationId
  });

  if (!goal) {
    throw new Error('Goal not found');
  }

  return { success: true, message: 'Goal deleted' };
};

exports.updateGoalProgress = async (organizationId, goalId, progressData, actor) => {
  const goal = await EmployeeGoal.findOne({
    _id: goalId,
    organizationId
  });

  if (!goal) {
    throw new Error('Goal not found');
  }

  const isOwner = actor.employeeId && actor.employeeId.toString() === goal.employeeId.toString();
  if (!isOwner && !ELEVATED_ROLES.includes(actor.role)) {
    throw new AppError('You are not authorized to update this goal\'s progress', 403);
  }

  const userId = actor._id;
  const { newValue, note } = progressData;
  const previousValue = goal.currentValue;
  
  let progressPercentage = 0;
  if (goal.targetValue > 0) {
    progressPercentage = Math.min(100, (newValue / goal.targetValue) * 100);
  }

  goal.currentValue = newValue;
  goal.progressPercentage = progressPercentage;
  
  if (progressPercentage >= 100 && goal.status !== 'COMPLETED') {
    goal.status = 'COMPLETED';
    goal.completedAt = new Date();
  } else if (progressPercentage < 30 && goal.status === 'IN_PROGRESS') {
    goal.status = 'AT_RISK';
  } else if (progressPercentage >= 30 && goal.status === 'AT_RISK') {
    goal.status = 'IN_PROGRESS';
  }

  await goal.save();

  const progress = new GoalProgress({
    organizationId,
    goalId,
    employeeId: goal.employeeId,
    previousValue,
    newValue,
    progressPercentage,
    note,
    updatedBy: userId
  });

  await progress.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('goal:progress-updated', {
      goalId: goal._id,
      employeeId: goal.employeeId,
      progressPercentage,
      status: goal.status
    });
    io.to(`user:${goal.employeeId}`).emit('goal:progress-updated', {
      goalId: goal._id,
      progressPercentage,
      status: goal.status
    });

    if (goal.status === 'AT_RISK') {
      io.to(`user:${goal.employeeId}`).emit('goal:at-risk', {
        goalId: goal._id,
        title: goal.title,
        progressPercentage
      });
    }

    if (goal.status === 'COMPLETED') {
      io.to(`organization:${organizationId}`).emit('goal:completed', {
        goalId: goal._id,
        employeeId: goal.employeeId,
        title: goal.title
      });
    }
  }

  return goal;
};

exports.updateGoalStatus = async (organizationId, goalId, status) => {
  const goal = await EmployeeGoal.findOneAndUpdate(
    { _id: goalId, organizationId },
    { status, completedAt: status === 'COMPLETED' ? new Date() : null },
    { new: true, runValidators: true }
  );

  if (!goal) {
    throw new Error('Goal not found');
  }

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('goal:updated', {
      goalId: goal._id,
      employeeId: goal.employeeId,
      status
    });
    io.to(`user:${goal.employeeId}`).emit('goal:updated', {
      goalId: goal._id,
      status
    });
  }

  return goal;
};

exports.getGoalProgressHistory = async (organizationId, goalId) => {
  const goal = await EmployeeGoal.findOne({
    _id: goalId,
    organizationId
  });

  if (!goal) {
    throw new Error('Goal not found');
  }

  return await GoalProgress.find({ goalId })
    .sort({ createdAt: -1 })
    .populate('updatedBy', 'firstName lastName email');
};
