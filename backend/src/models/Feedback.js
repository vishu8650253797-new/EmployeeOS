const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PerformanceCycle',
    index: true
  },
  type: {
    type: String,
    enum: ['MANAGER', 'PEER', 'HR'],
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  visibility: {
    type: String,
    enum: ['PRIVATE', 'SHARED_WITH_EMPLOYEE'],
    default: 'SHARED_WITH_EMPLOYEE'
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

feedbackSchema.index({ organizationId: 1, employeeId: 1 });
feedbackSchema.index({ organizationId: 1, cycleId: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
