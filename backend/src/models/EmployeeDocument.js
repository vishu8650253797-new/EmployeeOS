const { Schema, model } = require('mongoose');

const STATUSES = ['ACTIVE', 'EXPIRED', 'ARCHIVED'];
const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

const reminderSchema = new Schema(
  {
    threshold: { type: Number, required: true },
    sentAt: { type: Date, required: true },
  },
  { _id: false }
);

const employeeDocumentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'DocumentCategory', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    documentNumber: { type: String, trim: true },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    originalFileName: { type: String, required: true, trim: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileExtension: { type: String, required: true, lowercase: true },
    fileSize: { type: Number, required: true },
    checksum: { type: String },
    currentVersion: { type: Number, default: 1 },
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING', index: true },
    isConfidential: { type: Boolean, default: false },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    remindersSent: { type: [reminderSchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

employeeDocumentSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
employeeDocumentSchema.index({ organizationId: 1, categoryId: 1 });
employeeDocumentSchema.index({ organizationId: 1, expiryDate: 1 });
employeeDocumentSchema.index({ organizationId: 1, isDeleted: 1 });
employeeDocumentSchema.index({ organizationId: 1, verificationStatus: 1 });

employeeDocumentSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    delete ret.storageKey;
    return ret;
  },
});

module.exports = model('EmployeeDocument', employeeDocumentSchema);
