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

function buildEmailHtml(opts: {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}) {
  const ctaBlock = opts.ctaLabel && opts.ctaUrl ? `
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#2563eb;border-radius:6px;">
          <a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${opts.ctaLabel}</a>
        </td>
      </tr>
    </table>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${opts.title}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#2563eb;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ClockField</span>
        </td></tr>
        <tr><td style="padding:36px 32px 24px;">
          <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;">${opts.title}</p>
          <div style="font-size:15px;color:#374151;line-height:1.7;">${opts.bodyHtml}</div>
          ${ctaBlock}
          ${opts.footerNote ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;"/><p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">${opts.footerNote}</p>` : ""}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendWelcomeEmailToBusiness(opts: {
  to: string;
  businessName: string;
  appUrl: string;
}): Promise<{ id: string }> {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@mg.clockfield.com>";

  const textBody = `Welcome to ClockField!

Hi ${opts.businessName},

Your business account is set up and ready to go.

ClockField helps you manage your team's schedules, track attendance, handle payroll estimates, and share professional work reports with your clients — all in one place.

Here's what you can do to get started:
- Set up your team under the Employees section
- Create a schedule or assign shifts
- Invite your clients and start sharing work reports

If you have any questions, email us anytime at support@clockfield.com. We're here to help.

Open ClockField: ${opts.appUrl}

— The ClockField Team`;

  const bodyLines = `
<p>Hi <strong>${opts.businessName}</strong>,</p>
<p>Your business account is set up and ready to go.</p>
<p>ClockField helps you manage your team's schedules, track attendance, handle payroll estimates, and share professional work reports with your clients — all in one place.</p>
<p><strong>Here's what you can do to get started:</strong></p>
<ul style="margin:0 0 16px;padding-left:20px;">
  <li style="margin-bottom:6px;">Set up your team under the <strong>Employees</strong> section</li>
  <li style="margin-bottom:6px;">Create a schedule or assign shifts</li>
  <li style="margin-bottom:6px;">Invite your clients and start sharing work reports</li>
</ul>
<p style="margin:0 0 20px;">If you have any questions, email us anytime at <a href="mailto:support@clockfield.com" style="color:#2563eb;">support@clockfield.com</a>. We're here to help.</p>`;

  const html = buildEmailHtml({
    title: "Welcome to ClockField",
    bodyHtml: bodyLines,
    ctaLabel: "Open ClockField",
    ctaUrl: opts.appUrl,
    footerNote: "You are receiving this because you just created a business account on ClockField.",
  });

  const result = await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: "Welcome to ClockField",
    text: textBody,
    html,
  });
  return { id: result.id || "" };
}

export async function sendBroadcastEmails(opts: {
  recipients: Array<{ email: string; businessId: string }>;
  subject: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  appUrl: string;
}): Promise<Array<{ businessId: string; email: string; ok: boolean; messageId?: string; error?: string }>> {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@mg.clockfield.com>";

  const bodyHtml = opts.body
    .split("\n\n")
    .map(p => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const html = buildEmailHtml({
    title: opts.title,
    bodyHtml,
    ctaLabel: opts.ctaLabel || "Open ClockField",
    ctaUrl: opts.ctaUrl || opts.appUrl,
    footerNote: `You are receiving this because you have a business account on ClockField. <a href="${opts.appUrl}" style="color:#2563eb;">View in app</a>`,
  });

  const textBody = `${opts.title}\n\n${opts.body}\n\n${opts.ctaLabel || "Open ClockField"}: ${opts.ctaUrl || opts.appUrl}`;

  // Send in chunks of up to 1000 (Mailgun batch limit)
  const CHUNK = 1000;
  const results: Array<{ businessId: string; email: string; ok: boolean; messageId?: string; error?: string }> = [];

  for (let i = 0; i < opts.recipients.length; i += CHUNK) {
    const chunk = opts.recipients.slice(i, i + CHUNK);
    try {
      const toList = chunk.map(r => r.email);
      const response = await client.messages.create(domain, {
        from,
        to: toList,
        subject: opts.subject,
        text: textBody,
        html,
      });
      const messageId = response.id || "";
      chunk.forEach(r => results.push({ businessId: r.businessId, email: r.email, ok: true, messageId }));
    } catch (err: any) {
      chunk.forEach(r => results.push({ businessId: r.businessId, email: r.email, ok: false, error: err.message }));
    }
  }

  return results;
}
