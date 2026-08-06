const nodemailer = require('nodemailer');
const templates = require('./emailTemplates');

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

// Best-effort: a failed or unconfigured email must never throw into a request handler —
// callers use this fire-and-forget, the same contract as notifyHR/notifyUser.
async function sendMail({ to, subject, html, text }) {
  try {
    if (!to) return { sent: false, reason: 'no_recipient' };
    const client = getTransporter();
    if (!client) {
      console.warn(`[email] SMTP not configured — skipping "${subject}" to ${to}`);
      return { sent: false, reason: 'not_configured' };
    }
    await client.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

async function sendWelcomeEmail(data) {
  const { subject, html, text } = templates.welcomeEmail(data);
  return sendMail({ to: data.to, subject, html, text });
}

async function sendOfferEmail(data) {
  const { subject, html, text } = templates.offerSentEmail(data);
  return sendMail({ to: data.to, subject, html, text });
}

async function sendOfferResponseConfirmationEmail(data) {
  const { subject, html, text } = templates.offerResponseEmail(data);
  return sendMail({ to: data.to, subject, html, text });
}

async function sendJoiningDateConfirmedEmail(data) {
  const { subject, html, text } = templates.joiningDateConfirmedEmail(data);
  return sendMail({ to: data.to, subject, html, text });
}

async function sendDocumentRequestEmail(data) {
  const { subject, html, text } = templates.documentRequestEmail(data);
  return sendMail({ to: data.to, subject, html, text });
}

module.exports = {
  isConfigured,
  sendMail,
  sendWelcomeEmail,
  sendOfferEmail,
  sendOfferResponseConfirmationEmail,
  sendJoiningDateConfirmedEmail,
  sendDocumentRequestEmail,
};
