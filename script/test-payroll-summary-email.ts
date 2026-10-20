import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { transform } from "esbuild";
import { buildPayrollHoursEmail } from "../server/payroll-summary-email";
import { dateShift } from "../shared/payroll-cycle";

// All data and delivery claims below are fixtures; never connect or send real email.
process.env.DATABASE_URL = "postgres://fixture:fixture@127.0.0.1:1/unused";
delete process.env.DATABASE_SSL_CA_PATH;
delete process.env.MAILGUN_API_KEY;
const { storage } = await import("../server/storage");
const { pool } = await import("../server/db");
const { payrollSnapshot, sendDuePayrollSummaries } = await import("../server/payroll-timesheets");

function unzip(buffer: Buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "Valid XLSX ZIP archive");
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let index = 0; index < buffer.readUInt16LE(end + 10); index++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const method = buffer.readUInt16LE(offset + 10), size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString();
    const local = buffer.readUInt32LE(offset + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + size);
    files.set(name, (method === 8 ? inflateRawSync(data) : data).toString());
    offset += 46 + nameLength + extra + comment;
  }
  return files;
}
function value(xml: string, address: string) {
  const cell = xml.match(new RegExp(`<x:c\\b(?=[^>]*r="${address}")[^>]*>[\\s\\S]*?</x:c>`))?.[0];
  assert.ok(cell, `Cell ${address} exists`);
  return cell.match(/<x:v>([\s\S]*?)<\/x:v>/)?.[1] || "";
}
const company = { id: "company", name: "Example Cleaning", timezone: "America/Winnipeg", payrollCycleStartDate: "2026-10-05", payrollPaydayDelayDays: 5, payrollSummaryDays: [2, 4], payrollSummaryHour: 8, payrollSummaryEnabled: true };
const empty = { id: "empty", firstName: "No", lastName: "Attendance", employeeId: "EMP-EMPTY" };
const first = { id: "first", firstName: "Example", lastName: "Cleaner", employeeId: "EMP-1", hourlyRate: "19" };
const second = { id: "second", firstName: "Second", lastName: "Cleaner", employeeId: "EMP-2", hourlyRate: "15" };
const third = { id: "third", firstName: "Third", lastName: "Cleaner", employeeId: "EMP-3", hourlyRate: "17" };
let employees = [empty, first, second];
const entry = (id: string, employeeId: string, day: number, hour: number, minute: number, duration: number, locationId = "site-a") => {
  const clockIn = Date.parse(dateShift("2026-10-05", day) + "T00:00:00Z") + ((hour + 5) * 60 + minute) * 60000;
  return { id, companyId: company.id, employeeId, locationId, status: "completed", clockInAt: new Date(clockIn).toISOString(), clockOutAt: new Date(clockIn + duration * 60000).toISOString() };
};
let entries = [entry("split-a", first.id, 0, 9, 0, 180), entry("split-b", first.id, 0, 13, 0, 120, "site-b"), entry("overnight", first.id, 1, 23, 30, 300), ...Array.from({ length: 7 }, (_, i) => entry(`day-${i}`, first.id, i + 2, 9, 0, 300)), entry("short", first.id, 9, 9, 0, 51), entry("twelve", second.id, 0, 0, 1, 12)];
const admins = [{ id: "admin", email: "owner@example.test", isActive: true }, { id: "duplicate", email: "OWNER@example.test", isActive: true }, { id: "second-admin", email: "second@example.test", isActive: true }, { id: "disabled", email: "disabled@example.test", isActive: false }];
Object.assign(storage, {
  getCompany: async () => company,
  getEmployeesByCompany: async () => employees,
  getTimeEntriesByCompany: async () => entries,
  getAttendanceAdjustmentsByCompany: async () => [{ timeEntryId: "day-0", adjustmentMinutes: 15, createdAt: "2026-10-10" }, { timeEntryId: "day-1", adjustmentMinutes: -15, createdAt: "2026-10-11" }],
  getLocationsByCompany: async () => [{ id: "site-a", name: "Example Building" }, { id: "site-b", name: "Example Office" }],
  getShiftsByCompany: async () => [], getRecurringSchedulesByCompany: async () => [], getClientsByCompany: async () => [],
  getAdminsByCompany: async () => admins,
});
const snapshot = await payrollSnapshot(company.id, "2026-10-05");
assert.equal(snapshot.employees[0].payableMinutes, 0, "Reproduce empty first employee in the old combined workbook");
assert.equal(snapshot.employees[1].payableMinutes, 2751);
assert.equal(snapshot.employees[2].payableMinutes, 12);
const before = JSON.stringify(snapshot);
const message = await buildPayrollHoursEmail(snapshot);
assert.equal(message.attachment.length, 2);
assert.ok(message.text.includes("45h 51m payable; 45h 51m recorded"));
assert.ok(message.text.includes("0h 12m payable; 0h 12m recorded"));
assert.ok(!message.text.includes("No Attendance"));
assert.equal(JSON.stringify(snapshot), before, "Rendering must not mutate attendance or its snapshot");
await fs.mkdir("/private/tmp/clockfield-payroll-email-review", { recursive: true });
for (const [index, attachment] of message.attachment.entries()) {
  const employee = snapshot.employees[index + 1];
  const files = unzip(attachment.data), xml = files.get("xl/worksheets/sheet1.xml")!;
  assert.equal(value(xml, "C3"), employee.name);
  assert.equal(value(xml, "C4"), employee.employeeNumber);
  assert.equal(Number(value(xml, "E22")), employee.payableMinutes / 60);
  assert.ok(!files.get("xl/workbook.xml")!.includes("EMP-EMPTY"));
  const dailyTotal = Array.from({ length: 14 }, (_, day) => Number(value(xml, `E${7 + day}`)) || 0).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(dailyTotal * 60 - employee.payableMinutes) < 0.000001);
  for (let day = 0; day < 14; day++) assert.equal(Number(value(xml, `A${7 + day}`)), (Date.parse(dateShift(snapshot.period.start, day)) - Date.UTC(1899, 11, 30)) / 86400000);
  assert.ok(value(xml, "F7").includes("Example Building"));
  if (index === 0) {
    assert.equal(Number(value(xml, "C7")), 9 / 24);
    assert.equal(Number(value(xml, "D7")), 15 / 24);
    assert.equal(Number(value(xml, "E7")), 5, "Split shift break must not become paid hours");
    assert.equal(value(xml, "F7"), "Example Building; Example Office");
    assert.equal(Number(value(xml, "C8")), 23.5 / 24);
    assert.equal(Number(value(xml, "D8")), 4.5 / 24);
    assert.equal(Number(value(xml, "E8")), 5, "Overnight shift stays on its local clock-in day");
    assert.equal(Number(value(xml, "E9")), 5.25, "Positive saved adjustment included");
    assert.equal(Number(value(xml, "E10")), 4.75, "Negative saved adjustment included");
    assert.equal(Number(value(files.get("xl/worksheets/sheet2.xml")!, "H3")), 1 + 4.5 / 24, "Overnight end date retained for Excel recalculation");
  } else {
    assert.equal(Number(value(xml, "E7")), 0.2);
    assert.equal(Number(value(xml, "C7")), 1 / 1440, "Local midnight date/time preserved");
  }
  await fs.writeFile(`/private/tmp/clockfield-payroll-email-review/${attachment.filename}`, attachment.data);
}
for (const count of [1, 2, 3]) {
  const active = [...snapshot.employees.slice(1), { ...snapshot.employees[2], id: third.id, employeeNumber: third.employeeId, name: "Third Cleaner" }].slice(0, count);
  const result = await buildPayrollHoursEmail({ ...snapshot, employees: [snapshot.employees[0], ...active] });
  assert.equal(result.attachment.length, count);
  assert.equal(new Set(result.attachment.map(file => file.filename)).size, count);
}
assert.equal((await buildPayrollHoursEmail({ ...snapshot, employees: [snapshot.employees[0]] })).attachment.length, 0);
const pending = await buildPayrollHoursEmail({ ...snapshot, employees: [{ ...snapshot.employees[0], pendingEntries: 1 }] });
assert.equal(pending.attachment.length, 1);
assert.ok(pending.text.includes("unfinished shift(s) need review"));
assert.equal(Number(value(unzip(pending.attachment[0].data).get("xl/worksheets/sheet1.xml")!, "E22")), 0, "Unfinished work is never invented or paid");

