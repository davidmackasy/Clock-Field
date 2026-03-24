import FormData from "form-data";
import Mailgun from "mailgun.js";

const mailgun = new Mailgun(FormData);

function getClient() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) throw new Error("Mailgun not configured");
  const client = mailgun.client({ username: "api", key: apiKey });
  return { client, domain };
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
  firstName: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";

  const textBody = `Hi ${opts.firstName},

We received a request to reset your Clockfield password.

Click the link below to choose a new password:
${opts.resetUrl}

This link expires in 20 minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email. Your password will not change.

– The ClockField Team`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset your ClockField password</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#2563eb;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ClockField</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 24px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Reset your password</p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.firstName}, we received a request to reset the password for your ClockField account.</p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#2563eb;border-radius:6px;">
                    <a href="${opts.resetUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Reset password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Or copy and paste this URL into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;color:#6b7280;word-break:break-all;">${opts.resetUrl}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;"/>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">This link expires in <strong>20 minutes</strong> and can only be used once. If you didn't request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: "Reset your Clockfield password",
    text: textBody,
    html: htmlBody,
  });
}
