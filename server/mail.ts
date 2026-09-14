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
    subject: "Reset your ClockField password",
    text: textBody,
    html: htmlBody,
  });
}

export async function sendWelcomeEmailToBusiness(opts: {
  to: string;
  firstName: string;
  companyName: string;
  loginUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Welcome to ClockField, ${opts.firstName}!`;

  const text = `Hi ${opts.firstName},

Welcome to ClockField! Your account for ${opts.companyName} has been created.

To get started, log in at:
${opts.loginUrl}

Thank you,
The ClockField Team`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome, ${opts.firstName}!</p>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Your ClockField account for <strong>${opts.companyName}</strong> is ready. Log in to get started.</p>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.loginUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Log in to ClockField</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendManagementInviteEmail(opts: {
  to: string;
  inviterName: string;
  companyName: string;
  inviteUrl: string;
  role: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `You've been invited to join ${opts.companyName} on ClockField`;

  const text = `Hi,

${opts.inviterName} has invited you to join ${opts.companyName} on ClockField as ${opts.role}.

Accept your invitation:
${opts.inviteUrl}

This link expires in 48 hours.

– The ClockField Team`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">You've been invited</p>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;"><strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.companyName}</strong> on ClockField as <strong>${opts.role}</strong>.</p>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.inviteUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Accept Invitation</a>
</td></tr></table>
<p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">This invitation link expires in <strong>48 hours</strong>.</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendTrialAccountEmail(opts: {
  to: string;
  companyName: string;
  adminEmail: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Your ClockField trial account for ${opts.companyName}`;

  const text = `Hi,

A trial ClockField account has been created for ${opts.companyName}.

Login: ${opts.adminEmail}
Temporary Password: ${opts.tempPassword}

Log in at: ${opts.loginUrl}

– The ClockField Team`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">Trial account created</p>
<p style="margin:0 0 8px;font-size:15px;color:#374151;">Company: <strong>${opts.companyName}</strong></p>
<p style="margin:0 0 8px;font-size:15px;color:#374151;">Login: <strong>${opts.adminEmail}</strong></p>
<p style="margin:0 0 24px;font-size:15px;color:#374151;">Temporary Password: <strong>${opts.tempPassword}</strong></p>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.loginUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Log in now</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendReportEmail(opts: {
  to: string | string[];
  reportType: string;
  reportTitle: string;
  reportUrl: string;
  companyName: string;
  requiresSignature?: boolean;
  customMessage?: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `${opts.reportType} Report: ${opts.reportTitle}`;

  const text = `${opts.companyName} has shared a report with you.

Report: ${opts.reportTitle}
Type: ${opts.reportType}
${opts.requiresSignature ? "This report requires your signature.\n" : ""}
${opts.customMessage ? `Message: ${opts.customMessage}\n` : ""}
View report: ${opts.reportUrl}

– ${opts.companyName}`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">${opts.reportTitle}</p>
<p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.6;"><strong>${opts.companyName}</strong> has shared a <strong>${opts.reportType}</strong> report with you.${opts.requiresSignature ? " <strong>Your signature is required.</strong>" : ""}</p>
${opts.customMessage ? `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${opts.customMessage}</p>` : ""}
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.reportUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">View Report</a>
</td></tr></table>
<p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Or copy this link:</p>
<p style="margin:0;font-size:13px;color:#6b7280;word-break:break-all;">${opts.reportUrl}</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${opts.companyName} &bull; Powered by ClockField</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const toList = Array.isArray(opts.to) ? opts.to : [opts.to];
  await client.messages.create(domain, { from, to: toList, subject, text, html });
}

export async function sendAdminNewRequestEmail(opts: {
  to: string;
  adminName: string;
  submitterName: string;
  requestType: string;
  requestTitle: string;
  requestUrl: string;
  companyName: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `New ${opts.requestType} Request: ${opts.requestTitle}`;

  const text = `Hi ${opts.adminName},

A new ${opts.requestType} request has been submitted by ${opts.submitterName}.

Request: ${opts.requestTitle}

View it here: ${opts.requestUrl}

– ClockField`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">New ${opts.requestType} Request</p>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.adminName}, <strong>${opts.submitterName}</strong> has submitted a new request: <strong>${opts.requestTitle}</strong>.</p>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.requestUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">View Request</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendEmployeeRequestReplyEmail(opts: {
  to: string;
  employeeName: string;
  requestTitle: string;
  replyPreview: string;
  requestUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Reply on your request: ${opts.requestTitle}`;

  const text = `Hi ${opts.employeeName},

There is a new reply on your request "${opts.requestTitle}".

"${opts.replyPreview}"

View full thread: ${opts.requestUrl}

– ClockField`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">New reply on your request</p>
<p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.employeeName}, there is a new reply on <strong>${opts.requestTitle}</strong>.</p>
<blockquote style="margin:0 0 24px;padding:12px 16px;background:#f3f4f6;border-left:3px solid #2563eb;border-radius:4px;font-size:14px;color:#374151;line-height:1.6;">"${opts.replyPreview}"</blockquote>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.requestUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">View Thread</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendAdminRequestReplyEmail(opts: {
  to: string;
  adminName: string;
  requestTitle: string;
  replyPreview: string;
  requestUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `New reply on request: ${opts.requestTitle}`;

  const text = `Hi ${opts.adminName},

There is a new reply on the request "${opts.requestTitle}".

"${opts.replyPreview}"

View full thread: ${opts.requestUrl}

– ClockField`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">New reply on request</p>
<p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.adminName}, there is a new reply on <strong>${opts.requestTitle}</strong>.</p>
<blockquote style="margin:0 0 24px;padding:12px 16px;background:#f3f4f6;border-left:3px solid #2563eb;border-radius:4px;font-size:14px;color:#374151;line-height:1.6;">"${opts.replyPreview}"</blockquote>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.requestUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">View Thread</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendAttendanceLateClockInEmail(opts: {
  to: string;
  adminName: string;
  employeeName: string;
  scheduledTime: string;
  actualTime: string;
  locationName: string;
  minutesLate: number;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Late Clock-In Alert: ${opts.employeeName}`;

  const text = `Hi ${opts.adminName},

