const { Schema, model } = require('mongoose');

const TYPES = ['PHONE_SCREEN', 'HR_INTERVIEW', 'TECHNICAL', 'BEHAVIORAL', 'MANAGERIAL', 'FINAL', 'OTHER'];
const STATUSES = ['SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const interviewSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobOpening', required: true },
    interviewType: { type: String, enum: TYPES, default: 'TECHNICAL' },
    title: { type: String, trim: true },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    timezone: { type: String, trim: true, default: 'UTC' },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    interviewerIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: STATUSES, default: 'SCHEDULED', index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

interviewSchema.index({ organizationId: 1, candidateId: 1 });
interviewSchema.index({ organizationId: 1, jobId: 1 });
interviewSchema.index({ organizationId: 1, scheduledStart: 1, scheduledEnd: 1 });
interviewSchema.index({ organizationId: 1, interviewerIds: 1, scheduledStart: 1 });

interviewSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('Interview', interviewSchema);
module.exports.INTERVIEW_TYPES = TYPES;
module.exports.INTERVIEW_STATUSES = STATUSES;
