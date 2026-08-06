const { renderLayout, escapeHtml } = require('./layout');

function welcomeEmail({ employeeName, startDate }) {
  const formattedDate = startDate ? new Date(startDate).toDateString() : 'soon';
  const subject = `Welcome to the team, ${employeeName}!`;
  const bodyHtml = `
    <p>Hi ${escapeHtml(employeeName)},</p>
    <p>We're excited to have you join us! Your onboarding has started, with a joining date of <strong>${escapeHtml(formattedDate)}</strong>.</p>
    <p>HR will be in touch with your pre-boarding checklist — required documents, bank and tax details, and a few other details to get you set up before day one.</p>
    <p>Welcome aboard!</p>
  `;
  return {
    subject,
    html: renderLayout({ title: 'Welcome to the team!', bodyHtml }),
    text: `Hi ${employeeName}, welcome to the team! Your joining date is ${formattedDate}. HR will be in touch with your pre-boarding checklist.`,
  };
}

module.exports = welcomeEmail;
