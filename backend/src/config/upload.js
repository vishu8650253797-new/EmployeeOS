const multer = require('multer');
const AppError = require('../utils/AppError');
const { DANGEROUS_EXTENSIONS, getExtension } = require('../utils/fileValidation');

const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB) || 25;
const AVATAR_MAX_SIZE_MB = Number(process.env.AVATAR_MAX_SIZE_MB) || 5;
const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png'];

// Buffers stay in memory — documentService hands the buffer straight to the
// storage facade, avoiding an extra temp-file copy. fileFilter only performs
// the cheap dangerous-extension check; the authoritative extension/MIME/size
// validation runs in the service once the document category (which supplies
// the real allow-list and size limit) has been loaded from the DB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = getExtension(file.originalname);
    if (!ext || DANGEROUS_EXTENSIONS.includes(ext)) {
      return cb(new AppError('This file type is not allowed', 400));
    }
    cb(null, true);
  },
});

// Profile photos: same in-memory pattern, restricted to image extensions.
// employeeService.updatePhoto still runs the authoritative magic-byte check.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = getExtension(file.originalname);
    if (!ext || !AVATAR_EXTENSIONS.includes(ext)) {
      return cb(new AppError('Profile photo must be a JPG or PNG image', 400));
    }
    cb(null, true);
  },
});

module.exports = { upload, photoUpload, MAX_UPLOAD_SIZE_MB, AVATAR_MAX_SIZE_MB };
