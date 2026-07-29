const Feedback = require('../models/Feedback');
const FeedbackRequest = require('../models/FeedbackRequest');
const { getSocketInstance } = require('../socket/socketServer');
const AppError = require('../utils/AppError');

const ELEVATED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];
const RESTRICTED_FEEDBACK_FIELDS = ['_id', 'organizationId', 'employeeId', 'authorId', 'createdAt', 'updatedAt'];

function sanitizeFeedbackData(feedbackData = {}) {
  const clean = { ...feedbackData };
  RESTRICTED_FEEDBACK_FIELDS.forEach((field) => delete clean[field]);
  return clean;
}

exports.getFeedback = async (organizationId, query = {}) => {
  const {
    page = 1,
    limit = 20,
    employee,
    cycle,
    type,
    visibility
  } = query;

  const filter = { organizationId };

  if (employee) {
    filter.employeeId = employee;
  }

  if (cycle) {
    filter.cycleId = cycle;
  }

  if (type) {
    filter.type = type;
  }

  if (visibility) {
    filter.visibility = visibility;
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employeeId', 'firstName lastName employeeId')
      .populate('authorId', 'firstName lastName email')
      .populate('cycleId', 'name type'),
    Feedback.countDocuments(filter)
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

exports.getFeedbackById = async (organizationId, feedbackId) => {
  const feedback = await Feedback.findOne({
    _id: feedbackId,
    organizationId
  })
    .populate('employeeId', 'firstName lastName employeeId')
    .populate('authorId', 'firstName lastName email')
    .populate('cycleId', 'name type');

  if (!feedback) {
    throw new Error('Feedback not found');
  }

  return feedback;
};

exports.getEmployeeFeedback = async (organizationId, employeeId, query = {}) => {
  const { cycle, type } = query;

  const filter = {
    organizationId,
    employeeId
  };

  if (cycle) filter.cycleId = cycle;
  if (type) filter.type = type;

  return await Feedback.find(filter)
    .sort({ createdAt: -1 })
    .populate('authorId', 'firstName lastName email')
    .populate('cycleId', 'name type');
};

exports.createFeedback = async (organizationId, feedbackData, userId) => {
  const feedback = new Feedback({
    ...feedbackData,
    organizationId,
    authorId: userId
  });

  await feedback.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`user:${feedback.employeeId}`).emit('feedback:created', {
      feedbackId: feedback._id,
      type: feedback.type,
      visibility: feedback.visibility
    });
  }

  return feedback;
};

exports.updateFeedback = async (organizationId, feedbackId, feedbackData, actor) => {
  const existing = await Feedback.findOne({ _id: feedbackId, organizationId });
  if (!existing) {
    throw new Error('Feedback not found');
  }

  const isAuthor = actor._id && actor._id.toString() === existing.authorId.toString();
  if (!isAuthor && !ELEVATED_ROLES.includes(actor.role)) {
    throw new AppError('You are not authorized to update this feedback', 403);
  }

  const feedback = await Feedback.findOneAndUpdate(
    { _id: feedbackId, organizationId },
    sanitizeFeedbackData(feedbackData),
    { new: true, runValidators: true }
  );

  return feedback;
};

exports.deleteFeedback = async (organizationId, feedbackId) => {
  const feedback = await Feedback.findOneAndDelete({
    _id: feedbackId,
    organizationId
  });

  if (!feedback) {
    throw new Error('Feedback not found');
  }

  return { success: true, message: 'Feedback deleted' };
};

exports.getFeedbackRequests = async (organizationId, query = {}) => {
  const {
    page = 1,
    limit = 20,
    employee,
    cycle,
    status,
    requestedFrom
  } = query;

  const filter = { organizationId };

  if (employee) {
    filter.employeeId = employee;
  }

  if (cycle) {
    filter.cycleId = cycle;
  }

  if (status) {
    filter.status = status;
  }

  if (requestedFrom) {
    filter.requestedFrom = requestedFrom;
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    FeedbackRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employeeId', 'firstName lastName employeeId')
      .populate('requestedFrom', 'firstName lastName email')
      .populate('requestedBy', 'firstName lastName email')
      .populate('cycleId', 'name type'),
    FeedbackRequest.countDocuments(filter)
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

exports.createFeedbackRequest = async (organizationId, requestData, userId) => {
  const request = new FeedbackRequest({
    ...requestData,
    organizationId,
    requestedBy: userId
  });

  await request.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`user:${request.requestedFrom}`).emit('feedback:requested', {
      requestId: request._id,
      employeeId: request.employeeId,
      cycleId: request.cycleId,
      dueDate: request.dueDate
    });
  }

  return request;
};

exports.submitFeedbackRequest = async (organizationId, requestId, feedbackData, userId) => {
  const request = await FeedbackRequest.findOne({
    _id: requestId,
    organizationId,
    requestedFrom: userId
  });

  if (!request) {
    throw new Error('Feedback request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error('Feedback request already processed');
  }

  request.status = 'SUBMITTED';
  request.completedAt = new Date();
  await request.save();

  const feedback = new Feedback({
    organizationId,
    employeeId: request.employeeId,
    authorId: userId,
    cycleId: request.cycleId,
    type: 'PEER',
    content: feedbackData.content,
    visibility: feedbackData.visibility || 'SHARED_WITH_EMPLOYEE'
  });

  await feedback.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('feedback:submitted', {
      feedbackId: feedback._id,
      employeeId: feedback.employeeId,
      requestId: request._id
    });
  }

  return { request, feedback };
};

exports.declineFeedbackRequest = async (organizationId, requestId, userId) => {
  const request = await FeedbackRequest.findOne({
    _id: requestId,
    organizationId,
    requestedFrom: userId
  });

  if (!request) {
    throw new Error('Feedback request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error('Feedback request already processed');
  }

  request.status = 'DECLINED';
  await request.save();

  return request;
};
