import { sendClockOutEmail } from "./mail";
import { dateInZone } from "../shared/time-report";

export async function notifyAdminsOfClockOut(storage: any, cleaner: any, entry: any, send = sendClockOutEmail) {
  const [company, admins] = await Promise.all([storage.getCompany(cleaner.companyId), storage.getAdminsByCompany(cleaner.companyId)]);
  if (!company?.alertEmployeeClockedOut) return;
  const timezone = company?.timezone || "UTC";
  const format = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
  const recipients = Array.from(new Set<string>(admins.filter((a: any) => a.isActive && a.companyId === cleaner.companyId && a.email?.trim()).map((a: any) => a.email.trim().toLowerCase())));
  const url = new URL("/admin/attendance", process.env.APP_URL || "https://clockfield.com");
  url.searchParams.set("employeeId", cleaner.id); url.searchParams.set("date", dateInZone(entry.clockInAt, timezone));
  const results = await Promise.allSettled(recipients.map(to => send({ to, cleanerName: `${cleaner.firstName} ${cleaner.lastName}`, companyName: company?.name || "your company", clockIn: format(entry.clockInAt), clockOut: format(entry.clockOutAt), workedMinutes: entry.workedMinutes || 0, timezone, attendanceUrl: url.toString() })));
  for (const result of results) if (result.status === "rejected") console.error("[clock-out-email] Delivery failed", result.reason?.message || "Unknown mail error");
}
