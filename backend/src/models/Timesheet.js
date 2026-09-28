const { Schema, model } = require('mongoose');

// Timesheet Preparation, Submission & Manager Review (Steps 13C/13D) — built
// on top of the Step 13A TimeEntry foundation without modifying it. A
// Timesheet is a server-computed weekly (Monday-Sunday) rollup of an
// employee's own TimeEntry records: while DRAFT, entries are resolved live
// by date-range query (see timesheetService.refreshIfEditable); at SUBMIT, the
// included entries are frozen into `timeEntryIds` and the totals/validation
// snapshot becomes final, mirroring how PayrollRecord freezes its line
// items at finalize. reviewedBy/reviewedAt/rejectionReason mirror
// LeaveRequest's field names for the same concept.

// Step 13E note: this codebase's convention throughout Steps 13A-13D has
// been to reuse an existing status/mechanism rather than add a parallel one
// wherever the existing one already does the job (see LOCKED_STATUSES/
// PayrollRecord-freeze-at-finalize comments below). Two decisions made on
// that same basis for 13E, deliberately NOT reflected as new enum values:
//   - "Finalized/locked" is APPROVED itself — no employee-side path can ever
//     modify an APPROVED timesheet (see prepareTimesheet's LOCKED_STATUSES
//     guard, unchanged), so a separate FINALIZED status would duplicate a
//     state that already behaves identically. The only controlled way past
//     it is the new manager reopenTimesheet() action.
//   - "Corrected" is not a distinct status — REJECTED already means
//     "the employee may act on this," and resubmitTimesheet() transitions
//     REJECTED -> SUBMITTED directly once entries are ready, exactly the
//     conceptual CORRECTED step with no separate status needed for it.
//   - "Reopened" reuses the same REJECTED target + reviewedBy/reviewedAt/
//     rejectionReason fields as an ordinary rejection (reopening an APPROVED
//     timesheet is, functionally, a manager sending it back with a reason —
//     the same shape). What makes a reopen distinguishable from a first-pass
//     rejection is the audit action name (TIMESHEET_REOPENED vs
//     TIMESHEET_REJECTED), surfaced via getTimesheetHistory() in
//     timesheetService.js, which reads the existing AuditLog rather than a
//     second, duplicate history mechanism.
const TIMESHEET_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
// Once left DRAFT, a timesheet is never re-preparable (prepare() is
// specifically the DRAFT-creation/refresh path) — but REJECTED is not
// otherwise terminal: resubmitTimesheet() can move it back to SUBMITTED.
const LOCKED_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED'];

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

    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },

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
module.exports.LOCKED_STATUSES = LOCKED_STATUSES;
