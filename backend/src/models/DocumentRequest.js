const { Schema, model } = require('mongoose');

const documentRequestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'DocumentCategory', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    dueDate: { type: Date },
    documentId: { type: Schema.Types.ObjectId, ref: 'EmployeeDocument' },
    submittedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

documentRequestSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
documentRequestSchema.index({ organizationId: 1, status: 1, dueDate: 1 });

documentRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('DocumentRequest', documentRequestSchema);
