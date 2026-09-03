const { Schema, model } = require('mongoose');

const OFFBOARDING_TYPES = ['RESIGNATION', 'TERMINATION', 'RETIREMENT', 'CONTRACT_END', 'LAYOFF', 'OTHER'];

const OFFBOARDING_STATUSES = [
  'DRAFT', 'INITIATED', 'PENDING_APPROVAL', 'APPROVED', 'NOTICE_PERIOD',
  'CLEARANCE_IN_PROGRESS', 'FINAL_REVIEW', 'COMPLETED', 'CANCELLED', 'REJECTED',
];

const APPROVAL_STATUSES = ['PENDING', 'MANAGER_APPROVED', 'APPROVED', 'REJECTED'];
const APPROVAL_STEP_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'];

const CLEARANCE_DEPARTMENTS = ['HR', 'MANAGER', 'IT', 'FINANCE', 'ADMIN'];
const CLEARANCE_STATUSES = ['PENDING', 'IN_PROGRESS', 'CLEARED', 'REJECTED', 'NOT_APPLICABLE'];
const AGGREGATE_CLEARANCE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'CLEARED', 'BLOCKED'];

const ASSET_CLEARANCE_STATUSES = ['NOT_APPLICABLE', 'PENDING', 'PARTIAL', 'CLEARED'];
const DOCUMENT_CLEARANCE_STATUSES = ['NOT_APPLICABLE', 'PENDING', 'PARTIAL', 'CLEARED'];

const EXIT_INTERVIEW_STATUSES = ['NOT_SCHEDULED', 'SCHEDULED', 'COMPLETED', 'WAIVED'];
const ACCESS_DEACTIVATION_STATUSES = ['PENDING', 'SCHEDULED', 'DEACTIVATED', 'FAILED', 'NOT_REQUIRED'];
const KNOWLEDGE_TRANSFER_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_REQUIRED'];
const FINAL_SETTLEMENT_STATUSES = ['NOT_READY', 'READY'];

const approvalStepSchema = new Schema(
  {
    required: { type: Boolean, default: true },
    status: { type: String, enum: APPROVAL_STEP_STATUSES, default: 'PENDING' },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date },
    comments: { type: String, trim: true },
  },
  { _id: false }
);

