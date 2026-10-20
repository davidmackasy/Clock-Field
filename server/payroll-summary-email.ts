import { createTimesheetWorkbook } from "./timesheet-workbook";

export type PayrollHoursEmail = {
  subject: string;
  text: string;
  attachment: { filename: string; data: Buffer }[];
};

const filenamePart = (value: string) => String(value).normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 70) || "employee";

/** The body and attachments must describe exactly the same employees and snapshot. */
export async function buildPayrollHoursEmail(snapshot: any): Promise<PayrollHoursEmail> {
  const employees = snapshot.employees.filter((employee: any) =>
    employee.rawMinutes || employee.payableMinutes || employee.pendingEntries);
  const attachment: PayrollHoursEmail["attachment"] = [];
  const filenames = new Set<string>();
  for (const [index, employee] of employees.entries()) {
    const base = `timesheet-${filenamePart(employee.employeeNumber || employee.id || String(index + 1))}-${filenamePart(employee.name)}-${snapshot.period.start}-${snapshot.period.end}`;
    let filename = `${base}.xlsx`;
    if (filenames.has(filename)) filename = `${base}-${index + 1}.xlsx`;
    filenames.add(filename);
    attachment.push({ filename, data: await createTimesheetWorkbook({ ...snapshot, employees: [employee] }) });
  }
  const hours = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  const details = employees.map((employee: any) =>
    `${employee.name} (${employee.employeeNumber}): ${hours(employee.payableMinutes)} payable; ${hours(employee.rawMinutes)} recorded${employee.hourlyRate == null ? "; pay rate not set" : `; current hourly rate ${employee.hourlyRate}; estimated gross ${employee.estimatedGross.toFixed(2)}`}${employee.pendingEntries ? `; ${employee.pendingEntries} unfinished shift(s) need review` : ""}`
  ).join("\n");
  return {
    subject: `Payroll hours: ${snapshot.period.start}–${snapshot.period.end} | payday ${snapshot.period.payday}`,
    text: `${snapshot.company.name}\nPeriod: ${snapshot.period.start} through ${snapshot.period.end}\nPayday: ${snapshot.period.payday}\nTimezone: ${snapshot.company.timezone}\n\n${details || "No completed attendance records in this period."}\n\n${attachment.length ? "Attached: one timesheet per employee listed above, with recorded dates, times, locations and payable hours.\n\n" : ""}These are hours for payroll review, including saved adjustments. This summary does not mark wages as paid.\n\nOpen timesheets: ${process.env.APP_URL || "https://clockfield.com"}/admin/attendance/timesheets?start=${snapshot.period.start}`,
    attachment,
  };
}
