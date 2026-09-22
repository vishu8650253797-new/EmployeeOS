const { Schema, model } = require('mongoose');

// Employee-initiated HR self-service requests (Step 12E) — e.g. "salary
// certificate", "experience letter", a general HR inquiry. Distinct from
// DocumentRequest (HR asks an employee to upload a compliance document —
// the opposite direction) and not intended to grow into a full helpdesk/
// ticketing system (that is a separate, later module).

const HR_REQUEST_CATEGORIES = [
  'EMPLOYMENT_LETTER',
  'SALARY_CERTIFICATE',
  'EXPERIENCE_LETTER',
  'PERSONAL_INFO_UPDATE',
  'PAYROLL_CLARIFICATION',
  'LEAVE_CLARIFICATION',
  'BENEFITS_INQUIRY',
  'DOCUMENT_REQUEST',
  'GENERAL_INQUIRY',
  'OTHER',
];

const HR_REQUEST_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED', 'CANCELLED'];

// Fully frozen — no further status change or conversation, by either party.
const LOCKED_STATUSES = ['CLOSED', 'CANCELLED'];
// An employee may only cancel before HR has actually started working it.
const CANCELLABLE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

const messageSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

const statusHistoryEntrySchema = new Schema(
  {
    status: { type: String, enum: HR_REQUEST_STATUSES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, _id: false }
);

const hrRequestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    category: { type: String, enum: HR_REQUEST_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: HR_REQUEST_STATUSES, default: 'SUBMITTED', index: true },
    messages: [messageSchema],
    statusHistory: [statusHistoryEntrySchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

hrRequestSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 });
hrRequestSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

hrRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('HrRequest', hrRequestSchema);
module.exports.HR_REQUEST_CATEGORIES = HR_REQUEST_CATEGORIES;
module.exports.HR_REQUEST_STATUSES = HR_REQUEST_STATUSES;
module.exports.LOCKED_STATUSES = LOCKED_STATUSES;
module.exports.CANCELLABLE_STATUSES = CANCELLABLE_STATUSES;
