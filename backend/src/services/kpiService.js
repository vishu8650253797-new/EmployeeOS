const KPI = require('../models/KPI');
const { getSocketInstance } = require('../socket/socketServer');
const AppError = require('../utils/AppError');

const ELEVATED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

exports.calculateKPIScore = (currentValue, targetValue) => {
  if (!targetValue || targetValue === 0) {
    return 0;
  }

  let score = (currentValue / targetValue) * 100;

  if (!isFinite(score) || isNaN(score)) {
    return 0;
  }

  return Math.min(100, Math.max(0, score));
};

exports.getKPIs = async (organizationId, query = {}) => {
  const {
    page = 1,
    limit = 20,
    search,
    employee,
    cycle,
    category
  } = query;

  const filter = { organizationId };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
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

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    KPI.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employeeId', 'firstName lastName employeeId')
      .populate('cycleId', 'name type')
      .populate('createdBy', 'firstName lastName email'),
    KPI.countDocuments(filter)
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

exports.getKPIById = async (organizationId, kpiId, actor) => {
  const kpi = await KPI.findOne({
    _id: kpiId,
    organizationId
  })
    .populate('employeeId', 'firstName lastName employeeId')
    .populate('cycleId', 'name type')
    .populate('createdBy', 'firstName lastName email');

  if (!kpi) {
    throw new Error('KPI not found');
  }

  const isOwner = actor.employeeId && actor.employeeId.toString() === kpi.employeeId._id.toString();
  if (!isOwner && !ELEVATED_ROLES.includes(actor.role)) {
    throw new AppError('You are not authorized to view this KPI', 403);
  }

  return kpi;
};

exports.getEmployeeKPIs = async (organizationId, employeeId, query = {}) => {
  const { cycle, category } = query;

  const filter = {
    organizationId,
    employeeId
  };

  if (cycle) filter.cycleId = cycle;
  if (category) filter.category = category;

  return await KPI.find(filter)
    .sort({ createdAt: -1 })
    .populate('cycleId', 'name type');
};

exports.getCycleKPIs = async (organizationId, cycleId) => {
  return await KPI.find({
    organizationId,
    cycleId
  })
    .sort({ createdAt: -1 })
    .populate('employeeId', 'firstName lastName employeeId');
};

const KPI_UPDATABLE_FIELDS = [
  'name', 'description', 'category', 'employeeId', 'cycleId', 'targetValue', 'currentValue',
  'unit', 'weight', 'status',
];

function pickKpiFields(source) {
  const picked = {};
  KPI_UPDATABLE_FIELDS.forEach((field) => {
    if (source[field] !== undefined) picked[field] = source[field];
  });
  return picked;
}

exports.createKPI = async (organizationId, kpiData, userId) => {
  const kpi = new KPI({
    ...pickKpiFields(kpiData),
    organizationId,
    createdBy: userId,
    score: exports.calculateKPIScore(kpiData.currentValue, kpiData.targetValue)
  });

  await kpi.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('kpi:created', {
      kpiId: kpi._id,
      employeeId: kpi.employeeId,
      name: kpi.name,
      category: kpi.category
    });
    io.to(`user:${kpi.employeeId}`).emit('kpi:created', {
      kpiId: kpi._id,
      name: kpi.name,
      category: kpi.category
    });
  }

  return kpi;
};

exports.updateKPI = async (organizationId, kpiId, kpiData) => {
  const kpi = await KPI.findOne({
    _id: kpiId,
    organizationId
  });

  if (!kpi) {
    throw new Error('KPI not found');
  }

  const updates = pickKpiFields(kpiData);
  if (updates.targetValue !== undefined || updates.currentValue !== undefined) {
    const targetValue = updates.targetValue !== undefined ? updates.targetValue : kpi.targetValue;
    const currentValue = updates.currentValue !== undefined ? updates.currentValue : kpi.currentValue;
    updates.score = exports.calculateKPIScore(currentValue, targetValue);
  }

  const updatedKPI = await KPI.findOneAndUpdate(
    { _id: kpiId, organizationId },
    updates,
    { new: true, runValidators: true }
  );

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('kpi:updated', {
      kpiId: updatedKPI._id,
      employeeId: updatedKPI.employeeId,
      score: updatedKPI.score
    });
    io.to(`user:${updatedKPI.employeeId}`).emit('kpi:updated', {
      kpiId: updatedKPI._id,
      score: updatedKPI.score
    });
  }

  return updatedKPI;
};

exports.deleteKPI = async (organizationId, kpiId) => {
  const kpi = await KPI.findOneAndDelete({
    _id: kpiId,
    organizationId
  });

  if (!kpi) {
    throw new Error('KPI not found');
  }

  return { success: true, message: 'KPI deleted' };
};

exports.updateKPIValue = async (organizationId, kpiId, valueData) => {
  const kpi = await KPI.findOne({
    _id: kpiId,
    organizationId
  });

  if (!kpi) {
    throw new Error('KPI not found');
  }

  const { currentValue } = valueData;
  kpi.currentValue = currentValue;
  kpi.score = exports.calculateKPIScore(currentValue, kpi.targetValue);

  if (kpi.score >= 90) {
    kpi.status = 'ON_TRACK';
  } else if (kpi.score >= 70) {
    kpi.status = 'IN_PROGRESS';
  } else {
    kpi.status = 'BEHIND';
  }

  await kpi.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('kpi:value-updated', {
      kpiId: kpi._id,
      employeeId: kpi.employeeId,
      currentValue,
      score: kpi.score,
      status: kpi.status
    });
    io.to(`user:${kpi.employeeId}`).emit('kpi:value-updated', {
      kpiId: kpi._id,
      currentValue,
      score: kpi.score,
      status: kpi.status
    });
  }

  return kpi;
};
