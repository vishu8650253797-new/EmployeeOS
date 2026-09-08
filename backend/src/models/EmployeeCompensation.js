const { Schema, model } = require('mongoose');
const { componentEntrySchema } = require('./SalaryStructure');

// See SalaryComponent.js for the money-representation note that applies to
// every payroll model.

// Effective-dated assignment of a salary structure to an employee. A raise or
// promotion creates a NEW row (status ACTIVE) and supersedes the prior one —
// rows are never edited in place, so full compensation history is preserved.
const COMPENSATION_STATUSES = ['ACTIVE', 'SUPERSEDED', 'CANCELLED'];

const employeeCompensationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    structureId: { type: Schema.Types.ObjectId, ref: 'SalaryStructure', required: true },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    // Only for componentIds present in structure.components with isOverridable:true;
    // anything not overridden here falls back to the structure's own value.
    componentOverrides: { type: [componentEntrySchema], default: [] },
    ctcAnnualMinorUnits: { type: Number, min: 0 },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    status: { type: String, enum: COMPENSATION_STATUSES, default: 'ACTIVE', index: true },
    revisionReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

employeeCompensationSchema.index({ organizationId: 1, employeeId: 1, effectiveFrom: -1 });
// Guarantees exactly one ACTIVE compensation row per employee at the database
// level — the service also supersedes the prior row inside the same
// transaction as a first line of defense; this partial unique index is the
// concurrency-safe backstop against a race between two simultaneous requests.
employeeCompensationSchema.index(
  { organizationId: 1, employeeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

employeeCompensationSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('EmployeeCompensation', employeeCompensationSchema);
module.exports.COMPENSATION_STATUSES = COMPENSATION_STATUSES;
