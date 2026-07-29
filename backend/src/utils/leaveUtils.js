function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isWeekend(date) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

function countWorkingDays(startDate, endDate, halfDay = false) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current)) count += 1;
    current.setDate(current.getDate() + 1);
  }
  return halfDay ? count * 0.5 : count;
}

async function hasOverlap(organizationId, employeeId, startDate, endDate, excludeId = null) {
  const { Types } = require('mongoose');
  const { LeaveRequest } = require('../models');
  const filter = {
    organizationId: new Types.ObjectId(organizationId),
    employeeId: new Types.ObjectId(employeeId),
    status: { $in: ['PENDING', 'APPROVED'] },
    $or: [
      { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } },
    ],
  };
  if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };
  return await LeaveRequest.countDocuments(filter);
}

module.exports = { addDays, isWeekend, countWorkingDays, hasOverlap };
