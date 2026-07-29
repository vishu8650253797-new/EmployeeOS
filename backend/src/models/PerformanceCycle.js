const mongoose = require('mongoose');

const performanceCycleSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
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
  type: {
    type: String,
    enum: ['QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'],
    default: 'YEARLY'
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'REVIEW', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT',
    index: true
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

performanceCycleSchema.index({ organizationId: 1, status: 1 });
performanceCycleSchema.index({ organizationId: 1, startDate: 1 });
performanceCycleSchema.index({ organizationId: 1, endDate: 1 });

module.exports = mongoose.model('PerformanceCycle', performanceCycleSchema);
