const { Schema, model } = require('mongoose');

// The stateful workflow entity for processing pay within a PayrollPeriod. See
// PayrollPeriod.js for why the two are separate models. No unique "one run
// per period" index exists here on purpose — that invariant is enforced
// procedurally in payrollRunService (an atomic PayrollPeriod status flip) so
// a cancelled-and-redone run, or a REGULAR run followed by a later
// SUPPLEMENTARY run for the same period, can both legitimately coexist.
const RUN_TYPES = ['REGULAR', 'SUPPLEMENTARY'];
const RUN_STATUSES = [
  'DRAFT', 'PROCESSING', 'CALCULATED', 'FAILED',
  'SUBMITTED', 'APPROVED', 'REJECTED', 'FINALIZED', 'CANCELLED',
];
// FINALIZED and CANCELLED are terminal — no further transitions are allowed
// out of them. Enforced by payrollAccess.assertRunMutable in every mutating
// service function, and mirrored on PayrollRecord.isLocked as a schema-level
// backstop.
const TERMINAL_RUN_STATUSES = ['FINALIZED', 'CANCELLED'];

const failedEmployeeSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    error: { type: String, required: true },
  },
  { _id: false }
);

const payrollRunSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true, index: true },
    runType: { type: String, enum: RUN_TYPES, default: 'REGULAR' },
    status: { type: String, enum: RUN_STATUSES, default: 'DRAFT', index: true },
    // Explicit inclusion list for SUPPLEMENTARY runs; empty for REGULAR (= all eligible employees).
    employeeScope: { type: [{ type: Schema.Types.ObjectId, ref: 'Employee' }], default: [] },
    employeeCount: { type: Number, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    totalGrossMinorUnits: { type: Number, default: 0 },
    totalDeductionsMinorUnits: { type: Number, default: 0 },
    totalNetPayMinorUnits: { type: Number, default: 0 },
    totalEmployerCostMinorUnits: { type: Number, default: 0 },
    failedEmployees: { type: [failedEmployeeSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date },
    processingError: { type: String },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    finalizedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    finalizedAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true },
  },
  { timestamps: true }
);

payrollRunSchema.index({ organizationId: 1, payrollPeriodId: 1, status: 1 });
payrollRunSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

payrollRunSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('PayrollRun', payrollRunSchema);
module.exports.RUN_TYPES = RUN_TYPES;
module.exports.RUN_STATUSES = RUN_STATUSES;
module.exports.TERMINAL_RUN_STATUSES = TERMINAL_RUN_STATUSES;
