const mongoose = require('mongoose');

const kpiSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PerformanceCycle',
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['PRODUCTIVITY', 'QUALITY', 'CUSTOMER_SATISFACTION', 'SALES', 'ATTENDANCE', 'TEAMWORK', 'LEADERSHIP', 'TECHNICAL', 'CUSTOM'],
    default: 'PRODUCTIVITY'
  },
  targetValue: {
    type: Number,
    required: true
  },
  currentValue: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    trim: true
  },
  weight: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'ON_TRACK', 'BEHIND', 'COMPLETED'],
    default: 'NOT_STARTED'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

kpiSchema.index({ organizationId: 1, employeeId: 1 });
kpiSchema.index({ organizationId: 1, cycleId: 1 });
kpiSchema.index({ organizationId: 1, employeeId: 1, cycleId: 1 });
kpiSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model('KPI', kpiSchema);
