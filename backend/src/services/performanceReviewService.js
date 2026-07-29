const PerformanceReview = require('../models/PerformanceReview');
const performanceScoreService = require('./performanceScoreService');
const { getSocketInstance } = require('../socket/socketServer');

exports.getReviews = async (organizationId, query = {}) => {
  const {
    page = 1,
    limit = 20,
    employee,
    cycle,
    reviewer,
    status,
    reviewType
  } = query;

  const filter = { organizationId };

  if (employee) {
    filter.employeeId = employee;
  }

  if (cycle) {
    filter.cycleId = cycle;
  }

  if (reviewer) {
    filter.reviewerId = reviewer;
  }

  if (status) {
    filter.status = status;
  }

  if (reviewType) {
    filter.reviewType = reviewType;
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    PerformanceReview.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employeeId', 'firstName lastName employeeId')
      .populate('cycleId', 'name type')
      .populate('reviewerId', 'firstName lastName email'),
    PerformanceReview.countDocuments(filter)
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

exports.getReviewById = async (organizationId, reviewId) => {
  const review = await PerformanceReview.findOne({
    _id: reviewId,
    organizationId
  })
    .populate('employeeId', 'firstName lastName employeeId')
    .populate('cycleId', 'name type')
    .populate('reviewerId', 'firstName lastName email');

  if (!review) {
    throw new Error('Performance review not found');
  }

  return review;
};

exports.getMyReviews = async (organizationId, employeeId, query = {}) => {
  const { cycle, status, reviewType } = query;

  const filter = {
    organizationId,
    employeeId
  };

  if (cycle) filter.cycleId = cycle;
  if (status) filter.status = status;
  if (reviewType) filter.reviewType = reviewType;

  return await PerformanceReview.find(filter)
    .sort({ createdAt: -1 })
    .populate('cycleId', 'name type')
    .populate('reviewerId', 'firstName lastName email');
};

exports.getEmployeeReviews = async (organizationId, employeeId, query = {}) => {
  const { cycle, status } = query;

  const filter = {
    organizationId,
    employeeId
  };

  if (cycle) filter.cycleId = cycle;
  if (status) filter.status = status;

  return await PerformanceReview.find(filter)
    .sort({ createdAt: -1 })
    .populate('cycleId', 'name type')
    .populate('reviewerId', 'firstName lastName email');
};

exports.getCycleReviews = async (organizationId, cycleId) => {
  return await PerformanceReview.find({
    organizationId,
    cycleId
  })
    .sort({ createdAt: -1 })
    .populate('employeeId', 'firstName lastName employeeId')
    .populate('reviewerId', 'firstName lastName email');
};

exports.createReview = async (organizationId, reviewData, userId) => {
  const review = new PerformanceReview({
    ...reviewData,
    organizationId,
    reviewerId: userId
  });

  await review.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('review:started', {
      reviewId: review._id,
      employeeId: review.employeeId,
      cycleId: review.cycleId,
      reviewType: review.reviewType
    });
    io.to(`user:${review.employeeId}`).emit('review:assigned', {
      reviewId: review._id,
      cycleId: review.cycleId,
      reviewType: review.reviewType
    });
  }

  return review;
};

exports.updateReview = async (organizationId, reviewId, reviewData) => {
  const review = await PerformanceReview.findOneAndUpdate(
    { _id: reviewId, organizationId },
    reviewData,
    { new: true, runValidators: true }
  );

  if (!review) {
    throw new Error('Performance review not found');
  }

  return review;
};

exports.deleteReview = async (organizationId, reviewId) => {
  const review = await PerformanceReview.findOneAndDelete({
    _id: reviewId,
    organizationId
  });

  if (!review) {
    throw new Error('Performance review not found');
  }

  return { success: true, message: 'Performance review deleted' };
};

exports.submitReview = async (organizationId, reviewId, userId) => {
  const review = await PerformanceReview.findOne({
    _id: reviewId,
    organizationId
  });

  if (!review) {
    throw new Error('Performance review not found');
  }

  if (review.status === 'SUBMITTED' || review.status === 'COMPLETED') {
    throw new Error('Review already submitted');
  }

  review.status = 'SUBMITTED';
  review.submittedAt = new Date();

  await review.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('review:submitted', {
      reviewId: review._id,
      employeeId: review.employeeId,
      reviewerId: review.reviewerId,
      reviewType: review.reviewType
    });
  }

  return review;
};

exports.approveReview = async (organizationId, reviewId) => {
  const review = await PerformanceReview.findOne({
    _id: reviewId,
    organizationId
  });

  if (!review) {
    throw new Error('Performance review not found');
  }

  review.status = 'UNDER_REVIEW';
  review.reviewedAt = new Date();

  await review.save();

  return review;
};

exports.completeReview = async (organizationId, reviewId, reviewData) => {
  const review = await PerformanceReview.findOne({
    _id: reviewId,
    organizationId
  });

  if (!review) {
    throw new Error('Performance review not found');
  }

  Object.assign(review, reviewData);
  review.status = 'COMPLETED';
  review.completedAt = new Date();

  await review.save();

  const scores = await performanceScoreService.updatePerformanceScore(
    organizationId,
    review.employeeId,
    review.cycleId
  );

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('review:completed', {
      reviewId: review._id,
      employeeId: review.employeeId,
      cycleId: review.cycleId,
      overallScore: review.overallScore
    });
    io.to(`user:${review.employeeId}`).emit('review:completed', {
      reviewId: review._id,
      cycleId: review.cycleId,
      overallScore: review.overallScore,
      rating: scores.rating
    });
  }

  return review;
};

exports.reopenReview = async (organizationId, reviewId) => {
  const review = await PerformanceReview.findOne({
    _id: reviewId,
    organizationId
  });

  if (!review) {
    throw new Error('Performance review not found');
  }

  review.status = 'IN_PROGRESS';
  review.completedAt = null;

  await review.save();

  const io = getSocketInstance();
  if (io) {
    io.to(`organization:${organizationId}`).emit('review:reopened', {
      reviewId: review._id,
      employeeId: review.employeeId
    });
    io.to(`user:${review.employeeId}`).emit('review:reopened', {
      reviewId: review._id
    });
  }

  return review;
};
