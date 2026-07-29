const { Schema, model } = require('mongoose');

const leaveTypeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    totalDays: { type: Number, required: true, min: 0, default: 0 },
    isPaid: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: true },
    allowHalfDay: { type: Boolean, default: false },
    allowCarryForward: { type: Boolean, default: false },
    maxCarryForwardDays: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

leaveTypeSchema.index({ organizationId: 1, code: 1 }, { unique: true });

module.exports = model('LeaveType', leaveTypeSchema);