${opts.employeeName} clocked in late at ${opts.locationName}.

Scheduled: ${opts.scheduledTime}
Clocked In: ${opts.actualTime}
Minutes Late: ${opts.minutesLate}

– ClockField`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#d97706;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField — Late Alert</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Late Clock-In</p>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.adminName}, <strong>${opts.employeeName}</strong> clocked in <strong>${opts.minutesLate} minute${opts.minutesLate === 1 ? "" : "s"} late</strong> at ${opts.locationName}.</p>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;width:100%;border:1px solid #e5e7eb;border-radius:6px;">
<tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">Scheduled</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;">${opts.scheduledTime}</td></tr>
<tr><td style="padding:10px 16px;font-size:14px;color:#6b7280;">Clocked In</td><td style="padding:10px 16px;font-size:14px;font-weight:600;">${opts.actualTime}</td></tr>
</table>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendAttendanceMissedShiftEmail(opts: {
  to: string;
  adminName: string;
  employeeName: string;
  scheduledTime: string;
  locationName: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Missed Shift Alert: ${opts.employeeName}`;

  const text = `Hi ${opts.adminName},

${opts.employeeName} did not clock in for their scheduled shift at ${opts.locationName}.

Scheduled: ${opts.scheduledTime}

– ClockField`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#dc2626;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField — Missed Shift</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Missed Shift</p>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.adminName}, <strong>${opts.employeeName}</strong> did not clock in for their scheduled shift at <strong>${opts.locationName}</strong>.</p>
<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Scheduled: <strong>${opts.scheduledTime}</strong></p>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendPlatformMessageEmail(opts: {
  to: string;
  recipientName: string;
  subject: string;
  body: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";

  const text = `Hi ${opts.recipientName},

${opts.body}

– The ClockField Team`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#7c3aed;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 24px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">${opts.subject}</p>
<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">Hi ${opts.recipientName},</p>
<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;white-space:pre-line;">${opts.body}</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject: opts.subject, text, html });
}

function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]!);
}

