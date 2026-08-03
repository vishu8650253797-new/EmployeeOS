const { Schema, model } = require('mongoose');

const RECOMMENDATIONS = ['STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO'];

const ratingField = { type: Number, min: 1, max: 5 };

const interviewFeedbackSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    interviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    technicalSkills: ratingField,
    communication: ratingField,
    problemSolving: ratingField,
    cultureFit: ratingField,
    overallRating: { ...ratingField, required: true },
    recommendation: { type: String, enum: RECOMMENDATIONS, required: true },
    strengths: { type: String, trim: true },
    weaknesses: { type: String, trim: true },
    comments: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

interviewFeedbackSchema.index({ organizationId: 1, interviewId: 1, interviewerId: 1 }, { unique: true });
interviewFeedbackSchema.index({ organizationId: 1, candidateId: 1 });

interviewFeedbackSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('InterviewFeedback', interviewFeedbackSchema);
module.exports.RECOMMENDATIONS = RECOMMENDATIONS;
