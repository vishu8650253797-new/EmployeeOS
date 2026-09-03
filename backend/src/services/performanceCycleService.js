const PerformanceCycle = require('../models/PerformanceCycle');
const { getSocketInstance } = require('../socket/socketServer');

exports.getCycles = async (organizationId, query = {}) => {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    type,
    startDate,
    endDate
  } = query;

  const filter = { organizationId };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (status) {
    filter.status = status;
  }

  if (type) {
    filter.type = type;
  }

  if (startDate) {
    filter.startDate = { $gte: new Date(startDate) };
  }

  if (endDate) {
    filter.endDate = { $lte: new Date(endDate) };
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    PerformanceCycle.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'firstName lastName email'),
    PerformanceCycle.countDocuments(filter)
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

exports.getCycleById = async (organizationId, cycleId) => {
  const cycle = await PerformanceCycle.findOne({
    _id: cycleId,
    organizationId
  }).populate('createdBy', 'firstName lastName email');

  if (!cycle) {
    throw new Error('Performance cycle not found');
  }

  return cycle;
};

exports.createCycle = async (organizationId, cycleData, userId) => {
  const cycle = new PerformanceCycle({
    ...cycleData,
    organizationId,
    createdBy: userId
  });

  await cycle.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('performance:cycle-created', {
      cycleId: cycle._id,
      name: cycle.name,
      type: cycle.type,
      status: cycle.status
    });
  }

  return cycle;
};

const CYCLE_UPDATABLE_FIELDS = ['name', 'description', 'type', 'startDate', 'endDate', 'status'];

exports.updateCycle = async (organizationId, cycleId, cycleData) => {
  const updates = {};
  CYCLE_UPDATABLE_FIELDS.forEach((field) => {
    if (cycleData[field] !== undefined) updates[field] = cycleData[field];
  });

  const cycle = await PerformanceCycle.findOneAndUpdate(
    { _id: cycleId, organizationId },
    updates,
    { new: true, runValidators: true }
  );

  if (!cycle) {
    throw new Error('Performance cycle not found');
  }

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('performance:cycle-updated', {
      cycleId: cycle._id,
      name: cycle.name,
      status: cycle.status
    });
  }

  return cycle;
};

exports.deleteCycle = async (organizationId, cycleId) => {
  const cycle = await PerformanceCycle.findOneAndDelete({
    _id: cycleId,
    organizationId
  });

  if (!cycle) {
    throw new Error('Performance cycle not found');
  }

  return { success: true, message: 'Performance cycle deleted' };
};

exports.getActiveCycle = async (organizationId) => {
  return await PerformanceCycle.findOne({
    organizationId,
    status: 'ACTIVE'
  }).sort({ createdAt: -1 });
};
