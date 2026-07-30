const { Types } = require('mongoose');
const { EmployeeDocument, DocumentCategory, DocumentRequest, Employee } = require('../models');
const { EXPIRY_WARNING_DAYS_DEFAULT } = require('../utils/documentExpiry');

async function getOverview(organizationId) {
  const oid = new Types.ObjectId(organizationId);

  const [totals] = await EmployeeDocument.aggregate([
    { $match: { organizationId: oid, isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'VERIFIED'] }, 1, 0] } },
        pendingVerification: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'PENDING'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'REJECTED'] }, 1, 0] } },
      },
    },
  ]);

  // Computed live from expiryDate rather than the persisted `status` field,
  // which only flips ACTIVE -> EXPIRED once a day when the cron job runs —
  // a document past its expiry date should show as expired immediately,
  // not lag behind by up to 24 hours.
  const now = new Date();
  const warningBoundary = new Date(now.getTime() + EXPIRY_WARNING_DAYS_DEFAULT * 24 * 60 * 60 * 1000);
  const [expiringSoon, expired] = await Promise.all([
    EmployeeDocument.countDocuments({
      organizationId: oid, isDeleted: false, status: { $ne: 'ARCHIVED' }, expiryDate: { $gte: now, $lte: warningBoundary },
    }),
    EmployeeDocument.countDocuments({
      organizationId: oid, isDeleted: false, status: { $ne: 'ARCHIVED' }, expiryDate: { $lt: now },
    }),
  ]);

  const [requestTotals] = await DocumentRequest.aggregate([
    { $match: { organizationId: oid } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $in: ['$status', ['PENDING', 'UPLOADED', 'UNDER_REVIEW']] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'REJECTED', 'CANCELLED']] }, 1, 0] } },
      },
    },
  ]);

  const requestCompletionRate = requestTotals?.total ? Math.round((requestTotals.completed / requestTotals.total) * 100) : 0;

  return {
    totalDocuments: totals?.total || 0,
    verified: totals?.verified || 0,
    pendingVerification: totals?.pendingVerification || 0,
    rejected: totals?.rejected || 0,
    expiringSoon,
    expired,
    pendingRequests: requestTotals?.pending || 0,
    requestCompletionRate,
  };
}

async function getExpiryAnalytics(organizationId) {
  const oid = new Types.ObjectId(organizationId);
  const now = new Date();
  const warningBoundary = new Date(now.getTime() + EXPIRY_WARNING_DAYS_DEFAULT * 24 * 60 * 60 * 1000);

  const baseMatch = { organizationId: oid, isDeleted: false };
  const [total, noExpiry, expired, expiringSoon] = await Promise.all([
    EmployeeDocument.countDocuments(baseMatch),
    EmployeeDocument.countDocuments({ ...baseMatch, expiryDate: null }),
    EmployeeDocument.countDocuments({ ...baseMatch, expiryDate: { $lt: now } }),
    EmployeeDocument.countDocuments({ ...baseMatch, expiryDate: { $gte: now, $lte: warningBoundary } }),
  ]);
  const valid = Math.max(total - noExpiry - expired - expiringSoon, 0);

  return { total, valid, expiringSoon, expired, noExpiry, warningDays: EXPIRY_WARNING_DAYS_DEFAULT };
}

async function getCategoryAnalytics(organizationId) {
  const oid = new Types.ObjectId(organizationId);

  const data = await EmployeeDocument.aggregate([
    { $match: { organizationId: oid, isDeleted: false } },
    {
      $group: {
        _id: '$categoryId',
        total: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'VERIFIED'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'PENDING'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'REJECTED'] }, 1, 0] } },
      },
    },
    { $lookup: { from: DocumentCategory.collection.name, localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        categoryName: { $ifNull: ['$category.name', 'Unknown'] },
        total: 1, verified: 1, pending: 1, rejected: 1,
      },
    },
    { $sort: { total: -1 } },
  ]);

  return data;
}

async function getDepartmentAnalytics(organizationId) {
  const oid = new Types.ObjectId(organizationId);

  const data = await EmployeeDocument.aggregate([
    { $match: { organizationId: oid, isDeleted: false } },
    { $lookup: { from: Employee.collection.name, localField: 'employeeId', foreignField: '_id', as: 'employee' } },
    { $unwind: '$employee' },
    {
      $group: {
        _id: '$employee.departmentId',
        total: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'VERIFIED'] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        departmentId: '$_id',
        departmentName: { $ifNull: ['$department.name', 'Unassigned'] },
        total: 1, verified: 1,
      },
    },
    { $sort: { total: -1 } },
  ]);

  return data;
}

async function getComplianceReport(organizationId, filters = {}) {
  const oid = new Types.ObjectId(organizationId);

  const mandatoryCategories = await DocumentCategory.find({ organizationId: oid, isActive: true, isMandatory: true }).lean();
  if (!mandatoryCategories.length) {
    return { data: [], mandatoryCategoryCount: 0, averageCompliance: 100 };
  }
  const mandatoryCategoryIds = mandatoryCategories.map((c) => c._id);

  const employeeQuery = { organizationId: oid, isDeleted: false, status: 'ACTIVE' };
  if (filters.departmentId) employeeQuery.departmentId = new Types.ObjectId(filters.departmentId);
  if (filters.employeeId) employeeQuery._id = new Types.ObjectId(filters.employeeId);

  const employees = await Employee.find(employeeQuery).select('firstName lastName employeeId departmentId').lean();

  const fulfilled = await EmployeeDocument.aggregate([
    {
      $match: {
        organizationId: oid, isDeleted: false, status: 'ACTIVE', verificationStatus: 'VERIFIED',
        categoryId: { $in: mandatoryCategoryIds },
      },
    },
    { $group: { _id: { employeeId: '$employeeId', categoryId: '$categoryId' } } },
  ]);
  const fulfilledSet = new Set(fulfilled.map((f) => `${f._id.employeeId}:${f._id.categoryId}`));

  const data = employees.map((emp) => {
    const missing = mandatoryCategories.filter((c) => !fulfilledSet.has(`${emp._id}:${c._id}`));
    const completed = mandatoryCategories.length - missing.length;
    return {
      employeeId: emp._id.toString(),
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      employeeCode: emp.employeeId,
      departmentId: emp.departmentId ? emp.departmentId.toString() : null,
      requiredCount: mandatoryCategories.length,
      completedCount: completed,
      compliancePercent: Math.round((completed / mandatoryCategories.length) * 100),
      missingCategories: missing.map((c) => c.name),
    };
  });

  const averageCompliance = data.length
    ? Math.round(data.reduce((sum, d) => sum + d.compliancePercent, 0) / data.length)
    : 100;

  return { data, mandatoryCategoryCount: mandatoryCategories.length, averageCompliance };
}

module.exports = { getOverview, getExpiryAnalytics, getCategoryAnalytics, getDepartmentAnalytics, getComplianceReport };
