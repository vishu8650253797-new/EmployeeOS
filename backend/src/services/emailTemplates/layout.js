function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLayout({ title, bodyHtml }) {
  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; background:#f4f5f7; padding:24px; margin:0;">
    <table role="presentation" width="100%" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden;">
      <tr>
        <td style="background:#111827; padding:20px 24px;">
          <span style="color:#ffffff; font-size:18px; font-weight:bold;">EmployeeOS</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px; color:#1f2937; font-size:14px; line-height:1.6;">
          <h2 style="margin-top:0; font-size:18px;">${escapeHtml(title)}</h2>
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; color:#9ca3af; font-size:12px; border-top:1px solid #e5e7eb;">
          This is an automated message from EmployeeOS.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = { renderLayout, escapeHtml };
