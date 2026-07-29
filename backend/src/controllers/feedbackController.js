const feedbackService = require('../services/feedbackService');

exports.getFeedback = async (req, res) => {
  const { data, pagination } = await feedbackService.getFeedback(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getFeedbackById = async (req, res) => {
  const data = await feedbackService.getFeedbackById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.getEmployeeFeedback = async (req, res) => {
  const data = await feedbackService.getEmployeeFeedback(req.organizationId, req.params.employeeId, req.query);
  res.json({ success: true, data });
};

exports.createFeedback = async (req, res) => {
  const data = await feedbackService.createFeedback(req.organizationId, req.body, req.user._id);
  res.status(201).json({ success: true, message: 'Feedback created', data });
};

exports.updateFeedback = async (req, res) => {
  const data = await feedbackService.updateFeedback(req.organizationId, req.params.id, req.body, req.user);
  res.json({ success: true, message: 'Feedback updated', data });
};

exports.deleteFeedback = async (req, res) => {
  const result = await feedbackService.deleteFeedback(req.organizationId, req.params.id);
  res.json(result);
};

exports.getFeedbackRequests = async (req, res) => {
  const { data, pagination } = await feedbackService.getFeedbackRequests(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.createFeedbackRequest = async (req, res) => {
  const data = await feedbackService.createFeedbackRequest(req.organizationId, req.body, req.user._id);
  res.status(201).json({ success: true, message: 'Feedback request created', data });
};

exports.submitFeedbackRequest = async (req, res) => {
  const data = await feedbackService.submitFeedbackRequest(req.organizationId, req.params.id, req.body, req.user._id);
  res.json({ success: true, message: 'Feedback submitted', data });
};

exports.declineFeedbackRequest = async (req, res) => {
  const data = await feedbackService.declineFeedbackRequest(req.organizationId, req.params.id, req.user._id);
  res.json({ success: true, message: 'Feedback request declined', data });
};
