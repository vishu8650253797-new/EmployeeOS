const { Schema, model } = require('mongoose');

const candidateNoteSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    isPrivate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

candidateNoteSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 });

candidateNoteSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('CandidateNote', candidateNoteSchema);
