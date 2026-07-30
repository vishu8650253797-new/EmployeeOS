const crypto = require('crypto');
const path = require('path');
const AppError = require('./AppError');

const DEFAULT_MAX_FILE_SIZE_MB = Number(process.env.DOCUMENT_DEFAULT_MAX_FILE_SIZE_MB) || 10;
const DEFAULT_ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'];

const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'msi', 'dll', 'com', 'scr', 'vbs', 'js', 'jar',
  'ps1', 'app', 'apk', 'bin', 'msc', 'php', 'jsp', 'asp', 'aspx', 'py', 'rb',
];

const EXTENSION_MIME_MAP = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

// Magic-byte signatures for the file's actual content — the declared
// extension/MIME type are just labels the client attaches and can't be
// trusted alone (e.g. an .exe relabeled as "passport.pdf" with a spoofed
// Content-Type would otherwise sail through the checks above).
const FILE_SIGNATURES = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  doc: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // legacy OLE2 compound file
  xls: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  docx: [[0x50, 0x4b, 0x03, 0x04]], // OOXML is a zip archive
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
};

function matchesFileSignature(buffer, extension) {
  const signatures = FILE_SIGNATURES[extension];
  if (!signatures || !buffer) return true; // no known signature for this extension — don't fail closed
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}

function getExtension(filename = '') {
  const ext = path.extname(filename).replace('.', '').toLowerCase().trim();
  return ext;
}

function sanitizeFileName(originalName = '') {
  const base = path.basename(String(originalName)).replace(/[\x00-\x1f]/g, '');
  const cleaned = base.replace(/\.\.+/g, '.').replace(/[/\\]/g, '').trim();
  const safe = cleaned || 'document';
  return safe.slice(0, 180);
}

function generateSecureFileName(extension) {
  return `${crypto.randomUUID()}.${extension}`;
}

/**
 * Authoritative file validation — must run server-side after any client-side
 * checks. Never trust the declared MIME type or extension alone.
 */
function validateFile({ originalName, mimeType, sizeBytes, buffer, category }) {
  const extension = getExtension(originalName);

  if (!extension) {
    throw new AppError('File must have a valid extension', 400);
  }
  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    throw new AppError('This file type is not allowed', 400);
  }

  const allowedExtensions = (category?.allowedExtensions?.length
    ? category.allowedExtensions
    : DEFAULT_ALLOWED_EXTENSIONS).map((e) => e.toLowerCase());
  if (!allowedExtensions.includes(extension)) {
    throw new AppError(`File extension .${extension} is not allowed for this document category`, 400);
  }

  const expectedMimeTypes = EXTENSION_MIME_MAP[extension];
  if (!expectedMimeTypes || !expectedMimeTypes.includes(mimeType)) {
    throw new AppError('File content type does not match its extension', 400);
  }

  if (!matchesFileSignature(buffer, extension)) {
    throw new AppError('File content does not match its declared type', 400);
  }

  const maxSizeMB = category?.maxFileSizeMB || DEFAULT_MAX_FILE_SIZE_MB;
  if (sizeBytes > maxSizeMB * 1024 * 1024) {
    throw new AppError(`File exceeds the maximum allowed size of ${maxSizeMB}MB`, 400);
  }

  return { extension, sanitizedName: sanitizeFileName(originalName) };
}

module.exports = {
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_ALLOWED_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  EXTENSION_MIME_MAP,
  FILE_SIGNATURES,
  getExtension,
  sanitizeFileName,
  generateSecureFileName,
  matchesFileSignature,
  validateFile,
};
