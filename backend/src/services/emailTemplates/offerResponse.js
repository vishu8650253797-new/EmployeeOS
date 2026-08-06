const { renderLayout, escapeHtml } = require('./layout');

function offerResponseEmail({ candidateName, jobTitle, accepted }) {
  const subject = accepted ? `Offer accepted — ${jobTitle}` : `Offer response received — ${jobTitle}`;
  const bodyHtml = accepted
    ? `<p>Hi ${escapeHtml(candidateName)},</p><p>Thanks for accepting the <strong>${escapeHtml(jobTitle)}</strong> offer! Our team will reach out shortly with next steps.</p>`
    : `<p>Hi ${escapeHtml(candidateName)},</p><p>We've received your response declining the <strong>${escapeHtml(jobTitle)}</strong> offer. Thank you for your time, and we wish you the best.</p>`;
  return {
    subject,
    html: renderLayout({ title: accepted ? 'Thanks for accepting!' : 'Offer response received', bodyHtml }),
    text: accepted
      ? `Hi ${candidateName}, thanks for accepting the ${jobTitle} offer! We'll be in touch shortly.`
      : `Hi ${candidateName}, we've received your response declining the ${jobTitle} offer.`,
  };
}

module.exports = offerResponseEmail;
