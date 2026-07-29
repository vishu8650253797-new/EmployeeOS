const { Schema, model } = require('mongoose');

const projectSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'], default: 'PLANNING' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    startDate: { type: Date },
    dueDate: { type: Date },
    completedAt: { type: Date },
    ownerId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, key: 1 }, { unique: true });
projectSchema.index({ organizationId: 1, status: 1 });
projectSchema.index({ organizationId: 1, ownerId: 1 });
projectSchema.index({ organizationId: 1, departmentId: 1 });

module.exports = model('Project', projectSchema);
