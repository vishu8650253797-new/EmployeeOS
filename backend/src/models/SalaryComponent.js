const { Schema, model } = require('mongoose');

// Money fields in payroll models are integer MINOR units (e.g. paise, cents) —
// NOT major units like JobOffer.salary/Asset.purchasePrice elsewhere in the
// codebase. Payroll uniquely does repeated derived arithmetic (percentage-of-
// basic/gross, proration) where float drift would silently corrupt payslip
// totals. Percentage values are integer basis points (10000 = 100%). See
// backend/src/utils/payrollMoney.js and payrollCalculationEngine.js.

// EMPLOYER_CONTRIBUTION affects employer-cost/CTC reporting only — it is never
// added to or subtracted from an employee's earnings/deductions/net pay.
const COMPONENT_TYPES = ['EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION'];
const CALCULATION_TYPES = ['FIXED', 'PERCENTAGE_OF_BASIC', 'PERCENTAGE_OF_GROSS', 'PERCENTAGE_OF_COMPONENT'];

const salaryComponentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: COMPONENT_TYPES, required: true },
    calculationType: { type: String, enum: CALCULATION_TYPES, required: true },
    // Required iff calculationType === 'PERCENTAGE_OF_COMPONENT'; validated in salaryComponentService.
    percentageOfComponentId: { type: Schema.Types.ObjectId, ref: 'SalaryComponent' },
    isStatutory: { type: Boolean, default: false },
    isTaxable: { type: Boolean, default: true },
    isProratable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

salaryComponentSchema.index({ organizationId: 1, code: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
salaryComponentSchema.index({ organizationId: 1, type: 1, isActive: 1 });

salaryComponentSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('SalaryComponent', salaryComponentSchema);
module.exports.COMPONENT_TYPES = COMPONENT_TYPES;
module.exports.CALCULATION_TYPES = CALCULATION_TYPES;
