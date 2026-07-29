const PerformanceScoreConfig = require('../models/PerformanceScoreConfig');
const EmployeeGoal = require('../models/EmployeeGoal');
const KPI = require('../models/KPI');
const PerformanceReview = require('../models/PerformanceReview');
const { getSocketInstance } = require('../socket/socketServer');

exports.getPerformanceRating = (score) => {
  if (score >= 90) return { label: 'Outstanding', value: 5 };
  if (score >= 80) return { label: 'Exceeds Expectations', value: 4 };
  if (score >= 70) return { label: 'Meets Expectations', value: 3 };
  if (score >= 60) return { label: 'Needs Improvement', value: 2 };
  return { label: 'Needs Significant Improvement', value: 1 };
};

exports.getConfig = async (organizationId) => {
  let config = await PerformanceScoreConfig.findOne({ organizationId });
  
  if (!config) {
    config = new PerformanceScoreConfig({
      organizationId,
      goalWeight: 40,
      kpiWeight: 40,
      managerReviewWeight: 20,
      peerReviewWeight: 0,
      goalRiskThreshold: 30,
      kpiRiskThreshold: 70
    });
    await config.save();
  }

  return config;
};

exports.updateConfig = async (organizationId, configData) => {
  const config = await PerformanceScoreConfig.findOneAndUpdate(
    { organizationId },
    configData,
    { new: true, upsert: true, runValidators: true }
  );

  return config;
};

exports.calculateGoalScore = async (organizationId, employeeId, cycleId) => {
  const goals = await EmployeeGoal.find({
    organizationId,
    employeeId,
    cycleId
  });

  if (goals.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const goal of goals) {
    const weight = goal.weight;
    const progress = goal.progressPercentage;
    totalWeightedScore += progress * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
};

exports.calculateKPIScore = async (organizationId, employeeId, cycleId) => {
  const kpis = await KPI.find({
    organizationId,
    employeeId,
    cycleId
  });

  if (kpis.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const kpi of kpis) {
    const weight = kpi.weight;
    const score = kpi.score;
    totalWeightedScore += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
};

exports.calculateManagerReviewScore = (overallRating) => {
  return (overallRating / 5) * 100;
};

exports.calculatePeerReviewScore = async (organizationId, employeeId, cycleId) => {
  const Feedback = require('../models/Feedback');
  const feedbacks = await Feedback.find({
    organizationId,
    employeeId,
    cycleId,
    type: 'PEER'
  });

  if (feedbacks.length === 0) return 0;

  return 75;
};

exports.calculateOverallPerformanceScore = async (organizationId, employeeId, cycleId) => {
  const config = await this.getConfig(organizationId);

  const goalScore = await this.calculateGoalScore(organizationId, employeeId, cycleId);
  const kpiScore = await this.calculateKPIScore(organizationId, employeeId, cycleId);
  
  const review = await PerformanceReview.findOne({
    organizationId,
    employeeId,
    cycleId,
    reviewType: 'MANAGER_REVIEW',
    status: 'COMPLETED'
  });

  let managerReviewScore = 0;
  if (review && review.overallRating) {
    managerReviewScore = this.calculateManagerReviewScore(review.overallRating);
  }

  let peerReviewScore = 0;
  if (config.peerReviewWeight > 0) {
    peerReviewScore = await this.calculatePeerReviewScore(organizationId, employeeId, cycleId);
  }

  const overallScore = 
    (goalScore * (config.goalWeight / 100)) +
    (kpiScore * (config.kpiWeight / 100)) +
    (managerReviewScore * (config.managerReviewWeight / 100)) +
    (peerReviewScore * (config.peerReviewWeight / 100));

  return {
    overallScore: Math.round(overallScore),
    goalScore: Math.round(goalScore),
    kpiScore: Math.round(kpiScore),
    managerReviewScore: Math.round(managerReviewScore),
    peerReviewScore: Math.round(peerReviewScore),
    rating: this.getPerformanceRating(overallScore)
  };
};

exports.updatePerformanceScore = async (organizationId, employeeId, cycleId) => {
  const scores = await this.calculateOverallPerformanceScore(organizationId, employeeId, cycleId);

  const io = getSocketInstance();
  if (io) {
    io.to(`user:${employeeId}`).emit('performance:score-updated', {
      employeeId,
      cycleId,
      scores
    });
  }

  return scores;
};

exports.checkAtRiskEmployees = async (organizationId, cycleId) => {
  const config = await this.getConfig(organizationId);
  const goals = await EmployeeGoal.find({
    organizationId,
    cycleId,
    status: 'AT_RISK'
  });

  const kpis = await KPI.find({
    organizationId,
    cycleId,
    status: 'BEHIND'
  });

  const atRiskEmployeeIds = new Set();
  
  goals.forEach(goal => atRiskEmployeeIds.add(goal.employeeId.toString()));
  kpis.forEach(kpi => atRiskEmployeeIds.add(kpi.employeeId.toString()));

  return Array.from(atRiskEmployeeIds);
};
