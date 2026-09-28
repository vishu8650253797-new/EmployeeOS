const { Schema, model } = require('mongoose');

// Effective-dated assignment of a Shift to an employee (Step 14A) —
// deliberately mirrors EmployeeCompensation.js's exact shape: a reassignment
// creates a new row rather than editing one in place, and a partial unique
// index guarantees exactly one ACTIVE assignment per employee at a time.
// This is the proven precedent for "effective-dated assignment lifecycle"
// already in this codebase; reused rather than inventing a new pattern.
//
// No bulk-assignment, rotation, or conflict-detection engine here — only
// the foundation: one shift, one set of applicable weekdays, one effective
// date range, per assignment.

const SCHEDULE_STATUSES = ['ACTIVE', 'SUPERSEDED', 'CANCELLED'];

const employeeScheduleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },

    // 0=Sunday .. 6=Saturday. Validated non-empty and in-range at the
    // service layer (mass-assignment/business-rule validation belongs
    // there, not the schema) — kept here as a plain array, the minimal
    // representation needed before any rotation/pattern engine exists.
    daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5] },

    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date }, // absent/null = ongoing

    status: { type: String, enum: SCHEDULE_STATUSES, default: 'ACTIVE', index: true },
    reason: { type: String, trim: true, maxlength: 500 },

    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Exactly one ACTIVE schedule per employee at a time — the same
// "guarantee ambiguous overlap can't happen" mechanism already proven by
// EmployeeCompensation, enforced atomically at the database level rather
// than only in application code.
employeeScheduleSchema.index(
  { organizationId: 1, employeeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);
employeeScheduleSchema.index({ organizationId: 1, employeeId: 1, effectiveFrom: -1 });
employeeScheduleSchema.index({ organizationId: 1, status: 1 });

employeeScheduleSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('EmployeeSchedule', employeeScheduleSchema);
module.exports.SCHEDULE_STATUSES = SCHEDULE_STATUSES;
