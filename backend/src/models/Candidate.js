const { Schema, model } = require('mongoose');

const STATUSES = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'];
const SOURCES = ['CAREERS_PAGE', 'LINKEDIN', 'REFERRAL', 'JOB_BOARD', 'AGENCY', 'DIRECT_APPLICATION', 'OTHER'];

const resumeSchema = new Schema(
  {
    originalFileName: { type: String, trim: true },
    storageKey: { type: String },
    mimeType: { type: String },
    fileExtension: { type: String, lowercase: true },
    fileSize: { type: Number },
    checksum: { type: String },
    uploadedAt: { type: Date },
  },
  { _id: false }
);

const candidateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    currentCompany: { type: String, trim: true },
    currentJobTitle: { type: String, trim: true },
    yearsOfExperience: { type: Number, min: 0 },
    skills: { type: [String], default: [] },
    linkedinUrl: { type: String, trim: true },
    portfolioUrl: { type: String, trim: true },
    githubUrl: { type: String, trim: true },
    source: { type: String, enum: SOURCES, default: 'CAREERS_PAGE' },
    resume: { type: resumeSchema, default: undefined },
    status: { type: String, enum: STATUSES, default: 'NEW', index: true },
    tags: { type: [String], default: [] },
    assignedRecruiterId: { type: Schema.Types.ObjectId, ref: 'User' },
    convertedEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
  },
  { timestamps: true }
);

candidateSchema.index({ organizationId: 1, email: 1 }, { unique: true });
candidateSchema.index({ organizationId: 1, status: 1 });
candidateSchema.index({ organizationId: 1, skills: 1 });
candidateSchema.index({ organizationId: 1, tags: 1 });
candidateSchema.index({ organizationId: 1, createdAt: -1 });
candidateSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  currentCompany: 'text',
  currentJobTitle: 'text',
  skills: 'text',
});

candidateSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    if (ret.resume) delete ret.resume.storageKey;
    return ret;
  },
});

module.exports = model('Candidate', candidateSchema);
module.exports.CANDIDATE_STATUSES = STATUSES;
module.exports.CANDIDATE_SOURCES = SOURCES;
