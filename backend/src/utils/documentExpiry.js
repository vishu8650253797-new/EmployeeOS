const EXPIRY_WARNING_DAYS_DEFAULT = Number(process.env.DOCUMENT_EXPIRY_WARNING_DAYS) || 30;

const EXPIRY_STATUS = {
  VALID: 'VALID',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  NO_EXPIRY: 'NO_EXPIRY',
};

const REMINDER_THRESHOLDS_DAYS = [30, 14, 7, 1];

function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  const now = Date.now();
  const exp = new Date(expiryDate).getTime();
  return Math.ceil((exp - now) / (24 * 60 * 60 * 1000));
}

function getDocumentExpiryStatus(expiryDate, warningDays = EXPIRY_WARNING_DAYS_DEFAULT) {
  if (!expiryDate) return EXPIRY_STATUS.NO_EXPIRY;
  const daysLeft = getDaysUntilExpiry(expiryDate);
  if (daysLeft < 0) return EXPIRY_STATUS.EXPIRED;
  if (daysLeft <= warningDays) return EXPIRY_STATUS.EXPIRING_SOON;
  return EXPIRY_STATUS.VALID;
}

module.exports = {
  EXPIRY_STATUS,
  EXPIRY_WARNING_DAYS_DEFAULT,
  REMINDER_THRESHOLDS_DAYS,
  getDaysUntilExpiry,
  getDocumentExpiryStatus,
};
