const { Types } = require('mongoose');
const { AssetVendor, Asset, AssetMaintenance } = require('../models');
const AppError = require('../utils/AppError');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const auditLogService = require('./auditLogService');

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[asset-vendors] socket emit failed:', err);
  }
}

function toDTO(vendor) {
  return { ...vendor, id: vendor._id.toString() };
}

async function getVendors(organizationId, filters = {}) {
  const { search, page, limit } = filters;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { organizationId: new Types.ObjectId(organizationId) };
  if (filters.isActive === 'true') query.isActive = true;
  if (filters.isActive === 'false') query.isActive = false;
  if (!filters.includeInactive && filters.isActive === undefined) query.isActive = true;
  if (search && search.trim()) query.name = new RegExp(search.trim(), 'i');

  const [data, total] = await Promise.all([
    AssetVendor.find(query).sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
    AssetVendor.countDocuments(query),
  ]);

  const assetCounts = await Asset.aggregate([
    { $match: { organizationId: new Types.ObjectId(organizationId), isDeleted: false, vendorId: { $ne: null } } },
    { $group: { _id: '$vendorId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(assetCounts.map((c) => [c._id.toString(), c.count]));

  return {
    data: data.map((v) => ({ ...toDTO(v), assetCount: countMap.get(v._id.toString()) || 0 })),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
}

async function getVendorById(organizationId, id) {
  const vendor = await AssetVendor.findOne({ _id: id, organizationId: new Types.ObjectId(organizationId) }).lean();
  if (!vendor) throw new AppError('Vendor not found', 404);

  const oid = new Types.ObjectId(organizationId);
  const [assets, maintenanceRecords] = await Promise.all([
    Asset.find({ organizationId: oid, vendorId: vendor._id, isDeleted: false })
      .select('assetTag name status warrantyEndDate purchasePrice currency')
      .lean(),
    AssetMaintenance.find({ organizationId: oid, vendorId: vendor._id })
      .populate('assetId', 'assetTag name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  return {
    ...toDTO(vendor),
    assets: assets.map((a) => ({ ...a, id: a._id.toString() })),
    warrantyAssets: assets.filter((a) => a.warrantyEndDate).map((a) => ({ ...a, id: a._id.toString() })),
    maintenanceHistory: maintenanceRecords.map((m) => ({ ...m, id: m._id.toString() })),
  };
}

async function createVendor(organizationId, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const exists = await AssetVendor.findOne({ organizationId: orgId, name: payload.name.trim() });
  if (exists) throw new AppError('A vendor with this name already exists', 409);

  const vendor = await AssetVendor.create({
    organizationId: orgId,
    name: payload.name.trim(),
    contactPerson: payload.contactPerson || '',
    email: payload.email || '',
    phone: payload.phone || '',
    address: payload.address || '',
    website: payload.website || '',
    notes: payload.notes || '',
    createdBy: user._id,
  });

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'VENDOR_CREATED', entityType: 'AssetVendor', entityId: vendor._id,
    metadata: { name: vendor.name }, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_VENDOR_CREATED, { vendorId: vendor._id.toString(), name: vendor.name });

  return toDTO(vendor.toObject());
}

async function updateVendor(organizationId, id, payload, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const vendor = await AssetVendor.findOne({ _id: id, organizationId: orgId });
  if (!vendor) throw new AppError('Vendor not found', 404);

  if (payload.name && payload.name.trim() !== vendor.name) {
    const exists = await AssetVendor.findOne({
      organizationId: vendor.organizationId,
      name: payload.name.trim(),
      _id: { $ne: vendor._id },
    });
    if (exists) throw new AppError('A vendor with this name already exists', 409);
    vendor.name = payload.name.trim();
  }

  const fields = ['contactPerson', 'email', 'phone', 'address', 'website', 'notes', 'isActive'];
  fields.forEach((f) => {
    if (payload[f] !== undefined) vendor[f] = payload[f];
  });

  await vendor.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'VENDOR_UPDATED', entityType: 'AssetVendor', entityId: vendor._id,
    metadata: { name: vendor.name }, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_VENDOR_UPDATED, { vendorId: vendor._id.toString(), name: vendor.name });

  return toDTO(vendor.toObject());
}

// Soft delete only — vendors are referenced by asset purchase/maintenance history.
async function deleteVendor(organizationId, id, user, reqMeta = {}) {
  const orgId = new Types.ObjectId(organizationId);
  const vendor = await AssetVendor.findOne({ _id: id, organizationId: orgId });
  if (!vendor) throw new AppError('Vendor not found', 404);

  vendor.isActive = false;
  await vendor.save();

  await auditLogService.recordAction({
    organizationId: orgId, userId: user._id, action: 'VENDOR_UPDATED', entityType: 'AssetVendor', entityId: vendor._id,
    metadata: { name: vendor.name, deactivated: true }, ...reqMeta,
  });
  emitToOrg(orgId, SOCKET_EVENTS.ASSET_VENDOR_UPDATED, { vendorId: vendor._id.toString(), name: vendor.name });

  return { success: true, message: 'Vendor deactivated' };
}

module.exports = { getVendors, getVendorById, createVendor, updateVendor, deleteVendor };
