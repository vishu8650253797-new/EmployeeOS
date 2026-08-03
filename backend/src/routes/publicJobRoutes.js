const { Router } = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { DANGEROUS_EXTENSIONS, getExtension } = require('../utils/fileValidation');
const publicJobController = require('../controllers/publicJobController');
const { RESUME_MAX_SIZE_MB } = require('../services/publicJobService');

const router = Router();

// Resume uploads buffer in memory and are validated authoritatively in the
// service (extension, MIME, magic bytes, size) — same pattern as documents.
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: RESUME_MAX_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = getExtension(file.originalname);
    if (!ext || DANGEROUS_EXTENSIONS.includes(ext)) {
      return cb(new AppError('This file type is not allowed', 400));
    }
    cb(null, true);
  },
});

// Spam protection for the public application endpoint.
const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many applications from this address. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public job listings — only PUBLISHED jobs are ever returned.
router.get('/jobs', asyncHandler(publicJobController.getPublicJobs));
router.get('/jobs/:slug', asyncHandler(publicJobController.getPublicJobBySlug));
router.post('/jobs/:jobId/apply', applyLimiter, resumeUpload.single('resume'), asyncHandler(publicJobController.applyToJob));

// Public offer response — secure, expiring, single-purpose tokens.
router.get('/offers/:token', asyncHandler(publicJobController.getPublicOffer));
router.put('/offers/:token/accept', asyncHandler(publicJobController.acceptOffer));
router.put('/offers/:token/reject', asyncHandler(publicJobController.rejectOffer));

module.exports = router;
