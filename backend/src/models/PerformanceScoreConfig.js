const mongoose = require('mongoose');

const performanceScoreConfigSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    index: true
  },
  goalWeight: {
    type: Number,
    default: 40,
    min: 0,
    max: 100
  },
  kpiWeight: {
    type: Number,
    default: 40,
    min: 0,
    max: 100
  },
  managerReviewWeight: {
    type: Number,
    default: 20,
    min: 0,
    max: 100
  },
  peerReviewWeight: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  goalRiskThreshold: {
    type: Number,
    default: 30,
    min: 0,
    max: 100
  },
  kpiRiskThreshold: {
    type: Number,
    default: 70,
    min: 0,
    max: 100
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

performanceScoreConfigSchema.pre('save', function(next) {
  const totalWeight = this.goalWeight + this.kpiWeight + this.managerReviewWeight + this.peerReviewWeight;
  if (Math.abs(totalWeight - 100) > 0.01) {
    return next(new Error('Total weights must equal 100%'));
  }
  next();
});

module.exports = mongoose.model('PerformanceScoreConfig', performanceScoreConfigSchema);
