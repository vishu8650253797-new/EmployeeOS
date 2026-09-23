const { Schema, model } = require('mongoose');

// Time Tracking foundation (Step 13A). Deliberately NOT an extension of
// Attendance: Attendance is a once-a-day presence/lateness record (single
// checkIn/checkOut pair, enforced by a unique-per-day index, string `date`
// key) with no support for multiple sessions, corrections, or an audit
// trail — reshaping it to carry a timesheet workflow would break that
// existing contract. This is a standalone, parallel model instead. See
// backend/src/utils/attendanceUtils.js — its `getOrgDate`/`getAttendanceSettings`
// helpers (org-timezone date/settings resolution) are reused here as-is
// rather than duplicated, despite the attendance-specific file name.

const TIME_ENTRY_STATUSES = ['ACTIVE', 'COMPLETED'];
const TIME_ENTRY_SOURCES = ['WEB', 'MANUAL'];

const timeEntrySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    // YYYY-MM-DD in the organization's timezone, computed server-side at
    // start time via attendanceUtils.getOrgDate — same convention Attendance
    // uses for its own `date` field, so a future reconciliation between the
    // two (Step 13B+) doesn't have to bridge two incompatible date formats.
    entryDate: { type: String, required: true, index: true },

    startTime: { type: Date, required: true },
    endTime: { type: Date },

    // Snapshot of the organization's IANA timezone at creation time, so a
    // later change to Organization.timeZone never silently reinterprets a
    // historical entry's wall-clock meaning.
    timezone: { type: String, required: true },

    // Always 0 today — no break-tracking endpoint exists yet (Step 13B) —
    // but present now so the duration formula (elapsed - breakMinutes)
    // never has to change shape later, only how this field gets populated.
    breakMinutes: { type: Number, default: 0, min: 0 },

    // Server-computed on end, from (endTime - startTime)/60000 - breakMinutes.
    // Never accepted from the client.
    durationMinutes: { type: Number, min: 0 },

    source: { type: String, enum: TIME_ENTRY_SOURCES, default: 'WEB' },
    status: { type: String, enum: TIME_ENTRY_STATUSES, default: 'ACTIVE', required: true, index: true },
    notes: { type: String, trim: true, maxlength: 500 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

timeEntrySchema.index({ organizationId: 1, employeeId: 1, entryDate: -1 });
timeEntrySchema.index({ organizationId: 1, status: 1 });
// At most one ACTIVE entry per employee at a time, enforced atomically at the
// database level (a plain pre-check alone can't survive a race between two
// concurrent "start" requests) — the same pattern used by
// EmployeeCompensation's "exactly one ACTIVE row per employee" guarantee.
timeEntrySchema.index(
  { organizationId: 1, employeeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

timeEntrySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('TimeEntry', timeEntrySchema);
module.exports.TIME_ENTRY_STATUSES = TIME_ENTRY_STATUSES;
module.exports.TIME_ENTRY_SOURCES = TIME_ENTRY_SOURCES;
