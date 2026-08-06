const { renderLayout, escapeHtml } = require('./layout');

function offerSentEmail({ candidateName, jobTitle, responseUrl, offerExpiryDate }) {
  const expiry = offerExpiryDate ? new Date(offerExpiryDate).toDateString() : null;
  const subject = `Your offer for ${jobTitle}`;
  const bodyHtml = `
    <p>Hi ${escapeHtml(candidateName)},</p>
    <p>Congratulations! We'd like to offer you the <strong>${escapeHtml(jobTitle)}</strong> position.</p>
    <p>Please review and respond to your offer here: <a href="${escapeHtml(responseUrl)}">${escapeHtml(responseUrl)}</a></p>
    ${expiry ? `<p>This offer is valid until <strong>${escapeHtml(expiry)}</strong>.</p>` : ''}
  `;
  return {
    subject,
    html: renderLayout({ title: 'You have a new job offer', bodyHtml }),
    text: `Hi ${candidateName}, you have an offer for ${jobTitle}. Respond here: ${responseUrl}${expiry ? ` (valid until ${expiry})` : ''}`,
  };
}

module.exports = offerSentEmail;
