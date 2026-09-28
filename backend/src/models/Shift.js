const { Schema, model } = require('mongoose');

// Workforce Scheduling foundation (Step 14A). A Shift is a reusable, named
// working-period definition — deliberately the ONLY shift-definition model:
// there is no separate ShiftTemplate, because a Shift already is the
// reusable unit (assigning it to an employee via EmployeeSchedule is what
// "using the template" means). There is also no WorkSchedule/rotation-engine
// model yet — that's explicitly deferred to a later Step 14 substep.
//
// Time is stored as "HH:MM" strings, the exact same convention already used
// by Organization.attendanceSettings.workStartTime/workEndTime — reused,
// not reinvented. Organization.attendanceSettings itself is untouched: it
// remains the org's single default work-time window; Shift is for named,
// multiple, reusable definitions ("Morning Shift", "Night Shift", ...).

const SHIFT_STATUSES = ['ACTIVE', 'INACTIVE'];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM, 24-hour

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const shiftSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true, maxlength: 500 },

    startTime: { type: String, required: true, match: TIME_PATTERN },
    endTime: { type: String, required: true, match: TIME_PATTERN },
    breakMinutes: { type: Number, default: 0, min: 0 },

    // Both derived server-side from startTime/endTime/breakMinutes on every
    // save — never accepted from the client, so they can never drift from
    // the times they're computed from. endTime <= startTime means the shift
    // crosses midnight (e.g. 22:00 -> 06:00) — a valid, ordinary case, not
    // an error (see the pre-save hook below).
    isOvernight: { type: Boolean, default: false },
    scheduledMinutes: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: SHIFT_STATUSES, default: 'ACTIVE', index: true },
    // Soft-delete, distinct from status — mirrors Department.js's exact
    // convention (status for an admin ACTIVE/INACTIVE toggle, isDeleted for
    // removal). A Shift already referenced by an EmployeeSchedule (and,
    // later, Attendance/Timesheet integration) is never physically deleted,
    // so historical records can still resolve what shift they referred to.
    isDeleted: { type: Boolean, default: false, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

shiftSchema.pre('validate', function computeDerivedFields() {
  if (!TIME_PATTERN.test(this.startTime) || !TIME_PATTERN.test(this.endTime)) return; // let schema validation report the format error
  const startMin = timeToMinutes(this.startTime);
  const endMin = timeToMinutes(this.endTime);
  this.isOvernight = endMin <= startMin;
  const rawMinutes = this.isOvernight ? (24 * 60 - startMin) + endMin : endMin - startMin;
  if ((this.breakMinutes || 0) > rawMinutes) {
    this.invalidate('breakMinutes', "Break duration cannot exceed the shift's working duration");
    return;
  }
  this.scheduledMinutes = rawMinutes - (this.breakMinutes || 0);
});

// Code unique per organization (partial: only among non-deleted shifts, so
// a deleted shift's code can be reused) — mirrors SalaryComponent.js's exact
// {organizationId, code} partial-unique pattern.
shiftSchema.index({ organizationId: 1, code: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
shiftSchema.index({ organizationId: 1, status: 1 });

shiftSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('Shift', shiftSchema);
module.exports.SHIFT_STATUSES = SHIFT_STATUSES;
module.exports.TIME_PATTERN = TIME_PATTERN;
