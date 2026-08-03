const { Types } = require('mongoose');
const { JobOpening, Candidate, JobApplication, Interview, JobOffer } = require('../models');

function orgMatch(organizationId) {
  return { organizationId: new Types.ObjectId(organizationId) };
}

function rangeFilter(days) {
  if (!days) return {};
  const from = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
  return { createdAt: { $gte: from } };
}

async function getOverview(organizationId) {
  const match = orgMatch(organizationId);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    openPositions, totalCandidates, newApplications, inScreening,
    interviewsThisWeek, offersSent, hiresThisMonth, avgTimeToHire,
  ] = await Promise.all([
    JobOpening.countDocuments({ ...match, status: 'PUBLISHED' }),
    Candidate.countDocuments(match),
    JobApplication.countDocuments({ ...match, status: 'NEW' }),
    JobApplication.countDocuments({ ...match, status: 'SCREENING' }),
    Interview.countDocuments({
      ...match,
      status: { $in: ['SCHEDULED', 'RESCHEDULED'] },
      scheduledStart: { $gte: startOfWeek, $lt: endOfWeek },
    }),
    JobOffer.countDocuments({ ...match, status: 'SENT' }),
    JobApplication.countDocuments({ ...match, status: 'HIRED', lastStatusChangedAt: { $gte: startOfMonth } }),
    JobApplication.aggregate([
      { $match: { ...match, status: 'HIRED' } },
      { $project: { days: { $divide: [{ $subtract: ['$lastStatusChangedAt', '$appliedAt'] }, 86400000] } } },
      { $group: { _id: null, avgDays: { $avg: '$days' } } },
    ]),
  ]);

  return {
    openPositions,
    totalCandidates,
    newApplications,
    inScreening,
    interviewsThisWeek,
    offersSent,
    hiresThisMonth,
    avgTimeToHireDays: avgTimeToHire[0] ? Math.round(avgTimeToHire[0].avgDays * 10) / 10 : null,
  };
}

async function getFunnel(organizationId, filters = {}) {
  const match = { ...orgMatch(organizationId), ...rangeFilter(filters.days) };
  if (filters.job) match.jobId = new Types.ObjectId(filters.job);

  const grouped = await JobApplication.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g._id, g.count]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Funnel: candidates who reached AT LEAST each stage.
  const reached = {
    APPLICATIONS: total,
    SCREENING: total - (counts.NEW || 0),
    SHORTLISTED: (counts.SHORTLISTED || 0) + (counts.INTERVIEW || 0) + (counts.OFFER || 0) + (counts.HIRED || 0),
    INTERVIEW: (counts.INTERVIEW || 0) + (counts.OFFER || 0) + (counts.HIRED || 0),
    OFFER: (counts.OFFER || 0) + (counts.HIRED || 0),
    HIRED: counts.HIRED || 0,
  };

  const stages = Object.entries(reached).map(([stage, count]) => ({
    stage,
    count,
    conversionRate: total ? Math.round((count / total) * 1000) / 10 : 0,
  }));

  return { stages, statusBreakdown: counts, total };
}

async function getSources(organizationId, filters = {}) {
  const match = { ...orgMatch(organizationId), ...rangeFilter(filters.days) };

  const data = await JobApplication.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$source',
        applications: { $sum: 1 },
        hires: { $sum: { $cond: [{ $eq: ['$status', 'HIRED'] }, 1, 0] } },
      },
    },
    { $sort: { applications: -1 } },
  ]);

  return data.map((d) => ({
    source: d._id,
    applications: d.applications,
    hires: d.hires,
    conversionRate: d.applications ? Math.round((d.hires / d.applications) * 1000) / 10 : 0,
  }));
}

async function getJobsAnalytics(organizationId) {
  const match = orgMatch(organizationId);

  const data = await JobApplication.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$jobId',
        applications: { $sum: 1 },
        hired: { $sum: { $cond: [{ $eq: ['$status', 'HIRED'] }, 1, 0] } },
        inPipeline: { $sum: { $cond: [{ $in: ['$status', ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER']] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'jobopenings', localField: '_id', foreignField: '_id', as: 'job' } },
    { $unwind: '$job' },
    {
      $project: {
        jobId: '$_id',
        title: '$job.title',
        status: '$job.status',
        numberOfOpenings: '$job.numberOfOpenings',
        applications: 1,
        hired: 1,
        inPipeline: 1,
        rejected: 1,
      },
    },
    { $sort: { applications: -1 } },
  ]);

  return data.map((d) => ({ ...d, jobId: d.jobId.toString(), _id: undefined }));
}

async function getTimeToHire(organizationId, filters = {}) {
  const match = { ...orgMatch(organizationId), status: 'HIRED', ...rangeFilter(filters.days) };

  const perJob = await JobApplication.aggregate([
    { $match: match },
    { $project: { jobId: 1, days: { $divide: [{ $subtract: ['$lastStatusChangedAt', '$appliedAt'] }, 86400000] } } },
    { $group: { _id: '$jobId', avgDays: { $avg: '$days' }, hires: { $sum: 1 } } },
    { $lookup: { from: 'jobopenings', localField: '_id', foreignField: '_id', as: 'job' } },
    { $unwind: '$job' },
    { $project: { title: '$job.title', avgDays: { $round: ['$avgDays', 1] }, hires: 1 } },
    { $sort: { avgDays: 1 } },
  ]);

  const overall = await JobApplication.aggregate([
    { $match: match },
    { $project: { days: { $divide: [{ $subtract: ['$lastStatusChangedAt', '$appliedAt'] }, 86400000] } } },
    { $group: { _id: null, avgDays: { $avg: '$days' }, minDays: { $min: '$days' }, maxDays: { $max: '$days' }, hires: { $sum: 1 } } },
  ]);

  const offerStats = await JobOffer.aggregate([
    { $match: { ...orgMatch(organizationId), status: { $in: ['ACCEPTED', 'REJECTED'] } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const accepted = offerStats.find((o) => o._id === 'ACCEPTED')?.count || 0;
  const rejectedOffers = offerStats.find((o) => o._id === 'REJECTED')?.count || 0;
  const totalResponded = accepted + rejectedOffers;

  return {
    overall: overall[0]
      ? {
          avgDays: Math.round(overall[0].avgDays * 10) / 10,
          minDays: Math.round(overall[0].minDays * 10) / 10,
          maxDays: Math.round(overall[0].maxDays * 10) / 10,
          hires: overall[0].hires,
        }
      : null,
    perJob: perJob.map((p) => ({ ...p, jobId: p._id.toString(), _id: undefined })),
    offerAcceptanceRate: totalResponded ? Math.round((accepted / totalResponded) * 1000) / 10 : null,
  };
}

module.exports = { getOverview, getFunnel, getSources, getJobsAnalytics, getTimeToHire };
