const cron = require('node-cron');
const documentExpiryService = require('../services/documentExpiryService');

function startDocumentExpiryJob() {
  const schedule = process.env.DOCUMENT_EXPIRY_CRON_SCHEDULE || '0 2 * * *';

  cron.schedule(
    schedule,
    async () => {
      try {
        const expired = await documentExpiryService.scanAndProcessExpiries();
        const reminders = await documentExpiryService.sendExpiryReminders();
        console.log(`Document expiry job: ${expired.processed} document(s) expired, ${reminders.sent} reminder(s) sent.`);
      } catch (error) {
        console.error('Document expiry job failed:', error.message);
      }
    },
    { timezone: process.env.CRON_TIMEZONE || 'UTC' }
  );

  console.log(`Document expiry job scheduled ("${schedule}", timezone: ${process.env.CRON_TIMEZONE || 'UTC'})`);
}

module.exports = { startDocumentExpiryJob };
