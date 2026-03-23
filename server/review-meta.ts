import { storage } from "./storage";

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function buildReviewMetaTags(token: string, baseUrl: string): Promise<string | null> {
  try {
    const review = await storage.getWorkSubmissionReviewByShareToken(token);
    if (!review) return null;

    const sub = await storage.getWorkSubmission(review.submissionId);
    const company = await storage.getCompany(review.companyId);

    const companyName = company?.name || "ClockField";
    const stars = review.rating
      ? "\u2605".repeat(review.rating) + "\u2606".repeat(5 - review.rating)
      : "";
    const truncReview =
      review.reviewText.length > 160
        ? review.reviewText.slice(0, 157) + "..."
        : review.reviewText;
    const reviewerAttr = review.companyName
      ? `${review.clientName} from ${review.companyName}`
      : review.clientName;

    const ogTitle = `${reviewerAttr} reviewed ${companyName}`;
    const ogDesc = `${stars ? stars + " " : ""}"${truncReview}" \u00B7 Verified by ClockField.com`;
    const pageUrl = `${baseUrl}/public/reviews/${token}`;
    const ogImageUrl = `${baseUrl}/api/public/review/${token}/og-image.png`;

    return [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="ClockField.com" />`,
      `<meta property="og:url" content="${escHtml(pageUrl)}" />`,
      `<meta property="og:title" content="${escHtml(ogTitle)}" />`,
      `<meta property="og:description" content="${escHtml(ogDesc)}" />`,
      `<meta property="og:image" content="${escHtml(ogImageUrl)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:type" content="image/png" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:site" content="@ClockField" />`,
      `<meta name="twitter:title" content="${escHtml(ogTitle)}" />`,
      `<meta name="twitter:description" content="${escHtml(ogDesc)}" />`,
      `<meta name="twitter:image" content="${escHtml(ogImageUrl)}" />`,
      `<title>${escHtml(ogTitle)} | ClockField.com</title>`,
    ].join("\n    ");
  } catch {
    return null;
  }
}

export function extractReviewToken(url: string): string | null {
  const match = url.match(/^\/public\/reviews\/([^/?#]+)/);
  return match ? match[1] : null;
}
