const { Schema, model } = require('mongoose');

const leaveBalanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true, index: true },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    allocatedDays: { type: Number, required: true, min: 0, default: 0 },
    usedDays: { type: Number, default: 0, min: 0 },
    pendingDays: { type: Number, default: 0, min: 0 },
    remainingDays: { type: Number, default: 0, min: 0 },
    carriedForwardDays: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ organizationId: 1, employeeId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

module.exports = model('LeaveBalance', leaveBalanceSchema);
