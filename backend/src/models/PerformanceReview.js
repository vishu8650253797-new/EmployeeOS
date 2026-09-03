const mongoose = require('mongoose');

const performanceReviewSchema = new mongoose.Schema({
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
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reviewType: {
    type: String,
    enum: ['SELF_ASSESSMENT', 'MANAGER_REVIEW', 'PEER_REVIEW', 'FINAL_REVIEW'],
    required: true
  },
  status: {
    type: String,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED'],
    default: 'NOT_STARTED',
    index: true
  },
  selfAssessment: {
    achievements: String,
    challenges: String,
    strengths: String,
    improvementAreas: String,
    careerGoals: String,
    additionalComments: String
  },
  managerAssessment: {
    goalPerformance: String,
    kpiPerformance: String,
    strengths: String,
    improvementAreas: String,
    feedback: String
  },
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  overallScore: {
    type: Number,
    min: 0,
    max: 100
  },
  finalComments: {
    type: String
  },
  submittedAt: {
    type: Date
  },
  reviewedAt: {
    type: Date
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

performanceReviewSchema.index({ organizationId: 1, employeeId: 1 });
performanceReviewSchema.index({ organizationId: 1, cycleId: 1 });
performanceReviewSchema.index({ organizationId: 1, reviewerId: 1 });
performanceReviewSchema.index({ organizationId: 1, status: 1 });
performanceReviewSchema.index({ organizationId: 1, employeeId: 1, cycleId: 1 });
performanceReviewSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model('PerformanceReview', performanceReviewSchema);
