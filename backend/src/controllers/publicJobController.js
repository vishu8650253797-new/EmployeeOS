const publicJobService = require('../services/publicJobService');
const offerService = require('../services/offerService');

exports.getPublicJobs = async (req, res) => {
  const { data, pagination } = await publicJobService.getPublicJobs(req.query);
  res.json({ success: true, data, pagination });
};

exports.getPublicJobBySlug = async (req, res) => {
  const data = await publicJobService.getPublicJobBySlug(req.params.slug);
  res.json({ success: true, data });
};

exports.applyToJob = async (req, res) => {
  const result = await publicJobService.applyToJob(req.params.jobId, req.body, req.file);
  res.status(201).json(result);
};

exports.getPublicOffer = async (req, res) => {
  const data = await offerService.getPublicOffer(req.params.token);
  res.json({ success: true, data });
};

exports.acceptOffer = async (req, res) => {
  const result = await offerService.respondToPublicOffer(req.params.token, true);
  res.json(result);
};

exports.rejectOffer = async (req, res) => {
  const result = await offerService.respondToPublicOffer(req.params.token, false);
  res.json(result);
};
