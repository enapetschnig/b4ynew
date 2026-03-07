interface EmailHtmlParams {
  recipientName: string;
  subject: string;
  body: string;
  signature?: string;
  senderName?: string;
}

export function buildEmailHtml({
  recipientName,
  subject,
  body,
  signature,
  senderName,
}: EmailHtmlParams): string {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br>');
  const signatureHtml = signature
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;color:#666;font-size:14px;">${escapeHtml(signature).replace(/\n/g, '<br>')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
  <!-- Header -->
  <tr><td style="background-color:#cc1d1d;padding:20px 32px;">
    <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">BAU4YOU</span>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px;color:#333333;font-size:15px;line-height:1.6;">
    ${bodyHtml}
    ${signatureHtml}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:16px 32px;background-color:#fafafa;border-top:1px solid #eee;text-align:center;">
    <span style="color:#999;font-size:12px;">Gesendet via BAU4YOU</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
