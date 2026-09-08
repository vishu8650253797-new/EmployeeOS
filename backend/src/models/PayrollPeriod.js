const { Schema, model } = require('mongoose');

// The calendar dimension — one row per organization per calendar month.
// Distinct from PayrollRun (the stateful workflow entity): a period is a
// near-static fact that exists whether or not payroll has ever been run for
// it, while a run is the specific act of calculating/approving/finalizing pay
// for some employee scope within it. See PayrollRun.js.
const PERIOD_STATUSES = ['OPEN', 'PROCESSING', 'FINALIZED', 'CLOSED', 'CANCELLED'];

const payrollPeriodSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    month: { type: Number, required: true, min: 1, max: 12 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    payDate: { type: Date, required: true },
    status: { type: String, enum: PERIOD_STATUSES, default: 'OPEN', index: true },
    currentRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun' },
    finalizedAt: { type: Date },
    closedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

payrollPeriodSchema.index({ organizationId: 1, year: 1, month: 1 }, { unique: true });
payrollPeriodSchema.index({ organizationId: 1, status: 1 });

payrollPeriodSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('PayrollPeriod', payrollPeriodSchema);
module.exports.PERIOD_STATUSES = PERIOD_STATUSES;
