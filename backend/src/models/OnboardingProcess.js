const { Schema, model } = require('mongoose');

const PROCESS_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const onboardingProcessSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'OnboardingTemplate' },
    type: { type: String, enum: ['ONBOARDING', 'OFFBOARDING'], required: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: PROCESS_STATUSES, default: 'NOT_STARTED', index: true },
    startDate: { type: Date, required: true },
    targetDate: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String, trim: true },
    joiningDateConfirmed: { type: Boolean, default: false },
    joiningDateConfirmedAt: { type: Date },
    joiningDateConfirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

onboardingProcessSchema.index({ organizationId: 1, employeeId: 1, type: 1 });
onboardingProcessSchema.index({ organizationId: 1, status: 1, targetDate: 1 });

onboardingProcessSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('OnboardingProcess', onboardingProcessSchema);
module.exports.PROCESS_STATUSES = PROCESS_STATUSES;
