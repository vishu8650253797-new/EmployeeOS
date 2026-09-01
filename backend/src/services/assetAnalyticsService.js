const { Types } = require('mongoose');
const { Asset, AssetCategory, AssetMaintenance, Department } = require('../models');

const WARRANTY_WARNING_DAYS = Number(process.env.ASSET_WARRANTY_WARNING_DAYS) || 30;

async function getOverview(organizationId) {
  const oid = new Types.ObjectId(organizationId);
  const now = new Date();
  const warningBoundary = new Date(now.getTime() + WARRANTY_WARNING_DAYS * 24 * 60 * 60 * 1000);

  const [statusCounts] = await Asset.aggregate([
    { $match: { organizationId: oid, isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        available: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
        reserved: { $sum: { $cond: [{ $eq: ['$status', 'RESERVED'] }, 1, 0] } },
        assigned: { $sum: { $cond: [{ $eq: ['$status', 'ASSIGNED'] }, 1, 0] } },
        inMaintenance: { $sum: { $cond: [{ $eq: ['$status', 'IN_MAINTENANCE'] }, 1, 0] } },
        damaged: { $sum: { $cond: [{ $eq: ['$status', 'DAMAGED'] }, 1, 0] } },
        lost: { $sum: { $cond: [{ $eq: ['$status', 'LOST'] }, 1, 0] } },
        retired: { $sum: { $cond: [{ $eq: ['$status', 'RETIRED'] }, 1, 0] } },
        disposed: { $sum: { $cond: [{ $eq: ['$status', 'DISPOSED'] }, 1, 0] } },
      },
    },
  ]);

  const purchaseValueByCurrency = await Asset.aggregate([
    { $match: { organizationId: oid, isDeleted: false, purchasePrice: { $ne: null } } },
    { $group: { _id: '$currency', total: { $sum: '$purchasePrice' }, count: { $sum: 1 } } },
    { $project: { _id: 0, currency: '$_id', total: 1, count: 1 } },
  ]);

  const warrantyExpiringSoon = await Asset.countDocuments({
    organizationId: oid, isDeleted: false, warrantyEndDate: { $gte: now, $lte: warningBoundary },
  });

  const [maintenanceCost] = await AssetMaintenance.aggregate([
    { $match: { organizationId: oid } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$maintenanceCost', 0] } }, openCount: { $sum: { $cond: [{ $in: ['$status', ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_PARTS']] }, 1, 0] } } } },
  ]);

  return {
    totalAssets: statusCounts?.total || 0,
    available: statusCounts?.available || 0,
    reserved: statusCounts?.reserved || 0,
    assigned: statusCounts?.assigned || 0,
    inMaintenance: statusCounts?.inMaintenance || 0,
    damaged: statusCounts?.damaged || 0,
    lost: statusCounts?.lost || 0,
    retired: statusCounts?.retired || 0,
    disposed: statusCounts?.disposed || 0,
    warrantyExpiringSoon,
    purchaseValueByCurrency,
    openMaintenanceCount: maintenanceCost?.openCount || 0,
    totalMaintenanceCost: maintenanceCost?.total || 0,
  };
}

async function getStatusBreakdown(organizationId) {
  const oid = new Types.ObjectId(organizationId);
  const data = await Asset.aggregate([
    { $match: { organizationId: oid, isDeleted: false } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
    { $sort: { count: -1 } },
  ]);
  return data;
}

async function getCategoryBreakdown(organizationId) {
  const oid = new Types.ObjectId(organizationId);
  const data = await Asset.aggregate([
    { $match: { organizationId: oid, isDeleted: false } },
    {
      $group: {
        _id: '$categoryId',
        total: { $sum: 1 },
        assigned: { $sum: { $cond: [{ $eq: ['$status', 'ASSIGNED'] }, 1, 0] } },
        available: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
      },
    },
    { $lookup: { from: AssetCategory.collection.name, localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0, categoryId: '$_id', categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
        total: 1, assigned: 1, available: 1,
      },
    },
    { $sort: { total: -1 } },
  ]);
  return data;
}

async function getDepartmentBreakdown(organizationId) {
  const oid = new Types.ObjectId(organizationId);
  const data = await Asset.aggregate([
    { $match: { organizationId: oid, isDeleted: false, assignedDepartment: { $ne: null } } },
    { $group: { _id: '$assignedDepartment', total: { $sum: 1 } } },
    { $lookup: { from: Department.collection.name, localField: '_id', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, departmentId: '$_id', departmentName: { $ifNull: ['$department.name', 'Unassigned'] }, total: 1 } },
    { $sort: { total: -1 } },
  ]);
  return data;
}

async function getMaintenanceAnalytics(organizationId) {
  const oid = new Types.ObjectId(organizationId);
  const [statusCounts] = await AssetMaintenance.aggregate([
    { $match: { organizationId: oid } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $in: ['$status', ['ASSIGNED', 'IN_PROGRESS']] }, 1, 0] } },
        waitingForParts: { $sum: { $cond: [{ $eq: ['$status', 'WAITING_FOR_PARTS'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
        totalCost: { $sum: { $ifNull: ['$maintenanceCost', 0] } },
      },
    },
  ]);

  return {
    total: statusCounts?.total || 0,
    open: statusCounts?.open || 0,
    inProgress: statusCounts?.inProgress || 0,
    waitingForParts: statusCounts?.waitingForParts || 0,
    completed: statusCounts?.completed || 0,
    totalMaintenanceCost: statusCounts?.totalCost || 0,
  };
}

async function getWarrantyAnalytics(organizationId) {
  const oid = new Types.ObjectId(organizationId);
  const now = new Date();
  const warningBoundary = new Date(now.getTime() + WARRANTY_WARNING_DAYS * 24 * 60 * 60 * 1000);

  const baseMatch = { organizationId: oid, isDeleted: false, warrantyEndDate: { $ne: null } };
  const [active, expiringSoon, expired] = await Promise.all([
    Asset.countDocuments({ ...baseMatch, warrantyEndDate: { $gt: warningBoundary } }),
    Asset.find({ ...baseMatch, warrantyEndDate: { $gte: now, $lte: warningBoundary } })
      .populate('vendorId', 'name')
      .select('assetTag name warrantyEndDate vendorId')
      .sort({ warrantyEndDate: 1 })
      .limit(100)
      .lean(),
    Asset.find({ ...baseMatch, warrantyEndDate: { $lt: now } })
      .populate('vendorId', 'name')
      .select('assetTag name warrantyEndDate vendorId')
      .sort({ warrantyEndDate: -1 })
      .limit(100)
      .lean(),
  ]);

  const withDaysRemaining = (assets) =>
    assets.map((a) => ({
      ...a,
      id: a._id.toString(),
      daysRemaining: Math.ceil((new Date(a.warrantyEndDate) - now) / (1000 * 60 * 60 * 24)),
    }));

  return {
    activeCount: active,
    expiringSoonCount: expiringSoon.length,
    expiredCount: expired.length,
    warningDays: WARRANTY_WARNING_DAYS,
    expiringAssets: withDaysRemaining(expiringSoon),
    expiredAssets: withDaysRemaining(expired),
  };
}

module.exports = {
  getOverview,
  getStatusBreakdown,
  getCategoryBreakdown,
  getDepartmentBreakdown,
  getMaintenanceAnalytics,
  getWarrantyAnalytics,
};
