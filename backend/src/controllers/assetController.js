const assetService = require('../services/assetService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

function streamFile(res, { stream, size, filename, mimeType }, disposition) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', size);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

exports.getAssets = async (req, res) => {
  const { data, pagination } = await assetService.getAssets(req.organizationId, req.query, req.user);
  res.json({ success: true, data, pagination });
};

exports.getAssetById = async (req, res) => {
  const data = await assetService.getAssetById(req.organizationId, req.params.id, req.user);
  res.json({ success: true, data });
};

exports.createAsset = async (req, res) => {
  const data = await assetService.createAsset(req.organizationId, req.body, req.user, reqMeta(req));
  res.status(201).json({ success: true, message: 'Asset created', data });
};

exports.updateAsset = async (req, res) => {
  const data = await assetService.updateAsset(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset updated', data });
};

exports.deleteAsset = async (req, res) => {
  const result = await assetService.deleteAsset(req.organizationId, req.params.id, req.user, reqMeta(req));
  res.json(result);
};

exports.assignAsset = async (req, res) => {
  const data = await assetService.assignAsset(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset assigned', data });
};

exports.reassignAsset = async (req, res) => {
  const data = await assetService.reassignAsset(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset reassigned', data });
};

exports.returnAsset = async (req, res) => {
  const data = await assetService.returnAsset(req.organizationId, req.params.id, req.body, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset returned', data });
};

exports.markDamaged = async (req, res) => {
  const data = await assetService.transitionStatus(req.organizationId, req.params.id, 'MARK_DAMAGED', req.body.notes, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset marked damaged', data });
};

exports.markLost = async (req, res) => {
  const data = await assetService.transitionStatus(req.organizationId, req.params.id, 'MARK_LOST', req.body.notes, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset marked lost', data });
};

exports.recoverAsset = async (req, res) => {
  const data = await assetService.transitionStatus(req.organizationId, req.params.id, 'RECOVER', req.body.notes, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset marked recovered', data });
};

exports.retireAsset = async (req, res) => {
  const data = await assetService.transitionStatus(req.organizationId, req.params.id, 'RETIRE', req.body.notes, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset retired', data });
};

exports.disposeAsset = async (req, res) => {
  const data = await assetService.transitionStatus(req.organizationId, req.params.id, 'DISPOSE', req.body.notes, req.user, reqMeta(req));
  res.json({ success: true, message: 'Asset disposed', data });
};

exports.uploadAttachment = async (req, res) => {
  const data = await assetService.uploadAttachment(req.organizationId, req.params.id, req.file, req.body, req.user);
  res.status(201).json({ success: true, message: 'Attachment uploaded', data });
};

exports.downloadAttachment = async (req, res) => {
  const file = await assetService.downloadAttachment(req.organizationId, req.params.id, req.params.attachmentId, req.user);
  streamFile(res, file, 'attachment');
};

exports.deleteAttachment = async (req, res) => {
  const result = await assetService.deleteAttachment(req.organizationId, req.params.id, req.params.attachmentId, req.user);
  res.json(result);
};
