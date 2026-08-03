const offerService = require('../services/offerService');
const { requestMeta } = require('../services/auditLogService');

exports.getOffers = async (req, res) => {
  const { data, pagination } = await offerService.getOffers(req.organizationId, req.query);
  res.json({ success: true, data, pagination });
};

exports.getOfferById = async (req, res) => {
  const data = await offerService.getOfferById(req.organizationId, req.params.id);
  res.json({ success: true, data });
};

exports.createOffer = async (req, res) => {
  const data = await offerService.createOffer(req.organizationId, req.body, req.user, requestMeta(req));
  res.status(201).json({ success: true, message: 'Offer created', data });
};

exports.updateOffer = async (req, res) => {
  const data = await offerService.updateOffer(req.organizationId, req.params.id, req.body, req.user, requestMeta(req));
  res.json({ success: true, message: 'Offer updated', data });
};

exports.sendOffer = async (req, res) => {
  const data = await offerService.sendOffer(req.organizationId, req.params.id, req.user, requestMeta(req));
  res.json({ success: true, message: 'Offer sent', data });
};

exports.withdrawOffer = async (req, res) => {
  const data = await offerService.withdrawOffer(req.organizationId, req.params.id, req.body.withdrawalReason, req.user, requestMeta(req));
  res.json({ success: true, message: 'Offer withdrawn', data });
};
