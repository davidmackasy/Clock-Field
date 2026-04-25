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

  const subscribeUrl = `${opts.appUrl}/admin/subscription`;

  const textBody = `Welcome to ClockField — Complete your subscription

Hi ${opts.businessName},

Your business account has been created.

Before you can access ClockField, you need to complete your subscription by choosing one of our plans.

Once your subscription is active, you will be able to manage your team, track work, organize schedules, monitor attendance, and keep your business operations in one place.

Complete Subscription: ${subscribeUrl}

After subscribing, open ClockField and get started: ${opts.appUrl}

— The ClockField Team`;

  const bodyLines = `
<p>Hi <strong>${opts.businessName}</strong>,</p>
<p>Your business account has been created.</p>
<p>Before you can access ClockField, you need to complete your subscription by choosing one of our plans.</p>
<p>Once your subscription is active, you will be able to manage your team, track work, organize schedules, monitor attendance, and keep your business operations in one place.</p>
<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">After subscribing, you can open ClockField and start using your account. <a href="${opts.appUrl}" style="color:#2563eb;text-decoration:none;">Open ClockField</a></p>`;

  const html = buildEmailHtml({
    title: "Your business account has been created",
    bodyHtml: bodyLines,
    ctaLabel: "Complete Subscription",
    ctaUrl: subscribeUrl,
    footerNote: "You are receiving this because you just created a business account on ClockField.",
  });

  const result = await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: "Welcome to ClockField — Complete your subscription",
    text: textBody,
    html,
  });
  return { id: result.id || "" };
}

export async function sendReportEmail(opts: {
  to: string;
  recipientName: string;
  reportType: string;
  reportTitle: string;
  reportDate: string | null;
  companyName: string;
  reportUrl: string;
  requiresSignature: boolean;
}): Promise<void> {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@mg.clockfield.com>";

  const typeTitles: Record<string, string> = {
    incident: "Incident Report",
    issue: "Issue Report",
    damage: "Damage Report",
    statement: "Statement Report",
    complaint: "Complaint Report",
    general: "General Report",
  };
  const typeLabel = typeTitles[opts.reportType] || "Report";
  const subject = `${typeLabel} Ready for Review`;

  const sigNote = opts.requiresSignature
    ? `<p style="margin:0 0 14px;color:#374151;">Your signature is required on this report. Please sign it through the secure ClockField portal.</p>`
    : "";

  const dateRow = opts.reportDate
    ? `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Date</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${opts.reportDate}</td></tr>`
    : "";

  const bodyHtml = `
<p style="margin:0 0 14px;color:#374151;">Hi <strong>${opts.recipientName}</strong>,</p>
<p style="margin:0 0 14px;color:#374151;">A report has been shared with you by <strong>${opts.companyName}</strong> through ClockField.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0 20px;border-radius:6px;border:1px solid #e5e7eb;overflow:hidden;">
  <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:120px;">Report type</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${typeLabel}</td></tr>
  <tr><td style="padding:10px 14px;${opts.reportDate ? "border-bottom:1px solid #e5e7eb;" : ""}color:#6b7280;font-size:13px;">Title</td><td style="padding:10px 14px;${opts.reportDate ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;">${opts.reportTitle}</td></tr>
  ${dateRow}
</table>
<p style="margin:0 0 14px;color:#374151;font-size:14px;">You can review this report directly using the secure link below. No sign-in is required.</p>
${sigNote}`;

  const html = buildEmailHtml({
    title: subject,
    bodyHtml,
    ctaLabel: opts.requiresSignature ? "Review &amp; Sign Report" : "View Report",
    ctaUrl: opts.reportUrl,
    footerNote: `You are receiving this because a report was shared with you by ${opts.companyName} through ClockField.`,
  });

  const textBody = `Hi ${opts.recipientName},\n\nA report has been shared with you by ${opts.companyName} through ClockField. No sign-in is required.\n\nReport type: ${typeLabel}\nTitle: ${opts.reportTitle}${opts.reportDate ? `\nDate: ${opts.reportDate}` : ""}\n\nView the report here: ${opts.reportUrl}\n\nRegards,\n${opts.companyName}`;

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject,
    text: textBody,
    html,
  });
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

