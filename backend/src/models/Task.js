const { Schema, model } = require('mongoose');

const taskSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    taskKey: { type: String, required: true, uppercase: true, trim: true },
    status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'], default: 'TODO' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    assigneeIds: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    reporterId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date },
    dueDate: { type: Date },
    estimatedHours: { type: Number, min: 0 },
    actualHours: { type: Number, min: 0 },
    labels: [{ type: String, trim: true }],
    parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

taskSchema.index({ organizationId: 1, projectId: 1 });
taskSchema.index({ organizationId: 1, status: 1 });
taskSchema.index({ organizationId: 1, priority: 1 });
taskSchema.index({ organizationId: 1, assigneeIds: 1 });
taskSchema.index({ organizationId: 1, dueDate: 1 });
taskSchema.index({ organizationId: 1, taskKey: 1 });
taskSchema.index({ organizationId: 1, projectId: 1, createdAt: -1 });

module.exports = model('Task', taskSchema);
