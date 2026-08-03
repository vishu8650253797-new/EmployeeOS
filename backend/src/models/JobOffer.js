const { Schema, model } = require('mongoose');

const STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'];

const jobOfferSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobOpening', required: true },
    salary: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, default: 'USD' },
    employmentType: { type: String, trim: true, default: 'FULL_TIME' },
    startDate: { type: Date },
    offerExpiryDate: { type: Date },
    benefits: { type: [String], default: [] },
    notes: { type: String, trim: true },
    status: { type: String, enum: STATUSES, default: 'DRAFT', index: true },
    // Cryptographically secure public token — never expose internal offer IDs publicly.
    publicToken: { type: String, select: false },
    withdrawalReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sentAt: { type: Date },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

jobOfferSchema.index({ organizationId: 1, candidateId: 1 });
jobOfferSchema.index({ organizationId: 1, applicationId: 1 });
jobOfferSchema.index({ organizationId: 1, status: 1 });
jobOfferSchema.index({ publicToken: 1 }, { sparse: true });

jobOfferSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    delete ret.publicToken;
    return ret;
  },
});

module.exports = model('JobOffer', jobOfferSchema);
module.exports.OFFER_STATUSES = STATUSES;
