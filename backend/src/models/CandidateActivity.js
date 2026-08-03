const { Schema, model } = require('mongoose');

const ACTIVITY_TYPES = [
  'APPLICATION_SUBMITTED',
  'STATUS_CHANGED',
  'CANDIDATE_ASSIGNED',
  'NOTE_ADDED',
  'TAGS_UPDATED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_RESCHEDULED',
  'INTERVIEW_CANCELLED',
  'INTERVIEW_COMPLETED',
  'FEEDBACK_SUBMITTED',
  'OFFER_CREATED',
  'OFFER_SENT',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'OFFER_WITHDRAWN',
  'CANDIDATE_REJECTED',
  'CANDIDATE_WITHDRAWN',
  'CANDIDATE_HIRED',
];

const candidateActivitySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication' },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    description: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

candidateActivitySchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 });

candidateActivitySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('CandidateActivity', candidateActivitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
