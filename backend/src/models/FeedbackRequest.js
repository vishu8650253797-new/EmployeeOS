const mongoose = require('mongoose');

const feedbackRequestSchema = new mongoose.Schema({
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
  requestedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUBMITTED', 'DECLINED', 'EXPIRED'],
    default: 'PENDING'
  },
  dueDate: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

feedbackRequestSchema.index({ organizationId: 1, employeeId: 1 });
feedbackRequestSchema.index({ organizationId: 1, cycleId: 1 });
feedbackRequestSchema.index({ requestedFrom: 1, status: 1 });

module.exports = mongoose.model('FeedbackRequest', feedbackRequestSchema);
