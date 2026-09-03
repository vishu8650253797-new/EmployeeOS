const EmployeeGoal = require('../models/EmployeeGoal');
const KPI = require('../models/KPI');
const PerformanceReview = require('../models/PerformanceReview');
const Employee = require('../models/Employee');
const performanceScoreService = require('./performanceScoreService');

exports.getOverviewAnalytics = async (organizationId, cycleId) => {
  const filter = { organizationId };
  if (cycleId) filter.cycleId = cycleId;

  const [totalGoals, completedGoals, atRiskGoals, totalKPIs, totalReviews, completedReviews] = await Promise.all([
    EmployeeGoal.countDocuments({ ...filter, status: { $ne: 'CANCELLED' } }),
    EmployeeGoal.countDocuments({ ...filter, status: 'COMPLETED' }),
    EmployeeGoal.countDocuments({ ...filter, status: 'AT_RISK' }),
    KPI.countDocuments(filter),
    PerformanceReview.countDocuments(filter),
    PerformanceReview.countDocuments({ ...filter, status: 'COMPLETED' })
  ]);

  const goalCompletionRate = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
  const reviewCompletionRate = totalReviews > 0 ? (completedReviews / totalReviews) * 100 : 0;

  const reviews = await PerformanceReview.find({ ...filter, status: 'COMPLETED', overallScore: { $exists: true } })
    .select('overallScore')
    .lean();
  const averageScore = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.overallScore, 0) / reviews.length
    : 0;

  const atRiskEmployees = await performanceScoreService.checkAtRiskEmployees(organizationId, cycleId);

  return {
    totalGoals,
    completedGoals,
    atRiskGoals,
    goalCompletionRate: Math.round(goalCompletionRate),
    totalKPIs,
    totalReviews,
    completedReviews,
    reviewCompletionRate: Math.round(reviewCompletionRate),
    averageScore: Math.round(averageScore),
    atRiskEmployeesCount: atRiskEmployees.length,
    atRiskEmployees
  };
};

exports.getDepartmentAnalytics = async (organizationId, cycleId) => {
  const filter = { organizationId };
  if (cycleId) filter.cycleId = cycleId;

  const employees = await Employee.find({ organizationId, status: 'ACTIVE' })
    .select('department')
    .lean();
  const employeeIds = employees.map(e => e._id);
  const employeeDeptMap = new Map(employees.map(e => [e._id.toString(), e.department || 'Unassigned']));

  const departmentStats = {};
  employees.forEach(employee => {
    const dept = employeeDeptMap.get(employee._id.toString());
    if (!departmentStats[dept]) {
      departmentStats[dept] = {
        department: dept,
        employeeCount: 0,
        totalGoals: 0,
        completedGoals: 0,
        averageScore: 0,
        scores: []
      };
    }
    departmentStats[dept].employeeCount++;
  });

  // Batched: one query per collection across every active employee, instead of
  // two queries per employee (the previous loop issued 2N queries for N employees).
  const [goals, reviews] = await Promise.all([
    EmployeeGoal.find({
      organizationId,
      employeeId: { $in: employeeIds },
      ...filter.cycleId ? { cycleId } : {}
    }).select('employeeId status').lean(),
    PerformanceReview.find({
      organizationId,
      employeeId: { $in: employeeIds },
      reviewType: 'FINAL_REVIEW',
      status: 'COMPLETED',
      ...filter.cycleId ? { cycleId } : {}
    }).select('employeeId overallScore').lean(),
  ]);

  goals.forEach(goal => {
    const dept = employeeDeptMap.get(goal.employeeId.toString());
    if (!dept) return;
    departmentStats[dept].totalGoals++;
    if (goal.status === 'COMPLETED') departmentStats[dept].completedGoals++;
  });

  reviews.forEach(review => {
    const dept = employeeDeptMap.get(review.employeeId.toString());
    if (!dept || !review.overallScore) return;
    departmentStats[dept].scores.push(review.overallScore);
  });

  const result = Object.values(departmentStats).map(dept => {
    const averageScore = dept.scores.length > 0 
      ? dept.scores.reduce((sum, s) => sum + s, 0) / dept.scores.length 
      : 0;
    const goalCompletionRate = dept.totalGoals > 0 
      ? (dept.completedGoals / dept.totalGoals) * 100 
      : 0;

    return {
      department: dept.department,
      employeeCount: dept.employeeCount,
      totalGoals: dept.totalGoals,
      completedGoals: dept.completedGoals,
      goalCompletionRate: Math.round(goalCompletionRate),
      averageScore: Math.round(averageScore)
    };
  });

  return result.sort((a, b) => b.averageScore - a.averageScore);
};

