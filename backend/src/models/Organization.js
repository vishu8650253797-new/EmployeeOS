const { Schema, model } = require('mongoose');

// Root tenant entity — every company-scoped record references an organization.

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true, lowercase: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    logo: { type: String },
    industry: { type: String, trim: true },
    address: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    timeZone: { type: String, default: 'Asia/Kolkata', trim: true },
    attendanceSettings: {
      workStartTime: { type: String, default: '09:00', trim: true },
      workEndTime: { type: String, default: '18:00', trim: true },
      lateThresholdMinutes: { type: Number, default: 15, min: 0 },
      minimumWorkingMinutes: { type: Number, default: 240, min: 0 },
    },
  },
  { timestamps: true }
);

module.exports = model('Organization', organizationSchema);