export async function sendManagementInviteEmail(opts: {
  to: string;
  firstName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const roleLabel = opts.role === "admin" ? "Admin" : opts.role === "assistant" ? "Assistant" : "Team";

  const textBody = `Hi ${opts.firstName},

You've been invited to join ${opts.companyName} on ClockField as a ${roleLabel}.

Click the link below to set up your access:
${opts.inviteUrl}

This invite link expires in 48 hours.

If you weren't expecting this invite, you can safely ignore this email.

– The ClockField Team`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#2563eb;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ClockField</span>
        </td></tr>
        <tr><td style="padding:36px 32px 24px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">You've been invited</p>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.firstName}, <strong>${opts.companyName}</strong> has invited you to join ClockField as a <strong>${roleLabel}</strong>.</p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#2563eb;border-radius:6px;">
              <a href="${opts.inviteUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Accept Invite</a>
            </td></tr>
          </table>
          <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Or copy and paste this URL into your browser:</p>
          <p style="margin:0 0 24px;font-size:13px;color:#6b7280;word-break:break-all;">${opts.inviteUrl}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;"/>
          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">This invite expires in <strong>48 hours</strong>. If you weren't expecting this invitation, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: `You've been invited to join ${opts.companyName} on ClockField`,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendPlatformMessageEmail(opts: {
  to: string;
  adminName: string;
  subject: string;
  preview?: string;
  messageType?: string;
  loginUrl?: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const loginUrl = opts.loginUrl || "https://app.clockfield.com";
  const typeLabel = opts.messageType === "billing" ? "Billing Notice"
    : opts.messageType === "warning" ? "Important Notice"
    : opts.messageType === "support" ? "Support Message"
    : opts.messageType === "promotion" ? "Announcement"
    : "New Message";

  const textBody = `Hi ${opts.adminName},

You have a new ${typeLabel.toLowerCase()} in ClockField.

Subject: ${opts.subject}
${opts.preview ? `\nPreview:\n${opts.preview}\n` : ""}
Log in to your account to read the full message:
${loginUrl}

– The ClockField Team`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#7c3aed;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ClockField</span>
        </td></tr>
        <tr><td style="padding:36px 32px 24px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:0.5px;">${typeLabel}</p>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">You have a new message</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${opts.adminName}, you received a new message in ClockField.</p>
          <div style="background:#f8f7ff;border:1px solid #e9d5ff;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:12px;color:#7c3aed;font-weight:600;text-transform:uppercase;">Subject</p>
            <p style="margin:0;font-size:15px;color:#111827;font-weight:600;">${opts.subject}</p>
            ${opts.preview ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">${opts.preview.slice(0, 200)}${opts.preview.length > 200 ? "..." : ""}</p>` : ""}
          </div>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#7c3aed;border-radius:6px;">
              <a href="${loginUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Open ClockField</a>
            </td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;"/>
          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">This is a notification from ClockField Platform. Log in to reply or view the full message.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: `${typeLabel}: ${opts.subject}`,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendAttendanceLateClockInEmail(opts: {
  to: string;
  adminName: string;
  employeeName: string;
  locationName?: string;
  scheduledStart: string;
  actualClockIn: string;
  minutesLate: number;
  loginUrl?: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const loginUrl = opts.loginUrl || "https://app.clockfield.com";

  const textBody = `Employee Clocked In Late — ClockField Alert

Hi ${opts.adminName},

An employee has clocked in late.

Employee: ${opts.employeeName}
${opts.locationName ? `Location: ${opts.locationName}\n` : ""}Scheduled Start: ${opts.scheduledStart}
Actual Clock-In: ${opts.actualClockIn}
Minutes Late: ${opts.minutesLate}

View attendance: ${loginUrl}/admin/attendance

– ClockField`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#d97706;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">ClockField</span>
        </td></tr>
        <tr><td style="padding:36px 32px 24px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#d97706;text-transform:uppercase;">Attendance Alert</p>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Employee Clocked In Late</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${opts.adminName}, an employee clocked in late today.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fde68a;border-radius:6px;margin-bottom:24px;background:#fffbeb;">
            <tr><td style="padding:16px 20px;">
              <table width="100%" cellpadding="0" cellspacing="6">
                <tr><td style="font-size:12px;color:#92400e;font-weight:600;width:140px;">Employee</td><td style="font-size:14px;color:#111827;font-weight:600;">${opts.employeeName}</td></tr>
                ${opts.locationName ? `<tr><td style="font-size:12px;color:#92400e;font-weight:600;">Location</td><td style="font-size:14px;color:#374151;">${opts.locationName}</td></tr>` : ""}
                <tr><td style="font-size:12px;color:#92400e;font-weight:600;">Scheduled</td><td style="font-size:14px;color:#374151;">${opts.scheduledStart}</td></tr>
                <tr><td style="font-size:12px;color:#92400e;font-weight:600;">Clocked In</td><td style="font-size:14px;color:#374151;">${opts.actualClockIn}</td></tr>
                <tr><td style="font-size:12px;color:#92400e;font-weight:600;">Minutes Late</td><td style="font-size:14px;color:#dc2626;font-weight:700;">${opts.minutesLate} min</td></tr>
              </table>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#d97706;border-radius:6px;">
              <a href="${loginUrl}/admin/attendance" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">View Attendance</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: `Late Clock-In: ${opts.employeeName} (${opts.minutesLate} min late)`,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendAttendanceMissedShiftEmail(opts: {
  to: string;
  adminName: string;
  employeeName: string;
  locationName?: string;
  shiftDate: string;
  scheduledShift: string;
  loginUrl?: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const loginUrl = opts.loginUrl || "https://app.clockfield.com";

  const textBody = `Employee Missed Shift — ClockField Alert

Hi ${opts.adminName},

An employee missed their scheduled shift.

Employee: ${opts.employeeName}
${opts.locationName ? `Location: ${opts.locationName}\n` : ""}Date: ${opts.shiftDate}
Scheduled Shift: ${opts.scheduledShift}

Review attendance: ${loginUrl}/admin/attendance

– ClockField`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#dc2626;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">ClockField</span>
        </td></tr>
        <tr><td style="padding:36px 32px 24px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#dc2626;text-transform:uppercase;">Missed Shift Alert</p>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Employee Missed Shift</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${opts.adminName}, an employee missed their scheduled shift.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fca5a5;border-radius:6px;margin-bottom:24px;background:#fef2f2;">
            <tr><td style="padding:16px 20px;">
              <table width="100%" cellpadding="0" cellspacing="6">
                <tr><td style="font-size:12px;color:#991b1b;font-weight:600;width:140px;">Employee</td><td style="font-size:14px;color:#111827;font-weight:600;">${opts.employeeName}</td></tr>
                ${opts.locationName ? `<tr><td style="font-size:12px;color:#991b1b;font-weight:600;">Location</td><td style="font-size:14px;color:#374151;">${opts.locationName}</td></tr>` : ""}
                <tr><td style="font-size:12px;color:#991b1b;font-weight:600;">Date</td><td style="font-size:14px;color:#374151;">${opts.shiftDate}</td></tr>
                <tr><td style="font-size:12px;color:#991b1b;font-weight:600;">Shift</td><td style="font-size:14px;color:#374151;">${opts.scheduledShift}</td></tr>
              </table>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#dc2626;border-radius:6px;">
              <a href="${loginUrl}/admin/attendance" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Review Attendance</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} ClockField. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: `Missed Shift: ${opts.employeeName} — ${opts.shiftDate}`,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendAdminNewRequestEmail(opts: {
  adminEmail: string;
  adminName: string;
  requesterName: string;
  requesterRole: string;
  requestTitle: string;
  requestType: string;
  priority: string;
  businessName: string;
  submittedAt: string;
  hasAttachments: boolean;
  messagePreview: string | null;
  appUrl: string;
}): Promise<void> {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@mg.clockfield.com>";
  const ctaUrl = `${opts.appUrl}/admin/requests`;
  const roleLabel = opts.requesterRole === "employee" ? "Employee" : opts.requesterRole === "client" ? "Client" : "Staff";
  const typeLabel = opts.requestType.replace(/_/g, " ");
  const priorityColor = (opts.priority === "urgent" || opts.priority === "high") ? "#dc2626" : "#374151";

  const textBody = `New ${roleLabel} Request — ClockField

Hi ${opts.adminName},

${opts.requesterName} has submitted a new request.

Title: ${opts.requestTitle}
Type: ${typeLabel}
Priority: ${opts.priority}
Submitted by: ${opts.requesterName} (${roleLabel})
Submitted at: ${opts.submittedAt}
${opts.messagePreview ? `\nMessage preview:\n${opts.messagePreview}\n` : ""}${opts.hasAttachments ? "Attachments: Yes\n" : ""}
View the request in ClockField: ${ctaUrl}

– The ClockField Team`;

  const bodyHtml = `
<p style="margin:0 0 14px;color:#374151;">Hi <strong>${opts.adminName}</strong>,</p>
<p style="margin:0 0 14px;color:#374151;"><strong>${opts.requesterName}</strong> has submitted a new request for your attention.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px;border-radius:6px;border:1px solid #e5e7eb;overflow:hidden;">
  <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:120px;">Title</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${opts.requestTitle}</td></tr>
  <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Type</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${typeLabel}</td></tr>
  <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Priority</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:${priorityColor};">${opts.priority}</td></tr>
  <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Submitted by</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${opts.requesterName} <span style="color:#9ca3af;">(${roleLabel})</span></td></tr>
  <tr><td style="padding:10px 14px;${opts.messagePreview || opts.hasAttachments ? "border-bottom:1px solid #e5e7eb;" : ""}color:#6b7280;font-size:13px;">Submitted at</td><td style="padding:10px 14px;${opts.messagePreview || opts.hasAttachments ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;">${opts.submittedAt}</td></tr>
  ${opts.hasAttachments ? `<tr><td style="padding:10px 14px;${opts.messagePreview ? "border-bottom:1px solid #e5e7eb;" : ""}color:#6b7280;font-size:13px;">Attachments</td><td style="padding:10px 14px;${opts.messagePreview ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;">Yes</td></tr>` : ""}
  ${opts.messagePreview ? `<tr><td style="padding:10px 14px;color:#6b7280;font-size:13px;vertical-align:top;">Preview</td><td style="padding:10px 14px;font-size:13px;color:#374151;">${opts.messagePreview.slice(0, 200)}${opts.messagePreview.length > 200 ? "…" : ""}</td></tr>` : ""}
</table>`;

  const html = buildEmailHtml({
    title: `New request: ${opts.requestTitle}`,
    bodyHtml,
    ctaLabel: "View Request",
    ctaUrl,
    footerNote: `You are receiving this because a ${roleLabel.toLowerCase()} submitted a request in your ClockField account.`,
  });

  await client.messages.create(domain, {
    from,
    to: [opts.adminEmail],
    subject: `New ${roleLabel.toLowerCase()} request: ${opts.requestTitle}`,
    text: textBody,
    html,
  });
}

export async function sendEmployeeRequestReplyEmail(opts: {
  to: string;
  recipientName: string;
  requestTitle: string;
  replyPreview: string | null;
  businessName: string;
  repliedAt: string;
  appUrl: string;
}): Promise<void> {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@mg.clockfield.com>";
  const ctaUrl = `${opts.appUrl}/employee/requests`;

  const textBody = `Your request has a reply — ClockField

Hi ${opts.recipientName},

Your request "${opts.requestTitle}" has received a reply from ${opts.businessName}.

${opts.replyPreview ? `Reply preview:\n${opts.replyPreview}\n\n` : ""}Log in to view the full reply: ${ctaUrl}

– The ClockField Team`;

  const bodyHtml = `
<p style="margin:0 0 14px;color:#374151;">Hi <strong>${opts.recipientName}</strong>,</p>
<p style="margin:0 0 14px;color:#374151;"><strong>${opts.businessName}</strong> has replied to your request.</p>
<div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:6px;padding:16px 20px;margin:0 0 20px;">
  <p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Request</p>
  <p style="margin:0 0 12px;font-size:15px;color:#111827;font-weight:600;">${opts.requestTitle}</p>
  ${opts.replyPreview ? `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Reply preview</p><p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${opts.replyPreview.slice(0, 200)}${opts.replyPreview.length > 200 ? "…" : ""}</p>` : ""}
</div>
<p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Replied at: ${opts.repliedAt}</p>`;

  const html = buildEmailHtml({
    title: `Reply to your request`,
    bodyHtml,
    ctaLabel: "View Full Reply",
    ctaUrl,
    footerNote: `You are receiving this because you submitted a request in ClockField. Log in to reply or view the full conversation.`,
  });

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: `Your request has a reply: ${opts.requestTitle}`,
    text: textBody,
    html,
  });
}

export async function sendAdminRequestReplyEmail(opts: {
  to: string;
  adminName: string;
  replierName: string;
  replierRole: string;
  requestTitle: string;
  replyPreview: string | null;
  businessName: string;
  repliedAt: string;
  appUrl: string;
}): Promise<void> {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@mg.clockfield.com>";
  const ctaUrl = `${opts.appUrl}/admin/requests`;
  const roleLabel = opts.replierRole === "client" ? "Client" : "Employee";

  const textBody = `New reply on request — ClockField

Hi ${opts.adminName},

${opts.replierName} (${roleLabel}) has replied to the request "${opts.requestTitle}".

${opts.replyPreview ? `Reply preview:\n${opts.replyPreview}\n\n` : ""}Log in to view the full conversation: ${ctaUrl}

– The ClockField Team`;

  const bodyHtml = `
<p style="margin:0 0 14px;color:#374151;">Hi <strong>${opts.adminName}</strong>,</p>
<p style="margin:0 0 14px;color:#374151;"><strong>${opts.replierName}</strong> <span style="color:#6b7280;">(${roleLabel})</span> has replied to a request.</p>
<div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:6px;padding:16px 20px;margin:0 0 20px;">
  <p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Request</p>
  <p style="margin:0 0 12px;font-size:15px;color:#111827;font-weight:600;">${opts.requestTitle}</p>
  ${opts.replyPreview ? `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Reply preview</p><p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${opts.replyPreview.slice(0, 200)}${opts.replyPreview.length > 200 ? "…" : ""}</p>` : ""}
</div>
<p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Replied at: ${opts.repliedAt}</p>`;

  const html = buildEmailHtml({
    title: `New reply on request: ${opts.requestTitle}`,
    bodyHtml,
    ctaLabel: "View Request",
    ctaUrl,
    footerNote: `You are receiving this because a ${roleLabel.toLowerCase()} replied to a request in your ClockField account.`,
  });

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: `New reply on request: ${opts.requestTitle}`,
    text: textBody,
    html,
  });
}

export async function sendTrialAccountEmail(opts: {
  to: string;
  firstName: string;
  companyName: string;
  trialEndDate: string;
  setupUrl: string;
  appUrl: string;
}) {
  const { client, domain } = getClient();
  const from = process.env.MAIL_FROM || "Clockfield <noreply@clockfield.ca>";
  const trialEnd = new Date(opts.trialEndDate).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const textBody = `Hi ${opts.firstName},

Your ClockField trial account for ${opts.companyName} is ready.

Set up your password and log in using the link below:
${opts.setupUrl}

Your trial runs until ${trialEnd}. After that, you'll need to choose a plan to continue using ClockField — your data will always be kept safe.

If you have any questions, reply to this email or contact our support team.

– The ClockField Team`;

  const bodyHtml = `
<p style="margin:0 0 14px;color:#374151;">Hi <strong>${opts.firstName}</strong>,</p>
<p style="margin:0 0 14px;color:#374151;">Your ClockField trial account for <strong>${opts.companyName}</strong> has been created and is ready to use.</p>
<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:16px 20px;margin:0 0 20px;">
  <p style="margin:0 0 6px;font-size:12px;color:#0369a1;font-weight:600;text-transform:uppercase;">Trial Details</p>
  <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Company:</strong> ${opts.companyName}</p>
  <p style="margin:0;font-size:14px;color:#374151;"><strong>Trial ends:</strong> ${trialEnd}</p>
</div>
<p style="margin:0 0 14px;color:#6b7280;font-size:14px;">After your trial ends, you'll need to choose a plan to continue — all your data will be kept safe.</p>`;

  const html = buildEmailHtml({
    title: `Your ClockField trial account is ready`,
    bodyHtml,
    ctaLabel: "Set Up Your Password",
    ctaUrl: opts.setupUrl,
    footerNote: `You received this because a ClockField trial account was created for ${opts.companyName}.`,
  });

  await client.messages.create(domain, {
    from,
    to: [opts.to],
    subject: `Your ClockField trial account is ready — ${opts.companyName}`,
    text: textBody,
    html,
  });
}
