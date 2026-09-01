const { renderLayout, escapeHtml } = require('./layout');

function passwordResetEmail({ firstName, resetUrl }) {
  const subject = 'Reset your EmployeeOS password';
  const bodyHtml = `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>We received a request to reset your EmployeeOS password. This link expires in 30 minutes.</p>
    <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block; padding:10px 18px; background:#111827; color:#ffffff; border-radius:6px; text-decoration:none;">Reset password</a></p>
    <p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
  `;
  return {
    subject,
    html: renderLayout({ title: 'Reset your password', bodyHtml }),
    text: `Hi ${firstName}, reset your EmployeeOS password here (expires in 30 minutes): ${resetUrl}`,
  };
}

module.exports = passwordResetEmail;