export async function sendFitForDutySubmissionEmail(opts: {
  to: string;
  adminName: string;
  employeeName: string;
  employeeId: string;
  submittedAt: string;
  locationOrShift: string;
  status: "cleared" | "flagged";
  confirmationAccepted: boolean;
  questions: string[];
  answers: boolean[];
  flaggedAnswerIndexes: number[];
  submissionUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const flagged = opts.status === "flagged";
  const statusLabel = flagged ? "Flagged" : "Cleared";
  const subject = flagged
    ? `⚠ Fit for Duty Alert — ${opts.employeeName} — Flagged`
    : `Fit for Duty Submission — ${opts.employeeName} — Cleared`;
  const responseText = opts.questions.map((question, index) =>
    `${question} — ${opts.answers[index] ? "Yes" : "No"}${opts.flaggedAnswerIndexes.includes(index) ? " [FLAGGED]" : ""}`
  ).join("\n");
  const text = `Hi ${opts.adminName},

Employee: ${opts.employeeName}
Employee ID: ${opts.employeeId || "—"}
Date/Time: ${opts.submittedAt}
Location/Shift: ${opts.locationOrShift}
Status: ${statusLabel}
Confirmation: ${opts.confirmationAccepted ? "Accepted" : "Not accepted"}
Live Photo: Captured
${flagged ? "\nAttention: One or more responses may require admin review.\n" : ""}
Questionnaire responses:

${responseText}

View Full Submission:
${opts.submissionUrl}

Admin can securely view the live photo inside ClockField.

– The ClockField Team`;
  const responseRows = opts.questions.map((question, index) => {
    const isFlagged = opts.flaggedAnswerIndexes.includes(index);
    return `<tr style="${isFlagged ? "background:#fef2f2;" : ""}">
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeEmailHtml(question)}</td>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${isFlagged ? "#b91c1c" : "#111827"};">${opts.answers[index] ? "Yes" : "No"}${isFlagged ? " — Flagged" : ""}</td>
    </tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
<tr><td style="background:${flagged ? "#b91c1c" : "#2563eb"};padding:24px 32px;color:#fff;font-size:20px;font-weight:700;">ClockField</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 20px;font-size:22px;color:#111827;">${flagged ? "Fit for Duty Alert" : "Fit for Duty Submission"}</h1>
<p style="color:#374151;">Hi ${escapeEmailHtml(opts.adminName)},</p>
${flagged ? '<p style="padding:12px;background:#fef2f2;border-left:4px solid #dc2626;color:#991b1b;font-weight:600;">Attention: One or more responses may require admin review.</p>' : ""}
<table width="100%" cellpadding="5" cellspacing="0" style="margin:18px 0;color:#374151;">
<tr><td><strong>Employee</strong></td><td>${escapeEmailHtml(opts.employeeName)}</td></tr>
<tr><td><strong>Employee ID</strong></td><td>${escapeEmailHtml(opts.employeeId || "—")}</td></tr>
<tr><td><strong>Date/Time</strong></td><td>${escapeEmailHtml(opts.submittedAt)}</td></tr>
<tr><td><strong>Location/Shift</strong></td><td>${escapeEmailHtml(opts.locationOrShift)}</td></tr>
<tr><td><strong>Status</strong></td><td><strong>${statusLabel}</strong></td></tr>
<tr><td><strong>Confirmation</strong></td><td>${opts.confirmationAccepted ? "Accepted" : "Not accepted"}</td></tr>
<tr><td><strong>Live Photo</strong></td><td>Captured</td></tr>
</table>
<h2 style="font-size:16px;color:#111827;">Questionnaire responses</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">${responseRows}</table>
<p style="margin:26px 0;"><a href="${escapeEmailHtml(opts.submissionUrl)}" style="display:inline-block;padding:12px 20px;background:${flagged ? "#b91c1c" : "#2563eb"};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">View Full Submission</a></p>
<p style="font-size:13px;color:#6b7280;">The live photo is not attached to this email. You can securely view it inside ClockField.</p>
</td></tr></table></td></tr></table></body></html>`;
  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendBroadcastEmails(recipients: { email: string; name: string }[], subject: string, body: string) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";

  const chunkSize = 1000;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    const recipientVariables: Record<string, { name: string }> = {};
    const toList: string[] = [];
    for (const r of chunk) {
      toList.push(r.email);
      recipientVariables[r.email] = { name: r.name };
    }
    const text = body;
    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:32px;">${body.replace(/\n/g, "<br/>")}</body></html>`;
    await client.messages.create(domain, { from, to: toList, subject, text, html, "recipient-variables": JSON.stringify(recipientVariables) });
  }
}

export async function sendProposalEmail(opts: {
  to: string;
  clientName: string;
  businessName: string;
  proposalTitle: string;
  proposalNumber: string;
  proposalUrl: string;
  expiryDate?: string;
  customMessage?: string;
  brandColor?: string;
  logoUrl?: string;
  businessPhone?: string;
  businessEmail?: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const brand = opts.brandColor || "#2563eb";
  const subject = `Proposal from ${opts.businessName}: ${opts.proposalTitle}`;

  const expiryLine = opts.expiryDate
    ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Valid Until</td><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${opts.expiryDate}</td></tr>`
    : "";

  const contactFooter = [opts.businessPhone, opts.businessEmail].filter(Boolean).join(" · ");

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.09);">
        <!-- Header -->
        <tr><td style="background:${brand};padding:28px 36px;text-align:left;">
          ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="${opts.businessName}" style="height:44px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px;"/>` : ""}
          <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.4px;">${opts.businessName}</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 36px 28px;">
          <p style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.5px;">You have a new proposal</p>
          <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.65;">Hi ${opts.clientName !== "there" ? opts.clientName : "there"}, <strong>${opts.businessName}</strong> has prepared a proposal for you.</p>
          ${opts.customMessage ? `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid ${brand};">${opts.customMessage}</p>` : ""}
          <!-- Proposal summary table -->
          <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
            <tr><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Proposal</td><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${opts.proposalTitle} (${opts.proposalNumber})</td></tr>
            <tr><td style="padding:8px 14px;${opts.expiryDate ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;color:#6b7280;">Prepared For</td><td style="padding:8px 14px;${opts.expiryDate ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;">${opts.clientName !== "there" ? opts.clientName : "You"}</td></tr>
            ${expiryLine}
          </table>
          <!-- CTA button -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:${brand};border-radius:8px;">
              <a href="${opts.proposalUrl}" style="display:inline-block;padding:15px 36px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.2px;">View Full Proposal →</a>
            </td></tr>
          </table>
          <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">Or copy this link into your browser:</p>
          <p style="margin:0 0 20px;font-size:12px;color:#6b7280;word-break:break-all;">${opts.proposalUrl}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;"/>
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">Use the proposal link above to view, print, download, accept, or respond. Actions must be completed through the secure link.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:18px 36px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${opts.businessName}${contactFooter ? ` &bull; ${contactFooter}` : ""}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;text-align:center;">Powered by ClockField</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${opts.clientName},\n\n${opts.businessName} has prepared a proposal for you.\n\nProposal: ${opts.proposalTitle} (${opts.proposalNumber})\n${opts.expiryDate ? `Valid until: ${opts.expiryDate}\n` : ""}${opts.customMessage ? `\n${opts.customMessage}\n` : ""}\nView it here:\n${opts.proposalUrl}\n\nThank you,\n${opts.businessName}${opts.businessPhone ? `\n${opts.businessPhone}` : ""}${opts.businessEmail ? `\n${opts.businessEmail}` : ""}`;

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject,
    text,
    html,
  });
}

export async function sendHiringPackageEmail(opts: {
  to: string;
  employeeName: string;
  companyName: string;
  publicLink: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Your Hiring Package from ${opts.companyName}`;
  const text = `Hi ${opts.employeeName},\n\n${opts.companyName} has sent you a hiring package to complete.\n\nPlease use the secure link below to review company policies, provide your personal information, upload required documents, and sign digitally.\n\nComplete your hiring package:\n${opts.publicLink}\n\nYou can return to the same link at any time to check your progress.\n\nThank you,\n${opts.companyName}`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${subject}</title></head><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);"><tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#ffffff;font-size:20px;font-weight:700;">ClockField</span></td></tr><tr><td style="padding:36px 32px 24px;"><p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Your Hiring Package from ${opts.companyName}</p><p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.employeeName}, ${opts.companyName} has sent you a hiring package to complete. Please review and complete it using the secure link below.</p><table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;"><a href="${opts.publicLink}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Complete Hiring Package</a></td></tr></table><p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Or copy and paste this URL into your browser:</p><p style="margin:0 0 24px;font-size:13px;color:#6b7280;word-break:break-all;">${opts.publicLink}</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;"/><p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">This link is unique to you. Please keep it safe and do not share it with others.</p></td></tr><tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Powered by ClockField &mdash; &copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
  await client.messages.create(domain, {
    from,
    to: opts.to,
    subject,
    text,
    html,
  });
}

