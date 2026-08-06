const { renderLayout, escapeHtml } = require('./layout');

function joiningDateConfirmedEmail({ employeeName, joiningDate }) {
  const formattedDate = new Date(joiningDate).toDateString();
  const subject = 'Your joining date has been confirmed';
  const bodyHtml = `
    <p>Hi ${escapeHtml(employeeName)},</p>
    <p>Your joining date has been confirmed as <strong>${escapeHtml(formattedDate)}</strong>.</p>
    <p>We look forward to having you on board!</p>
  `;
  return {
    subject,
    html: renderLayout({ title: 'Joining date confirmed', bodyHtml }),
    text: `Hi ${employeeName}, your joining date has been confirmed as ${formattedDate}.`,
  };
}

module.exports = joiningDateConfirmedEmail;