// Exercise the actual reminder scheduler, including retries and recipient deduplication.
const claims = new Map<string, string>();
(pool as any).query = async (sql: string, args: any[] = []) => {
  if (sql.startsWith("SELECT * FROM companies")) return { rows: [{ id: company.id, timezone: company.timezone, payroll_cycle_start_date: company.payrollCycleStartDate, payroll_summary_days: company.payrollSummaryDays, payroll_summary_hour: 8 }] };
  const key = args.join("|");
  if (sql.startsWith("INSERT INTO payroll_summary_deliveries")) {
    if (claims.has(key) && claims.get(key) !== "failed") return { rows: [], rowCount: 0 };
    claims.set(key, "sending"); return { rows: [{ recipient_id: args[3] }], rowCount: 1 };
  }
  if (sql.startsWith("UPDATE payroll_summary_deliveries")) {
    claims.set(key, sql.includes("status='sent'") ? "sent" : "failed"); return { rows: [] };
  }
  throw Error(`Unexpected database call: ${sql}`);
};
const sent: any[] = [];
const send = async (to: string, payload: any) => { sent.push({ to, payload }); };
const now = new Date("2026-10-20T14:00:00Z");
assert.equal((await sendDuePayrollSummaries(now, send)).sent, 2);
assert.equal(sent.length, 2);
assert.ok(sent.every(mail => mail.payload.attachment.length === 2));
assert.equal(sent[0].payload, sent[1].payload, "All recipients receive one consistent snapshot");
assert.equal((await sendDuePayrollSummaries(now, send)).sent, 0);
const retryDate = new Date("2026-10-22T14:00:00Z");
assert.equal((await sendDuePayrollSummaries(retryDate, async (to, payload) => { if (to === admins[0].email) throw Error("simulated provider failure"); await send(to, payload); })).sent, 1);
assert.equal((await sendDuePayrollSummaries(retryDate, send)).sent, 1);
assert.equal((await sendDuePayrollSummaries(retryDate, send)).sent, 0);
assert.ok([...claims.values()].every(state => state === "sent"));
// Verify the final provider handoff receives all the files, without calling Mailgun.
const mailSource = await fs.readFile("server/mail.ts", "utf8");
const mailStart = mailSource.indexOf("export async function sendPayrollHoursEmail(");
const mailEnd = mailSource.indexOf("\nexport async function sendClockOutEmail", mailStart);
const mailFunction = (await transform(mailSource.slice(mailStart, mailEnd).replace("export ", ""), { loader: "ts" })).code;
let handedOff: any;
const mailAdapter = new Function("getClient", `${mailFunction}; return sendPayrollHoursEmail;`)(() => ({ domain: "example.test", client: { messages: { create: async (_domain: string, data: any) => { handedOff = data; } } } }));
await mailAdapter("owner@example.test", message);
assert.deepEqual(handedOff.to, ["owner@example.test"]);
assert.equal(handedOff.attachment, message.attachment);
assert.equal(handedOff.attachment.length, 2);
assert.equal(handedOff.text, message.text);
console.log("PASS: empty first employee regression; 1/2/3 separate attachments; exact email/worksheet totals; daily dates, local times and locations; split/overnight shifts; saved adjustments; pending-only and empty periods; no snapshot mutation; real scheduler recipient deduplication and failed-send retries. No live emails or attendance writes.");
