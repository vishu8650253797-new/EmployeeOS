const mongoose = require('mongoose');

const employeeGoalSchema = new mongoose.Schema({
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
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
    enum: ['BUSINESS', 'TECHNICAL', 'PERSONAL_DEVELOPMENT', 'TEAMWORK', 'LEADERSHIP', 'CUSTOMER_SUCCESS', 'CUSTOM'],
    default: 'BUSINESS'
  },
  target: {
    type: String,
    trim: true
  },
  measurementUnit: {
    type: String,
    trim: true
  },
  targetValue: {
    type: Number,
    default: 0
  },
  currentValue: {
    type: Number,
    default: 0
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  weight: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  status: {
    type: String,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'COMPLETED', 'CANCELLED'],
    default: 'NOT_STARTED',
    index: true
  },
  startDate: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  completedAt: {
    type: Date
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

employeeGoalSchema.index({ organizationId: 1, employeeId: 1 });
employeeGoalSchema.index({ organizationId: 1, cycleId: 1 });
employeeGoalSchema.index({ organizationId: 1, status: 1 });
employeeGoalSchema.index({ organizationId: 1, dueDate: 1 });
employeeGoalSchema.index({ organizationId: 1, createdAt: -1 });
employeeGoalSchema.index({ organizationId: 1, employeeId: 1, cycleId: 1 });

module.exports = mongoose.model('EmployeeGoal', employeeGoalSchema);
