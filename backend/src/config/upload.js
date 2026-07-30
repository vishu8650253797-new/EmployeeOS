const multer = require('multer');
const AppError = require('../utils/AppError');
const { DANGEROUS_EXTENSIONS, getExtension } = require('../utils/fileValidation');

const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB) || 25;

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

module.exports = { upload, MAX_UPLOAD_SIZE_MB };
