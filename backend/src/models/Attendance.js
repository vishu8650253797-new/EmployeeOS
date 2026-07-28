const { Schema, model } = require('mongoose');

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'];

const attendanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: String, required: true, index: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: {
      type: String,
      enum: STATUSES,
      default: 'PRESENT',
      required: true,
    },
    workingMinutes: { type: Number, default: 0, min: 0 },
    lateMinutes: { type: Number, default: 0, min: 0 },
    earlyDepartureMinutes: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ organizationId: 1, date: -1 });
attendanceSchema.index({ organizationId: 1, employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organizationId: 1, status: 1 });

module.exports = model('Attendance', attendanceSchema);
