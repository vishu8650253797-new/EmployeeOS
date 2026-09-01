const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const jobOpeningController = require('../controllers/jobOpeningController');
const candidateController = require('../controllers/candidateController');
const applicationController = require('../controllers/applicationController');
const interviewController = require('../controllers/interviewController');
const offerController = require('../controllers/offerController');
const recruitmentAnalyticsController = require('../controllers/recruitmentAnalyticsController');

const router = Router();

// Role groups — private candidate data is never exposed to regular employees.
const RECRUITMENT_VIEW = ['SUPER_ADMIN', 'HR_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'MANAGER'];
const RECRUITMENT_MANAGE = ['SUPER_ADMIN', 'HR_ADMIN', 'RECRUITER'];
const RECRUITMENT_ADMIN = ['SUPER_ADMIN', 'HR_ADMIN'];
const INTERVIEW_ACCESS = [...RECRUITMENT_VIEW, 'INTERVIEWER'];

router.use(authMiddleware);

// ---- Jobs ----
router.get('/jobs', authorize(...RECRUITMENT_VIEW), asyncHandler(jobOpeningController.getJobs));
router.post('/jobs', authorize(...RECRUITMENT_MANAGE), asyncHandler(jobOpeningController.createJob));
router.get('/jobs/:id', authorize(...RECRUITMENT_VIEW), asyncHandler(jobOpeningController.getJobById));
router.put('/jobs/:id', authorize(...RECRUITMENT_MANAGE), asyncHandler(jobOpeningController.updateJob));
router.delete('/jobs/:id', authorize(...RECRUITMENT_ADMIN), asyncHandler(jobOpeningController.deleteJob));
router.put('/jobs/:id/publish', authorize(...RECRUITMENT_ADMIN), asyncHandler(jobOpeningController.publishJob));
router.put('/jobs/:id/pause', authorize(...RECRUITMENT_ADMIN), asyncHandler(jobOpeningController.pauseJob));
router.put('/jobs/:id/close', authorize(...RECRUITMENT_ADMIN), asyncHandler(jobOpeningController.closeJob));
router.put('/jobs/:id/reopen', authorize(...RECRUITMENT_ADMIN), asyncHandler(jobOpeningController.reopenJob));

// ---- Candidates ----
router.get('/candidates', authorize(...RECRUITMENT_VIEW), asyncHandler(candidateController.getCandidates));
router.post('/candidates', authorize(...RECRUITMENT_MANAGE), asyncHandler(candidateController.createCandidate));
router.get('/candidates/:id', authorize(...RECRUITMENT_VIEW), asyncHandler(candidateController.getCandidateById));
router.put('/candidates/:id', authorize(...RECRUITMENT_MANAGE), asyncHandler(candidateController.updateCandidate));
router.put('/candidates/:id/tags', authorize(...RECRUITMENT_MANAGE), asyncHandler(candidateController.updateTags));
router.put('/candidates/:id/assign', authorize(...RECRUITMENT_MANAGE), asyncHandler(candidateController.assignRecruiter));
router.get('/candidates/:id/resume', authorize(...RECRUITMENT_VIEW), asyncHandler(candidateController.downloadResume));
router.get('/candidates/:id/notes', authorize(...RECRUITMENT_VIEW), asyncHandler(candidateController.getNotes));
router.post('/candidates/:id/notes', authorize(...RECRUITMENT_MANAGE), asyncHandler(candidateController.createNote));
router.get('/candidates/:id/activities', authorize(...RECRUITMENT_VIEW), asyncHandler(candidateController.getActivities));
router.get('/candidates/:candidateId/feedback', authorize(...RECRUITMENT_VIEW), asyncHandler(interviewController.getCandidateFeedback));
router.post('/candidates/:id/convert-to-employee', authorize(...RECRUITMENT_ADMIN), asyncHandler(candidateController.convertToEmployee));
router.put('/notes/:noteId', authorize(...RECRUITMENT_MANAGE), asyncHandler(candidateController.updateNote));
router.delete('/notes/:noteId', authorize(...RECRUITMENT_MANAGE), asyncHandler(candidateController.deleteNote));

// ---- Applications ----
router.get('/applications', authorize(...RECRUITMENT_VIEW), asyncHandler(applicationController.getApplications));
router.get('/applications/:id', authorize(...RECRUITMENT_VIEW), asyncHandler(applicationController.getApplicationById));
router.put('/applications/:id/status', authorize(...RECRUITMENT_MANAGE), asyncHandler(applicationController.updateStatus));
router.put('/applications/:id/reject', authorize(...RECRUITMENT_MANAGE), asyncHandler(applicationController.rejectApplication));
router.put('/applications/:id/withdraw', authorize(...RECRUITMENT_MANAGE), asyncHandler(applicationController.withdrawApplication));

// ---- Interviews ----
router.get('/interviews', authorize(...INTERVIEW_ACCESS), asyncHandler(interviewController.getInterviews));
router.post('/interviews', authorize(...RECRUITMENT_MANAGE), asyncHandler(interviewController.createInterview));
router.get('/interviews/:id', authorize(...INTERVIEW_ACCESS), asyncHandler(interviewController.getInterviewById));
router.put('/interviews/:id', authorize(...RECRUITMENT_MANAGE), asyncHandler(interviewController.updateInterview));
router.delete('/interviews/:id', authorize(...RECRUITMENT_ADMIN), asyncHandler(interviewController.deleteInterview));
router.put('/interviews/:id/reschedule', authorize(...RECRUITMENT_MANAGE), asyncHandler(interviewController.rescheduleInterview));
router.put('/interviews/:id/cancel', authorize(...RECRUITMENT_MANAGE), asyncHandler(interviewController.cancelInterview));
router.put('/interviews/:id/complete', authorize(...INTERVIEW_ACCESS), asyncHandler(interviewController.completeInterview));

// ---- Interview feedback ----
router.get('/interviews/:id/feedback', authorize(...INTERVIEW_ACCESS), asyncHandler(interviewController.getFeedback));
router.post('/interviews/:id/feedback', authorize(...INTERVIEW_ACCESS), asyncHandler(interviewController.submitFeedback));
router.put('/feedback/:feedbackId', authorize(...INTERVIEW_ACCESS), asyncHandler(interviewController.updateFeedback));

// ---- Offers ----
router.get('/offers', authorize(...RECRUITMENT_MANAGE), asyncHandler(offerController.getOffers));
router.post('/offers', authorize(...RECRUITMENT_ADMIN), asyncHandler(offerController.createOffer));
router.get('/offers/:id', authorize(...RECRUITMENT_MANAGE), asyncHandler(offerController.getOfferById));
router.put('/offers/:id', authorize(...RECRUITMENT_ADMIN), asyncHandler(offerController.updateOffer));
router.put('/offers/:id/send', authorize(...RECRUITMENT_ADMIN), asyncHandler(offerController.sendOffer));
router.put('/offers/:id/withdraw', authorize(...RECRUITMENT_ADMIN), asyncHandler(offerController.withdrawOffer));

// ---- Analytics ----
router.get('/analytics/overview', authorize(...RECRUITMENT_VIEW), asyncHandler(recruitmentAnalyticsController.getOverview));
router.get('/analytics/funnel', authorize(...RECRUITMENT_VIEW), asyncHandler(recruitmentAnalyticsController.getFunnel));
router.get('/analytics/sources', authorize(...RECRUITMENT_VIEW), asyncHandler(recruitmentAnalyticsController.getSources));
router.get('/analytics/jobs', authorize(...RECRUITMENT_VIEW), asyncHandler(recruitmentAnalyticsController.getJobs));
router.get('/analytics/time-to-hire', authorize(...RECRUITMENT_VIEW), asyncHandler(recruitmentAnalyticsController.getTimeToHire));

module.exports = router;
