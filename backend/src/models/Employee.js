const { Schema, model } = require('mongoose');

const ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE', 'IT_ADMIN'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ON_LEAVE'];
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const emergencyContactSchema = new Schema(
  {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const addressSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    postalCode: { type: String, trim: true },
  },
  { _id: false }
);

// Sensitive: `select: false` keeps these off every default find/lean/toJSON.
// Not encrypted at rest — a known, deliberately deferred gap (see Step 10B-1 plan).
const bankDetailsSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true, select: false },
    bankName: { type: String, trim: true },
    branchName: { type: String, trim: true },
    routingCode: { type: String, trim: true }, // generic: IFSC / ABA routing / SWIFT / sort code
    currency: { type: String, trim: true },
    updatedAt: { type: Date },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const taxInfoSchema = new Schema(
  {
    taxId: { type: String, trim: true, select: false }, // generic: PAN / SSN / NIN / TIN
    taxRegime: { type: String, trim: true },
    taxCountry: { type: String, trim: true },
    updatedAt: { type: Date },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const employeeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    avatar: { type: String },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    jobTitle: { type: String, required: true, trim: true },
    manager: { type: String, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    role: { type: String, enum: ROLES, default: 'EMPLOYEE' },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'FULL_TIME' },
    status: { type: String, enum: STATUSES, default: 'ACTIVE' },
    joiningDate: { type: Date, required: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: GENDERS },
    address: { type: addressSchema, default: {} },
    location: { type: String, trim: true },
    emergencyContact: { type: emergencyContactSchema, default: {} },
    bankDetails: { type: bankDetailsSchema, default: {} },
    taxInfo: { type: taxInfoSchema, default: {} },
    avatarStorageKey: { type: String, select: false },
    avatarMimeType: { type: String, select: false },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

employeeSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ organizationId: 1, email: 1 }, { unique: true });
employeeSchema.index({ organizationId: 1, departmentId: 1, status: 1 });
employeeSchema.index({ organizationId: 1, isDeleted: 1 });
employeeSchema.index({ organizationId: 1, isDeleted: 1, createdAt: -1 });

employeeSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    ret.attendanceSummary = ret.attendanceSummary || { present: 0, absent: 0, late: 0, onLeave: 0, rate: 0 };
    ret.leaveBalance = ret.leaveBalance || { casual: 0, sick: 0, earned: 0 };
    return ret;
  },
});

module.exports = model('Employee', employeeSchema);
