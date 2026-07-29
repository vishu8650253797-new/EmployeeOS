const { Schema, model } = require('mongoose');

const taskCommentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    content: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

taskCommentSchema.index({ organizationId: 1, taskId: 1 });
taskCommentSchema.index({ organizationId: 1, taskId: 1, createdAt: -1 });

module.exports = model('TaskComment', taskCommentSchema);
