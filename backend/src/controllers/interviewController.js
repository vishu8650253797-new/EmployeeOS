const interviewService = require('../services/interviewService');
const { requestMeta } = require('../services/auditLogService');

exports.getInterviews = async (req, res) => {
  const { data, pagination } = await interviewService.getInterviews(req.organizationId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getInterviewById = async (req, res) => {
  const data = await interviewService.getInterviewById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.createInterview = async (req, res) => {
  const data = await interviewService.createInterview(req.organizationId, req.body, req.user, requestMeta(req));
  res.status(201).json({ success: true, message: 'Interview scheduled', data });
};

exports.updateInterview = async (req, res) => {
  const data = await interviewService.updateInterview(req.organizationId, req.params.id, req.body, req.user, requestMeta(req));
  res.json({ success: true, message: 'Interview updated', data });
};

exports.rescheduleInterview = async (req, res) => {
  const data = await interviewService.rescheduleInterview(req.organizationId, req.params.id, req.body, req.user, requestMeta(req));
  res.json({ success: true, message: 'Interview rescheduled', data });
};

exports.cancelInterview = async (req, res) => {
  const data = await interviewService.cancelInterview(req.organizationId, req.params.id, req.user, requestMeta(req));
  res.json({ success: true, message: 'Interview cancelled', data });
};

exports.completeInterview = async (req, res) => {
  const data = await interviewService.completeInterview(req.organizationId, req.params.id, req.user, requestMeta(req));
  res.json({ success: true, message: 'Interview completed', data });
};

exports.deleteInterview = async (req, res) => {
  const result = await interviewService.deleteInterview(req.organizationId, req.params.id, req.user, requestMeta(req));
  res.json(result);
};

exports.getFeedback = async (req, res) => {
  const data = await interviewService.getFeedback(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.submitFeedback = async (req, res) => {
  const data = await interviewService.submitFeedback(req.organizationId, req.params.id, req.body, req.user, requestMeta(req));
  res.status(201).json({ success: true, message: 'Feedback submitted', data });
};

exports.updateFeedback = async (req, res) => {
  const data = await interviewService.updateFeedback(req.organizationId, req.params.feedbackId, req.body, req.user);
  res.json({ success: true, message: 'Feedback updated', data });
};

exports.getCandidateFeedback = async (req, res) => {
  const data = await interviewService.getCandidateFeedback(req.organizationId, req.params.candidateId);
  res.json({ success: true, data });
};