export async function sendTrainingAssignmentEmail(opts: {
  to: string;
  employeeName: string;
  companyName: string;
  courseTitle: string;
  isRequired: boolean;
  dueDate?: string | null;
  appUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `New Training Assigned: ${opts.courseTitle}`;
  const statusLabel = opts.isRequired ? "Required" : "Optional";
  const dueLine = opts.dueDate ? `\nDue Date: ${opts.dueDate}` : "";

  const text = `Hi ${opts.employeeName},

You have been assigned a training course in Clockfield.

Training: ${opts.courseTitle}
Assigned by: ${opts.companyName}
Status: ${statusLabel}${dueLine}

Please complete this training when you get a chance.

How to complete it:
1. Log in to your Clockfield employee app.
2. Go to your Profile.
3. Open the Training section.
4. Select the assigned training.
5. Review the course and complete the quiz or required steps.

Open Clockfield: ${opts.appUrl}

Thank you,
${opts.companyName}`;

  const dueDateRow = opts.dueDate
    ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Due Date</td><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${opts.dueDate}</td></tr>`
    : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#ffffff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 28px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">New Training Assigned</p>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi <strong>${opts.employeeName}</strong>, you have been assigned a training course by <strong>${opts.companyName}</strong>.</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:28px;">
<tr><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Training</td><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${opts.courseTitle}</td></tr>
<tr><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Assigned by</td><td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${opts.companyName}</td></tr>
<tr><td style="padding:8px 14px;${opts.dueDate ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;color:#6b7280;">Status</td><td style="padding:8px 14px;${opts.dueDate ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;"><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${opts.isRequired ? "#fef3c7" : "#f0fdf4"};color:${opts.isRequired ? "#92400e" : "#166534"};">${statusLabel}</span></td></tr>
${dueDateRow}
</table>
<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;"><strong>How to complete it:</strong></p>
<ol style="margin:0 0 28px;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
<li>Log in to your Clockfield employee app</li>
<li>Go to your <strong>Profile</strong></li>
<li>Open the <strong>Training</strong> section</li>
<li>Select <strong>${opts.courseTitle}</strong></li>
<li>Review the course and complete the required steps</li>
</ol>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.appUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Open Training</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${opts.companyName} &bull; Powered by ClockField</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendTrainingReminderEmail(opts: {
  to: string;
  employeeName: string;
  companyName: string;
  courseTitle: string;
  appUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Reminder: Complete Your Assigned Training — ${opts.courseTitle}`;

  const text = `Hi ${opts.employeeName},

This is a friendly reminder that you still have an assigned training to complete in Clockfield.

Training: ${opts.courseTitle}
Assigned by: ${opts.companyName}

Please log in to your employee app, go to Profile → Training, and complete it when you can.

Open Clockfield: ${opts.appUrl}

Thank you,
${opts.companyName}`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:24px 32px;"><span style="color:#ffffff;font-size:20px;font-weight:700;">ClockField</span></td></tr>
<tr><td style="padding:36px 32px 28px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Training Reminder</p>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi <strong>${opts.employeeName}</strong>, this is a friendly reminder that you still have a training course to complete.</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:28px;">
<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Training</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${opts.courseTitle}</td></tr>
<tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;">Assigned by</td><td style="padding:10px 14px;font-size:13px;">${opts.companyName}</td></tr>
</table>
<p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">Log in to your employee app and go to <strong>Profile → Training</strong> to complete it.</p>
<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#2563eb;border-radius:6px;">
<a href="${opts.appUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Open Training</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${opts.companyName} &bull; Powered by ClockField</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendBookingQuoteEmail(opts: {
  to: string;
  clientName: string;
  businessName: string;
  serviceType: string;
  quoteUrl: string;
  price: string;
  expiresAt?: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Your cleaning service quote from ${opts.businessName}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center"><table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.09);"><tr><td style="background:#2563eb;padding:28px 36px;"><span style="color:#fff;font-size:22px;font-weight:700;">${opts.businessName}</span></td></tr><tr><td style="padding:36px;"><p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Your quote is ready</p><p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hi ${opts.clientName}, your service quote from <strong>${opts.businessName}</strong> is ready to review.</p><table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;"><tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Service</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${opts.serviceType}</td></tr><tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;">Quoted Price</td><td style="padding:10px 14px;font-size:15px;font-weight:700;color:#111827;">${opts.price}</td></tr></table><table cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="background:#2563eb;border-radius:8px;"><a href="${opts.quoteUrl}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:16px;font-weight:700;text-decoration:none;">View &amp; Accept Quote</a></td></tr></table><p style="margin:0;font-size:12px;color:#9ca3af;">Or copy: ${opts.quoteUrl}</p></td></tr><tr><td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${opts.businessName} · Powered by ClockField</p></td></tr></table></td></tr></table></body></html>`;
  const text = `Hi ${opts.clientName},\n\nYour quote from ${opts.businessName} is ready.\nService: ${opts.serviceType}\nPrice: ${opts.price}\n\nView: ${opts.quoteUrl}\n\nThank you,\n${opts.businessName}`;
  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendQuoteAcceptedAdminEmail(opts: {
  to: string;
  clientName: string;
  serviceType: string;
  serviceAddress: string;
  price: string;
  preferredDate: string;
  appUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Quote accepted: ${opts.clientName} — ${opts.serviceType}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.09);"><tr><td style="background:#16a34a;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">Quote Accepted</span></td></tr><tr><td style="padding:32px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">A client has accepted a quote in ClockField.</p><table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;"><tr><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Client</td><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${opts.clientName}</td></tr><tr><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Service</td><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${opts.serviceType}</td></tr><tr><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Address</td><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${opts.serviceAddress}</td></tr><tr><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Price</td><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:700;color:#16a34a;">${opts.price}</td></tr><tr><td style="padding:9px 14px;font-size:13px;color:#6b7280;">Preferred Date</td><td style="padding:9px 14px;font-size:13px;">${opts.preferredDate}</td></tr></table><table cellpadding="0" cellspacing="0"><tr><td style="background:#2563eb;border-radius:8px;"><a href="${opts.appUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Open Booking Requests</a></td></tr></table></td></tr></table></td></tr></table></body></html>`;
  const text = `Quote accepted!\nClient: ${opts.clientName}\nService: ${opts.serviceType}\nAddress: ${opts.serviceAddress}\nPrice: ${opts.price}\nPreferred Date: ${opts.preferredDate}\n\nLog in: ${opts.appUrl}`;
  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}

export async function sendQuoteDeclinedAdminEmail(opts: {
  to: string;
  clientName: string;
  serviceType: string;
  declineReason?: string;
  appUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const subject = `Quote declined: ${opts.clientName} — ${opts.serviceType}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.09);"><tr><td style="background:#dc2626;padding:24px 32px;"><span style="color:#fff;font-size:20px;font-weight:700;">Quote Declined</span></td></tr><tr><td style="padding:32px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">${opts.clientName} has declined a quote.</p><table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;"><tr><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Client</td><td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${opts.clientName}</td></tr><tr><td style="padding:9px 14px;${opts.declineReason ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;color:#6b7280;">Service</td><td style="padding:9px 14px;${opts.declineReason ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;">${opts.serviceType}</td></tr>${opts.declineReason ? `<tr><td style="padding:9px 14px;font-size:13px;color:#6b7280;">Reason</td><td style="padding:9px 14px;font-size:13px;">${opts.declineReason}</td></tr>` : ""}</table><table cellpadding="0" cellspacing="0"><tr><td style="background:#2563eb;border-radius:8px;"><a href="${opts.appUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Open Booking Requests</a></td></tr></table></td></tr></table></td></tr></table></body></html>`;
  const text = `Quote declined by ${opts.clientName}.\nService: ${opts.serviceType}${opts.declineReason ? `\nReason: ${opts.declineReason}` : ""}\n\nLog in: ${opts.appUrl}`;
  await client.messages.create(domain, { from, to: [opts.to], subject, text, html });
}