const clearanceSchema = new Schema(
  {
    department: { type: String, enum: CLEARANCE_DEPARTMENTS, required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: CLEARANCE_STATUSES, default: 'PENDING' },
    comments: { type: String, trim: true },
    dueDate: { type: Date },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const exitInterviewSchema = new Schema(
  {
    status: { type: String, enum: EXIT_INTERVIEW_STATUSES, default: 'NOT_SCHEDULED' },
    scheduledDate: { type: Date },
    interviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
    reasonForLeaving: { type: String, trim: true },
    feedback: { type: String, trim: true },
    suggestions: { type: String, trim: true },
    satisfactionRating: { type: Number, min: 1, max: 5 },
    managementFeedback: { type: String, trim: true },
    workplaceFeedback: { type: String, trim: true },
    rehireEligible: { type: Boolean },
    interviewerNotes: { type: String, trim: true },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const knowledgeTransferSchema = new Schema(
  {
    status: { type: String, enum: KNOWLEDGE_TRANSFER_STATUSES, default: 'NOT_STARTED' },
    handoverOwnerId: { type: Schema.Types.ObjectId, ref: 'User' },
    replacementEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    projects: { type: String, trim: true },
    responsibilities: { type: String, trim: true },
    documentationLinks: { type: String, trim: true },
    pendingTasks: { type: String, trim: true },
    comments: { type: String, trim: true },
    completedAt: { type: Date },
  },
  { _id: false }
);

const accessDeactivationSchema = new Schema(
  {
    status: { type: String, enum: ACCESS_DEACTIVATION_STATUSES, default: 'PENDING' },
    requestedDate: { type: Date },
    scheduledDate: { type: Date },
    completedDate: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    comments: { type: String, trim: true },
  },
  { _id: false }
);

const finalSettlementSchema = new Schema(
  {
    status: { type: String, enum: FINAL_SETTLEMENT_STATUSES, default: 'NOT_READY' },
    leaveBalanceReference: { type: Schema.Types.Mixed },
    pendingDeductionsReference: { type: Schema.Types.Mixed },
    preparedAt: { type: Date },
    preparedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const offboardingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    offboardingType: { type: String, enum: OFFBOARDING_TYPES, required: true },
    reason: { type: String, trim: true },
    subReason: { type: String, trim: true },

    resignationDate: { type: Date },
    terminationDate: { type: Date },
    lastWorkingDate: { type: Date, required: true },

    noticePeriodDays: { type: Number, min: 0, default: 0 },
    noticePeriodStartDate: { type: Date },
    noticePeriodEndDate: { type: Date },

    status: { type: String, enum: OFFBOARDING_STATUSES, default: 'DRAFT', index: true },

    managerApproval: { type: approvalStepSchema, default: () => ({}) },
    hrApproval: { type: approvalStepSchema, default: () => ({}) },
    approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: 'PENDING' },

    exitInterview: { type: exitInterviewSchema, default: () => ({}) },
    exitInterviewStatus: { type: String, enum: EXIT_INTERVIEW_STATUSES, default: 'NOT_SCHEDULED' },

    clearances: { type: [clearanceSchema], default: [] },
    clearanceStatus: { type: String, enum: AGGREGATE_CLEARANCE_STATUSES, default: 'NOT_STARTED' },

    // Snapshotted at approval time — the assets assigned to the employee when the
    // notice period started. Clearance is tracked against this fixed set rather than
    // "assets currently assigned", since a returned asset no longer has assignedTo set
    // and would otherwise be indistinguishable from an employee who never had assets.
    assetIds: [{ type: Schema.Types.ObjectId, ref: 'Asset' }],
    assetClearanceStatus: { type: String, enum: ASSET_CLEARANCE_STATUSES, default: 'NOT_APPLICABLE' },

    documentRequestIds: [{ type: Schema.Types.ObjectId, ref: 'DocumentRequest' }],
    documentClearanceStatus: { type: String, enum: DOCUMENT_CLEARANCE_STATUSES, default: 'NOT_APPLICABLE' },

    finalSettlement: { type: finalSettlementSchema, default: () => ({}) },
    finalSettlementStatus: { type: String, enum: FINAL_SETTLEMENT_STATUSES, default: 'NOT_READY' },

    accessDeactivation: { type: accessDeactivationSchema, default: () => ({}) },
    accessDeactivationStatus: { type: String, enum: ACCESS_DEACTIVATION_STATUSES, default: 'PENDING' },

    knowledgeTransfer: { type: knowledgeTransferSchema, default: () => ({}) },
    knowledgeTransferStatus: { type: String, enum: KNOWLEDGE_TRANSFER_STATUSES, default: 'NOT_STARTED' },

    remarks: { type: String, trim: true },
    employeeComments: { type: String, trim: true },
    hrComments: { type: String, trim: true },
    managerComments: { type: String, trim: true },

    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true },

    rejectedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

offboardingSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
offboardingSchema.index({ organizationId: 1, status: 1, lastWorkingDate: 1 });
offboardingSchema.index({ organizationId: 1, offboardingType: 1, createdAt: -1 });

offboardingSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('Offboarding', offboardingSchema);
module.exports.OFFBOARDING_TYPES = OFFBOARDING_TYPES;
module.exports.OFFBOARDING_STATUSES = OFFBOARDING_STATUSES;
module.exports.APPROVAL_STATUSES = APPROVAL_STATUSES;
module.exports.APPROVAL_STEP_STATUSES = APPROVAL_STEP_STATUSES;
module.exports.CLEARANCE_DEPARTMENTS = CLEARANCE_DEPARTMENTS;
module.exports.CLEARANCE_STATUSES = CLEARANCE_STATUSES;
module.exports.AGGREGATE_CLEARANCE_STATUSES = AGGREGATE_CLEARANCE_STATUSES;
module.exports.ASSET_CLEARANCE_STATUSES = ASSET_CLEARANCE_STATUSES;
module.exports.DOCUMENT_CLEARANCE_STATUSES = DOCUMENT_CLEARANCE_STATUSES;
module.exports.EXIT_INTERVIEW_STATUSES = EXIT_INTERVIEW_STATUSES;
module.exports.ACCESS_DEACTIVATION_STATUSES = ACCESS_DEACTIVATION_STATUSES;
module.exports.KNOWLEDGE_TRANSFER_STATUSES = KNOWLEDGE_TRANSFER_STATUSES;
module.exports.FINAL_SETTLEMENT_STATUSES = FINAL_SETTLEMENT_STATUSES;
