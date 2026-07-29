const mongoose = require('mongoose');

const goalProgressSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  goalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeGoal',
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  previousValue: {
    type: Number,
    default: 0
  },
  newValue: {
    type: Number,
    required: true
  },
  progressPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  note: {
    type: String,
    trim: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

goalProgressSchema.index({ organizationId: 1, goalId: 1 });
goalProgressSchema.index({ organizationId: 1, employeeId: 1 });
goalProgressSchema.index({ goalId: 1, createdAt: -1 });

module.exports = mongoose.model('GoalProgress', goalProgressSchema);
