import { storage } from "./storage";

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function buildReportMetaTags(token: string, baseUrl: string): Promise<string | null> {
  try {
    let sub = await storage.getWorkSubmissionByToken(token);
    if (!sub) sub = await storage.getWorkSubmissionByShortCode(token);
    if (!sub || !sub.publicShareEnabled) return null;

    const company = await storage.getCompany(sub.companyId);
    const employee = sub.employeeId ? await storage.getUser(sub.employeeId) : null;
    const companyName = company?.name || "ClockField";
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : "Staff";

    const locationPart = sub.locationName ? ` for ${sub.locationName}` : "";
    const datePart = sub.workDate
      ? new Date(sub.workDate + "T12:00:00").toLocaleDateString("en-CA", {
          month: "long", day: "numeric", year: "numeric",
        })
      : "";

    const ogTitle = `Cleaning Service Report | ${companyName}`;
    const ogDesc = `Prepared by ${employeeName}${locationPart}${datePart ? " on " + datePart : ""}. View before and after photos and service details.`;

    // Use the short URL if available, otherwise long token URL
    const reportShortCode = sub.reportShortCode;
    const pageUrl = reportShortCode
      ? `${baseUrl}/r/${reportShortCode}`
      : `${baseUrl}/public/work-report/${sub.publicShareToken}`;

    // Find the first after photo (fallback to first photo of any type)
    let ogImageUrl: string | null = null;
    const items = await storage.getWorkSubmissionItems(sub.id);
    outer: for (const item of items) {
      const photos = await storage.getWorkSubmissionPhotosByItem(item.id);
      for (const photo of photos) {
        if (photo.photoType === "after") {
          ogImageUrl = `${baseUrl}/api/public/work-report/${token}/photos/${photo.id}`;
          break outer;
        }
      }
    }
    // Fallback: first photo of any type
    if (!ogImageUrl) {
      outer2: for (const item of items) {
        const photos = await storage.getWorkSubmissionPhotosByItem(item.id);
        if (photos.length > 0) {
          ogImageUrl = `${baseUrl}/api/public/work-report/${token}/photos/${photos[0].id}`;
          break outer2;
        }
      }
    }

    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="ClockField.com" />`,
      `<meta property="og:url" content="${escHtml(pageUrl)}" />`,
      `<meta property="og:title" content="${escHtml(ogTitle)}" />`,
      `<meta property="og:description" content="${escHtml(ogDesc)}" />`,
      `<meta name="description" content="${escHtml(ogDesc)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:site" content="@ClockField" />`,
      `<meta name="twitter:title" content="${escHtml(ogTitle)}" />`,
      `<meta name="twitter:description" content="${escHtml(ogDesc)}" />`,
      `<title>${escHtml(ogTitle)} | ClockField.com</title>`,
    ];

    if (ogImageUrl) {
      tags.splice(5, 0,
        `<meta property="og:image" content="${escHtml(ogImageUrl)}" />`,
        `<meta property="og:image:type" content="image/jpeg" />`,
        `<meta name="twitter:image" content="${escHtml(ogImageUrl)}" />`,
      );
    }

    return tags.join("\n    ");
  } catch {
    return null;
  }
}

export function extractReportToken(url: string): string | null {
  const longMatch = url.match(/^\/public\/work-report\/([^/?#]+)/);
  if (longMatch) return longMatch[1];
  const shortMatch = url.match(/^\/r\/([^/?#]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}
