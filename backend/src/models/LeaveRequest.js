const { Schema, model } = require('mongoose');

const leaveRequestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    numberOfDays: { type: Number, required: true, min: 0.5 },
    durationType: { type: String, enum: ['FULL_DAY', 'HALF_DAY'], default: 'FULL_DAY' },
    reason: { type: String, trim: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
    approvalLevel: { type: String, default: 'MANAGER' },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ organizationId: 1, status: 1 });
leaveRequestSchema.index({ organizationId: 1, employeeId: 1, startDate: -1 });

module.exports = model('LeaveRequest', leaveRequestSchema);
