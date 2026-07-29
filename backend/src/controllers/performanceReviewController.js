const performanceReviewService = require('../services/performanceReviewService');

exports.getReviews = async (req, res) => {
  const { data, pagination } = await performanceReviewService.getReviews(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getReviewById = async (req, res) => {
  const data = await performanceReviewService.getReviewById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.getMyReviews = async (req, res) => {
  const data = await performanceReviewService.getMyReviews(req.organizationId, req.user.employeeId, req.query);
  res.json({ success: true, data });
};

exports.getEmployeeReviews = async (req, res) => {
  const data = await performanceReviewService.getEmployeeReviews(req.organizationId, req.params.employeeId, req.query);
  res.json({ success: true, data });
};

exports.getCycleReviews = async (req, res) => {
  const data = await performanceReviewService.getCycleReviews(req.organizationId, req.params.cycleId);
  res.json({ success: true, data });
};

exports.createReview = async (req, res) => {
  const data = await performanceReviewService.createReview(req.organizationId, req.body, req.user._id);
  res.status(201).json({ success: true, message: 'Performance review created', data });
};

exports.updateReview = async (req, res) => {
  const data = await performanceReviewService.updateReview(req.organizationId, req.params.id, req.body, req.user);
  res.json({ success: true, message: 'Performance review updated', data });
};

exports.deleteReview = async (req, res) => {
  const result = await performanceReviewService.deleteReview(req.organizationId, req.params.id);
  res.json(result);
};

exports.submitReview = async (req, res) => {
  const data = await performanceReviewService.submitReview(req.organizationId, req.params.id, req.user._id);
  res.json({ success: true, message: 'Performance review submitted', data });
};

exports.approveReview = async (req, res) => {
  const data = await performanceReviewService.approveReview(req.organizationId, req.params.id);
  res.json({ success: true, message: 'Performance review approved', data });
};

exports.completeReview = async (req, res) => {
  const data = await performanceReviewService.completeReview(req.organizationId, req.params.id, req.body);
  res.json({ success: true, message: 'Performance review completed', data });
};

exports.reopenReview = async (req, res) => {
  const data = await performanceReviewService.reopenReview(req.organizationId, req.params.id);
  res.json({ success: true, message: 'Performance review reopened', data });
};
