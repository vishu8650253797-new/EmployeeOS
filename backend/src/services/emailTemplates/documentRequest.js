const { renderLayout, escapeHtml } = require('./layout');

function documentRequestEmail({ employeeName, title, dueDate }) {
  const due = dueDate ? new Date(dueDate).toDateString() : null;
  const subject = `Document requested: ${title}`;
  const bodyHtml = `
    <p>Hi ${escapeHtml(employeeName)},</p>
    <p>HR has requested the following document from you: <strong>${escapeHtml(title)}</strong>.</p>
    ${due ? `<p>Please upload it by <strong>${escapeHtml(due)}</strong>.</p>` : ''}
    <p>You can upload it from your document requests page.</p>
  `;
  return {
    subject,
    html: renderLayout({ title: 'New document request', bodyHtml }),
    text: `Hi ${employeeName}, HR has requested: ${title}.${due ? ` Please upload it by ${due}.` : ''}`,
  };
}

module.exports = documentRequestEmail;
