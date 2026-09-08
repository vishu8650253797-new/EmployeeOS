const { Schema, model } = require('mongoose');

// See SalaryComponent.js for the money-representation note (integer minor
// units + basis-point percentages) that applies to every payroll model.

// Shared shape for both SalaryStructure.components and
// EmployeeCompensation.componentOverrides — `value` is minor units when the
// referenced component is FIXED, or basis points (10000 = 100%) for any
// PERCENTAGE_* calculation type.
const componentEntrySchema = new Schema(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'SalaryComponent', required: true },
    value: { type: Number, required: true },
    isOverridable: { type: Boolean, default: true },
  },
  { _id: false }
);

const salaryStructureSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    // Required iff any component in `components` uses PERCENTAGE_OF_BASIC —
    // an explicit pointer rather than string-code matching, so it stays
    // correct even for orgs that don't literally name a component "BASIC".
    basicComponentId: { type: Schema.Types.ObjectId, ref: 'SalaryComponent' },
    components: { type: [componentEntrySchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

salaryStructureSchema.index({ organizationId: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
salaryStructureSchema.index({ organizationId: 1, isActive: 1 });

salaryStructureSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('SalaryStructure', salaryStructureSchema);
module.exports.componentEntrySchema = componentEntrySchema;