exports.getPerformanceTrends = async (organizationId, employeeId) => {
  const reviews = await PerformanceReview.find({
    organizationId,
    employeeId,
    reviewType: 'FINAL_REVIEW',
    status: 'COMPLETED'
  })
    .populate('cycleId', 'name startDate endDate')
    .sort({ completedAt: 1 });

  return reviews.map(review => ({
    cycleId: review.cycleId._id,
    cycleName: review.cycleId.name,
    cycleStartDate: review.cycleId.startDate,
    cycleEndDate: review.cycleId.endDate,
    overallScore: review.overallScore,
    overallRating: review.overallRating,
    completedAt: review.completedAt
  }));
};

exports.getTopPerformers = async (organizationId, cycleId, limit = 10) => {
  const filter = { organizationId };
  if (cycleId) filter.cycleId = cycleId;

  const reviews = await PerformanceReview.find({
    ...filter,
    reviewType: 'FINAL_REVIEW',
    status: 'COMPLETED',
    overallScore: { $exists: true }
  })
    .populate('employeeId', 'firstName lastName employeeId department')
    .sort({ overallScore: -1 })
    .limit(limit);

  return reviews.map(review => ({
    employeeId: review.employeeId._id,
    employeeName: `${review.employeeId.firstName} ${review.employeeId.lastName}`,
    employeeIdCode: review.employeeId.employeeId,
    department: review.employeeId.department,
    overallScore: review.overallScore,
    overallRating: review.overallRating
  }));
};

exports.getAtRiskEmployees = async (organizationId, cycleId) => {
  const atRiskEmployeeIds = await performanceScoreService.checkAtRiskEmployees(organizationId, cycleId);

  const employees = await Employee.find({
    _id: { $in: atRiskEmployeeIds },
    organizationId
  }).select('firstName lastName employeeId department').lean();

  // Batched: one query per collection across every at-risk employee, instead
  // of two queries per employee (the previous loop issued 2N queries for N employees).
  const [goals, kpis] = await Promise.all([
    EmployeeGoal.find({
      organizationId,
      employeeId: { $in: atRiskEmployeeIds },
      cycleId,
      status: 'AT_RISK'
    }).select('employeeId title progressPercentage').lean(),
    KPI.find({
      organizationId,
      employeeId: { $in: atRiskEmployeeIds },
      cycleId,
      status: 'BEHIND'
    }).select('employeeId name score').lean(),
  ]);

  const goalsByEmployee = new Map();
  goals.forEach(g => {
    const key = g.employeeId.toString();
    if (!goalsByEmployee.has(key)) goalsByEmployee.set(key, []);
    goalsByEmployee.get(key).push(g);
  });
  const kpisByEmployee = new Map();
  kpis.forEach(k => {
    const key = k.employeeId.toString();
    if (!kpisByEmployee.has(key)) kpisByEmployee.set(key, []);
    kpisByEmployee.get(key).push(k);
  });

  return employees.map(employee => {
    const employeeGoals = goalsByEmployee.get(employee._id.toString()) || [];
    const employeeKpis = kpisByEmployee.get(employee._id.toString()) || [];

    return {
      employeeId: employee._id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeIdCode: employee.employeeId,
      department: employee.department,
      atRiskGoals: employeeGoals.length,
      atRiskKPIs: employeeKpis.length,
      riskFactors: [
        ...employeeGoals.map(g => ({ type: 'goal', name: g.title, progress: g.progressPercentage })),
        ...employeeKpis.map(k => ({ type: 'kpi', name: k.name, score: k.score }))
      ]
    };
  });
};

exports.getEmployeePerformanceSummary = async (organizationId, employeeId, cycleId) => {
  const [goals, kpis, review] = await Promise.all([
    EmployeeGoal.find({ organizationId, employeeId, cycleId }),
    KPI.find({ organizationId, employeeId, cycleId }),
    PerformanceReview.findOne({
      organizationId,
      employeeId,
      cycleId,
      reviewType: 'FINAL_REVIEW',
      status: 'COMPLETED'
    })
  ]);

  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.status === 'COMPLETED').length;
  const inProgressGoals = goals.filter(g => g.status === 'IN_PROGRESS').length;
  const atRiskGoals = goals.filter(g => g.status === 'AT_RISK').length;

  const totalKPIs = kpis.length;
  const onTrackKPIs = kpis.filter(k => k.status === 'ON_TRACK').length;
  const behindKPIs = kpis.filter(k => k.status === 'BEHIND').length;

  const scores = await performanceScoreService.calculateOverallPerformanceScore(
    organizationId,
    employeeId,
    cycleId
  );

  return {
    goals: {
      total: totalGoals,
      completed: completedGoals,
      inProgress: inProgressGoals,
      atRisk: atRiskGoals,
      completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0
    },
    kpis: {
      total: totalKPIs,
      onTrack: onTrackKPIs,
      behind: behindKPIs,
      averageScore: totalKPIs > 0 ? Math.round(kpis.reduce((sum, k) => sum + k.score, 0) / totalKPIs) : 0
    },
    review: review ? {
      overallScore: review.overallScore,
      overallRating: review.overallRating,
      completedAt: review.completedAt
    } : null,
    calculatedScores: scores
  };
};
