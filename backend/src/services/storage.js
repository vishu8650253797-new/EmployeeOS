const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

const STORAGE_BASE_DIR = process.env.DOCUMENT_STORAGE_ROOT || path.join(process.cwd(), 'storage');

/**
 * Initialize storage directories
 */
async function ensureStorageDir() {
  await fsPromises.mkdir(STORAGE_BASE_DIR, { recursive: true });
  await fsPromises.mkdir(path.join(STORAGE_BASE_DIR, 'documents'), { recursive: true });
  await fsPromises.mkdir(path.join(STORAGE_BASE_DIR, 'versions'), { recursive: true });
  await fsPromises.mkdir(path.join(STORAGE_BASE_DIR, 'avatars'), { recursive: true });
}

/**
 * Generate checksum for file integrity
 */
function generateChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Upload a file to storage
 */
async function uploadFile({ buffer, organizationId, employeeId, documentId, versionNumber, extension }) {
  await ensureStorageDir();

  const filename = `${crypto.randomUUID()}.${extension}`;
  const orgPath = organizationId.toString();
  const docPath = documentId.toString();
  
  let relativePath;
  if (versionNumber && versionNumber > 1) {
    // Version file
    relativePath = path.join('versions', orgPath, docPath, `v${versionNumber}`, filename);
  } else {
    // Current document file
    relativePath = path.join('documents', orgPath, docPath, filename);
  }

  const fullPath = path.join(STORAGE_BASE_DIR, relativePath);
  const dirPath = path.dirname(fullPath);

  await fsPromises.mkdir(dirPath, { recursive: true });
  await fsPromises.writeFile(fullPath, buffer);

  const checksum = generateChecksum(buffer);

  return {
    storageKey: relativePath.replace(/\\/g, '/'),
    checksum,
  };
}

/**
 * Upload a profile photo (avatar) to storage — same layout style as uploadFile,
 * keyed by employee rather than document/version since an avatar has no versions.
 */
async function uploadAvatar({ buffer, organizationId, employeeId, extension }) {
  await ensureStorageDir();

  const filename = `${crypto.randomUUID()}.${extension}`;
  const relativePath = path.join('avatars', organizationId.toString(), employeeId.toString(), filename);
  const fullPath = path.join(STORAGE_BASE_DIR, relativePath);

  await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
  await fsPromises.writeFile(fullPath, buffer);

  return { storageKey: relativePath.replace(/\\/g, '/'), size: buffer.length };
}

/**
 * Get file stream for download
 */
async function getFileStream(storageKey) {
  const relativePath = storageKey.replace(/\//g, path.sep);
  const fullPath = path.join(STORAGE_BASE_DIR, relativePath);

  try {
    await fsPromises.access(fullPath);
    const stats = await fsPromises.stat(fullPath);
    const stream = fs.createReadStream(fullPath);
    return { stream, size: stats.size };
  } catch (error) {
    throw new Error('File not found in storage');
  }
}

/**
 * Delete a file from storage
 */
async function deleteFile(storageKey) {
  const relativePath = storageKey.replace(/\//g, path.sep);
  const fullPath = path.join(STORAGE_BASE_DIR, relativePath);

  try {
    await fsPromises.unlink(fullPath);
    return { success: true };
  } catch (error) {
    // Ignore if file doesn't exist
    if (error.code === 'ENOENT') {
      return { success: true };
    }
    throw error;
  }
}

module.exports = {
  uploadFile,
  uploadAvatar,
  getFileStream,
  deleteFile,
  ensureStorageDir,
};
