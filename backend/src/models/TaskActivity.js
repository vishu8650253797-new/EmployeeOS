const { Schema, model } = require('mongoose');

const taskActivitySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    action: {
      type: String,
      enum: [
        'TASK_CREATED',
        'TASK_UPDATED',
        'TASK_ASSIGNED',
        'TASK_UNASSIGNED',
        'STATUS_CHANGED',
        'PRIORITY_CHANGED',
        'COMMENT_ADDED',
        'COMMENT_UPDATED',
        'COMMENT_DELETED',
        'TASK_COMPLETED',
      ],
      required: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

taskActivitySchema.index({ organizationId: 1, taskId: 1 });
taskActivitySchema.index({ organizationId: 1, taskId: 1, createdAt: -1 });

module.exports = model('TaskActivity', taskActivitySchema);
