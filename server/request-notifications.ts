import { storage } from "./storage";
import { sendWebsiteRequestEmail } from "./mail";
import { hasAccess } from "../shared/people";

type RequestNotice = {
  companyId: string; requestId: string; source: "submission" | "booking";
  formName: string; clientName: string; serviceType: string; submittedAt: string;
};

// Only notify active staff who can view this company's forms. Each recipient
// gets a separate message so other admins' addresses are not disclosed.
export async function notifyWebsiteRequest(notice: RequestNotice, deps = { storage, send: sendWebsiteRequestEmail }) {
  try {
    const [company, admins] = await Promise.all([
      deps.storage.getCompany(notice.companyId), deps.storage.getAdminsByCompany(notice.companyId),
    ]);
    const recipients = [...new Set(admins.filter(admin => admin.companyId === notice.companyId && admin.isActive &&
      !["pending_activation", "profile_only", "disabled"].includes(admin.accountStatus || "") && hasAccess(admin, "forms"))
      .map(admin => admin.email?.trim().toLowerCase()).filter((email): email is string => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
    const url = new URL("/admin/quote-forms", process.env.APP_URL || "https://clockfield.com");
    url.searchParams.set("tab", "submissions");
    url.searchParams.set(notice.source === "booking" ? "booking" : "submission", notice.requestId);
    const results = await Promise.allSettled(recipients.map(to => deps.send({
      to, companyName: company?.name || "Your company", formName: notice.formName,
      clientName: notice.clientName || "Website visitor", serviceType: notice.serviceType || "Not specified",
      submittedAt: notice.submittedAt, requestUrl: url.href,
    })));
    if (!recipients.length || results.some(result => result.status === "rejected")) {
      console.error(`[website-request] Admin notification incomplete for ${notice.source} ${notice.requestId}: ${results.filter(result => result.status === "fulfilled").length}/${recipients.length} delivered`);
    }
  } catch (error) {
    // A mail outage must never discard a successfully saved customer request.
    console.error(`[website-request] Admin notification failed for ${notice.source} ${notice.requestId}:`, error);
  }
}
