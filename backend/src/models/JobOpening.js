const { Schema, model } = require('mongoose');

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID'];
const EXPERIENCE_LEVELS = ['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR'];
const STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'CANCELLED'];

const jobOpeningSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    location: { type: String, trim: true },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'FULL_TIME' },
    workMode: { type: String, enum: WORK_MODES, default: 'ONSITE' },
    experienceLevel: { type: String, enum: EXPERIENCE_LEVELS, default: 'MID' },
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    salaryCurrency: { type: String, trim: true, default: 'USD' },
    description: { type: String, trim: true },
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    qualifications: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    numberOfOpenings: { type: Number, default: 1, min: 1 },
    hiringManagerId: { type: Schema.Types.ObjectId, ref: 'User' },
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: STATUSES, default: 'DRAFT', index: true },
    publishedAt: { type: Date },
    closingDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

jobOpeningSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
jobOpeningSchema.index({ organizationId: 1, status: 1 });
jobOpeningSchema.index({ organizationId: 1, departmentId: 1 });
jobOpeningSchema.index({ organizationId: 1, location: 1 });
jobOpeningSchema.index({ organizationId: 1, createdAt: -1 });
jobOpeningSchema.index({ status: 1, publishedAt: -1 }); // public careers listing

jobOpeningSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('JobOpening', jobOpeningSchema);
module.exports.EMPLOYMENT_TYPES = EMPLOYMENT_TYPES;
module.exports.WORK_MODES = WORK_MODES;
module.exports.EXPERIENCE_LEVELS = EXPERIENCE_LEVELS;
module.exports.JOB_STATUSES = STATUSES;
