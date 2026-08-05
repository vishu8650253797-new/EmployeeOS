const { Schema, model } = require('mongoose');

const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

const onboardingTaskSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    processId: { type: Schema.Types.ObjectId, ref: 'OnboardingProcess', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ['DOCUMENTATION', 'IT_SETUP', 'TRAINING', 'HR', 'FINANCE', 'FACILITIES', 'COMPLIANCE', 'HANDOVER', 'OTHER'],
      default: 'OTHER',
    },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date },
    status: { type: String, enum: TASK_STATUSES, default: 'PENDING', index: true },
    order: { type: Number, default: 0 },
    isRequired: { type: Boolean, default: true },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

onboardingTaskSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });
onboardingTaskSchema.index({ processId: 1, order: 1 });

onboardingTaskSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('OnboardingTask', onboardingTaskSchema);
module.exports.TASK_STATUSES = TASK_STATUSES;
