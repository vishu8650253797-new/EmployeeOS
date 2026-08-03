const { Schema, model } = require('mongoose');

const STATUSES = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'];
const SOURCES = ['CAREERS_PAGE', 'LINKEDIN', 'REFERRAL', 'JOB_BOARD', 'AGENCY', 'DIRECT_APPLICATION', 'OTHER'];

const jobApplicationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobOpening', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    coverLetter: { type: String, trim: true },
    source: { type: String, enum: SOURCES, default: 'CAREERS_PAGE' },
    status: { type: String, enum: STATUSES, default: 'NEW', index: true },
    appliedAt: { type: Date, default: Date.now },
    lastStatusChangedAt: { type: Date, default: Date.now },
    rejectionReason: { type: String, trim: true },
    withdrawalReason: { type: String, trim: true },
    withdrawToken: { type: String, select: false },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ organizationId: 1, jobId: 1, candidateId: 1 }, { unique: true });
jobApplicationSchema.index({ organizationId: 1, jobId: 1, status: 1 });
jobApplicationSchema.index({ organizationId: 1, candidateId: 1 });
jobApplicationSchema.index({ organizationId: 1, appliedAt: -1 });

jobApplicationSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    delete ret.withdrawToken;
    return ret;
  },
});

module.exports = model('JobApplication', jobApplicationSchema);
module.exports.APPLICATION_STATUSES = STATUSES;
