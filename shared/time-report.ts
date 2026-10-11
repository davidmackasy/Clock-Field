export function dateInZone(value: string | Date, timezone: string) {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));
  return ["year","month","day"].map(type=>parts.find(part=>part.type===type)!.value).join("-");
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text) && !/^-\d+(\.\d+)?$/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function timesheetRows(entries: any[], employeeId: string, start: string, end: string, timezone: string) {
  return entries.filter(entry => entry.employeeId === employeeId && entry.clockOutAt && entry.status === "completed" &&
    dateInZone(entry.clockInAt, timezone) >= start && dateInZone(entry.clockInAt, timezone) <= end)
    .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
}

export function entryMinutes(entry: any) {
  const elapsed = (Date.parse(entry.clockOutAt) - Date.parse(entry.clockInAt)) / 60000;
  const raw = Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : (entry.workedMinutes ?? 0);
  return { raw, adjustment: entry.totalAdjustmentMinutes || 0, payable: Math.max(0, raw + (entry.totalAdjustmentMinutes || 0)) };
}

export function timesheetCsv(entries: any[], employee: any, start: string, end: string, timezone: string) {
  const rows = timesheetRows(entries, employee.id, start, end, timezone);
  const instant = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
  const name = `${employee.firstName} ${employee.lastName}`;
  const output: unknown[][] = [
    ["Cleaner", "Employee ID", "Period start", "Period end", "Timezone", "Work date", "Clock in", "Clock out", "Worked hours", "Adjustment hours", "Payable hours", "Entry ID"],
  ];
  let raw = 0, adjustment = 0, payable = 0;
  for (const entry of rows) {
    const minutes = entryMinutes(entry); raw += minutes.raw; adjustment += minutes.adjustment; payable += minutes.payable;
    output.push([name, employee.employeeId || employee.id, start, end, timezone, dateInZone(entry.clockInAt, timezone), instant(entry.clockInAt), instant(entry.clockOutAt), (minutes.raw / 60).toFixed(2), (minutes.adjustment / 60).toFixed(2), (minutes.payable / 60).toFixed(2), entry.id]);
  }
  output.push(["TOTAL", employee.employeeId || employee.id, start, end, timezone, "", "", "", (raw / 60).toFixed(2), (adjustment / 60).toFixed(2), (payable / 60).toFixed(2), ""]);
  return "\uFEFF" + output.map(row => row.map(csvCell).join(",")).join("\r\n");
}
