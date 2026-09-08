const { Schema, model } = require('mongoose');

// One document per employee per run — and also the source of truth for that
// employee's payslip. A payslip is not a distinct entity: it is exactly this
// same earnings/deductions/net data, viewed read-only once the parent run is
// FINALIZED. A separate Payslip model would duplicate every field and create
// a synchronization hazard, so payslipService reads directly from this
// collection with access scoping instead. See SalaryComponent.js for the
// money-representation note that applies to every payroll model.
const RECORD_STATUSES = ['CALCULATED', 'ADJUSTED', 'FINALIZED', 'CANCELLED'];

const lineItemSchema = new Schema(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'SalaryComponent', required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    amountMinorUnits: { type: Number, required: true },
    isProrated: { type: Boolean, default: false },
  },
  { _id: false }
);

// Denormalized at process time — same rationale as Offboarding snapshotting
// assigned assets at approval time: a payslip must stay stable/readable even
// if the employee is later renamed, moved departments, or deleted.
const employeeSnapshotSchema = new Schema(
  {
    employeeCode: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    jobTitle: { type: String },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    departmentName: { type: String },
  },
  { _id: false }
);

const payrollRecordSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun', required: true, index: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    employeeSnapshot: { type: employeeSnapshotSchema, default: {} },
    structureId: { type: Schema.Types.ObjectId, ref: 'SalaryStructure' },
    compensationId: { type: Schema.Types.ObjectId, ref: 'EmployeeCompensation' },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    paidDays: { type: Number, required: true, min: 0 },
    totalDaysInPeriod: { type: Number, required: true, min: 1 },
    earnings: { type: [lineItemSchema], default: [] },
    deductions: { type: [lineItemSchema], default: [] },
    employerContributions: { type: [lineItemSchema], default: [] },
    grossMinorUnits: { type: Number, required: true, default: 0 },
    totalDeductionsMinorUnits: { type: Number, required: true, default: 0 },
    netPayMinorUnits: { type: Number, required: true, default: 0 },
    totalEmployerCostMinorUnits: { type: Number, required: true, default: 0 },
    status: { type: String, enum: RECORD_STATUSES, default: 'CALCULATED', index: true },
    adjustmentNote: { type: String, trim: true },
    // Flips true at finalize — a schema-level backstop alongside the
    // service-level payrollAccess.assertRunMutable check, so any future
    // direct-model code path still has a visible, queryable lock to respect.
    isLocked: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Hard guarantee against double-paying an employee for the same calendar
// period, across any run type — mirrors LeaveBalance's compound-unique
// pattern (organizationId, employeeId, leaveTypeId, year).
payrollRecordSchema.index({ organizationId: 1, employeeId: 1, payrollPeriodId: 1 }, { unique: true });
payrollRecordSchema.index({ organizationId: 1, payrollRunId: 1, status: 1 });
payrollRecordSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 });

payrollRecordSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('PayrollRecord', payrollRecordSchema);
module.exports.RECORD_STATUSES = RECORD_STATUSES;
