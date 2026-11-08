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
  for(const employee of employees) {
    const rows=employee.rows.filter((row:any)=>row.id&&row.date>=snapshot.period.start&&row.date<=snapshot.period.end);
    if(rows.reduce((sum:number,row:any)=>sum+row.rawMinutes,0)!==employee.rawMinutes || rows.reduce((sum:number,row:any)=>sum+row.payableMinutes,0)!==employee.payableMinutes)
      throw new Error('Timesheet rows do not match the payroll summary totals');
  }
  const attachment: PayrollHoursEmail["attachment"] = [];
  const filenames = new Set<string>();
  for (const [index, employee] of employees.entries()) {
    const base = `timesheet-${filenamePart(employee.employeeNumber || employee.id || String(index + 1))}-${filenamePart(employee.name)}-${snapshot.period.start}-${snapshot.period.end}`;
    let filename = `${base}.xlsx`;
    if (filenames.has(filename)) filename = `${base}-${index + 1}.xlsx`;
    filenames.add(filename);
    attachment.push({ filename, data: await createTimesheetWorkbook({ ...snapshot, employees: [employee] }) });
  }
  const rawTotal=employees.reduce((sum:number,employee:any)=>sum+employee.rawMinutes,0);
  const payableTotal=employees.reduce((sum:number,employee:any)=>sum+employee.payableMinutes,0);
  const hours = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  const details = employees.map((employee: any) =>
    `${employee.name} (${employee.employeeNumber}): ${hours(employee.payableMinutes)} payable; ${hours(employee.rawMinutes)} recorded${employee.hourlyRate == null ? "; pay rate not set" : `; current hourly rate ${employee.hourlyRate}; estimated gross ${employee.estimatedGross.toFixed(2)}`}${employee.pendingEntries ? `; ${employee.pendingEntries} unfinished shift(s) need review` : ""}${employee.rows.some((row:any)=>row.id&&row.locationNeedsReview)?"; work-site conflicts need review (see attached timesheet)":""}`
  ).join("\n");
  return {
    subject: `Payroll hours: ${snapshot.period.start}–${snapshot.period.end} | payday ${snapshot.period.payday}`,
    text: `${snapshot.company.name}\nPeriod: ${snapshot.period.start} through ${snapshot.period.end}\nPayday: ${snapshot.period.payday}\nTimezone: ${snapshot.company.timezone}\n\n${details || "No completed attendance records in this period."}\n\nAll cleaners: ${hours(rawTotal)} recorded; ${hours(payableTotal)} payable.\n\n${attachment.length ? "Attached: one timesheet per employee listed above, with recorded dates, times, locations and payable hours.\n\n" : ""}These are hours for payroll review, including saved adjustments. This summary does not mark wages as paid.\n\nOpen timesheets: ${process.env.APP_URL || "https://clockfield.com"}/admin/attendance/timesheets?start=${snapshot.period.start}`,
    attachment,
  };
}
