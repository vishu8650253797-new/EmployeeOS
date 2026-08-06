const path = require('path');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
// Keep file uploads (documents, avatars) out of the real backend/storage directory.
process.env.DOCUMENT_STORAGE_ROOT = process.env.DOCUMENT_STORAGE_ROOT
  || path.join(os.tmpdir(), `employeeos-test-storage-${process.pid}`);
