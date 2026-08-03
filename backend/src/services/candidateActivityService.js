const { Types } = require('mongoose');
const { CandidateActivity } = require('../models');

// Central helper for the candidate activity timeline. Failures here must
// never break the primary workflow, so callers can fire-and-forget.
async function logActivity({ organizationId, candidateId, applicationId, actorId, type, description, metadata, session }) {
  const [activity] = await CandidateActivity.create(
    [
      {
        organizationId: new Types.ObjectId(organizationId),
        candidateId: new Types.ObjectId(candidateId),
        applicationId: applicationId ? new Types.ObjectId(applicationId) : undefined,
        actorId: actorId ? new Types.ObjectId(actorId) : undefined,
        type,
        description,
        metadata: metadata || {},
      },
    ],
    session ? { session } : undefined
  );
  return activity;
}

async function getCandidateActivities(organizationId, candidateId) {
  const data = await CandidateActivity.find({
    organizationId: new Types.ObjectId(organizationId),
    candidateId: new Types.ObjectId(candidateId),
  })
    .populate('actorId', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return data.map((d) => ({ ...d, id: d._id.toString() }));
}

module.exports = { logActivity, getCandidateActivities };
