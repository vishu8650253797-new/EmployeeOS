const { Schema, model } = require('mongoose');

// Timesheet Preparation & Submission (Step 13C) — built on top of the Step
// 13A TimeEntry foundation without modifying it. A Timesheet is a
// server-computed weekly (Monday-Sunday) rollup of an employee's own
// TimeEntry records: while DRAFT, entries are resolved live by date-range
// query (see timesheetService.refreshDraft); at SUBMIT, the included entries
// are frozen into `timeEntryIds` and the totals/validation snapshot becomes
// final, mirroring how PayrollRecord freezes its line items at finalize.

const TIMESHEET_STATUSES = ['DRAFT', 'SUBMITTED'];

const validationIssueSchema = new Schema(
  { code: { type: String, required: true }, message: { type: String, required: true } },
  { _id: false }
);

const timesheetSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    // YYYY-MM-DD, same string convention as TimeEntry.entryDate / Attendance.date.
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    timezone: { type: String, required: true },

    status: { type: String, enum: TIMESHEET_STATUSES, default: 'DRAFT', required: true, index: true },

    // Server-computed snapshot — refreshed on every read/prepare while DRAFT,
    // frozen once SUBMITTED. Never accepted from the client.
    totalMinutes: { type: Number, default: 0, min: 0 },
    entryCount: { type: Number, default: 0, min: 0 },
    validationErrors: [validationIssueSchema],
    validationWarnings: [validationIssueSchema],

    // Populated only at submit time — the frozen record of which entries
    // this submission actually covered.
    timeEntryIds: [{ type: Schema.Types.ObjectId, ref: 'TimeEntry' }],

    submittedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// One timesheet per employee per period — prepare() is find-or-create against
// this, so retrying preparation is always safe and never creates duplicates.
timesheetSchema.index({ organizationId: 1, employeeId: 1, periodStart: 1 }, { unique: true });
timesheetSchema.index({ organizationId: 1, employeeId: 1, periodStart: -1 });
timesheetSchema.index({ organizationId: 1, status: 1 });

timesheetSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('Timesheet', timesheetSchema);
module.exports.TIMESHEET_STATUSES = TIMESHEET_STATUSES;
