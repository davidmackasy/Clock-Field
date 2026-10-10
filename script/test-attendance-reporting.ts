import assert from "node:assert/strict";
import { timesheetRows, entryMinutes, timesheetCsv } from "../shared/time-report";
import { companyWallTimeToIso, formatCompanyTime } from "../client/src/lib/timezone";
import { notifyAdminsOfClockOut } from "../server/clock-out-notification";

const timezone = "America/Winnipeg";
const employee = { id: "cleaner-1", companyId: "company-1", employeeId: "EMP-1", firstName: "=Cleaner", lastName: 'Test,"Name' };
const entries = [
  { id: "overnight", employeeId: employee.id, clockInAt: "2026-10-10T04:00:00Z", clockOutAt: "2026-10-10T07:00:00Z", workedMinutes: 180, totalAdjustmentMinutes: -30, status: "completed" },
  { id: "end", employeeId: employee.id, clockInAt: "2026-10-23T20:00:00Z", clockOutAt: "2026-10-23T22:00:00Z", workedMinutes: 120, status: "completed" },
  { id: "after", employeeId: employee.id, clockInAt: "2026-10-24T05:00:00Z", clockOutAt: "2026-10-24T06:00:00Z", status: "completed" },
  { id: "open", employeeId: employee.id, clockInAt: "2026-10-10T15:00:00Z", status: "active" },
  { id: "foreign", employeeId: "other-cleaner", clockInAt: "2026-10-10T15:00:00Z", clockOutAt: "2026-10-10T17:00:00Z", status: "completed" },
];
assert.deepEqual(timesheetRows(entries, employee.id, "2026-10-09", "2026-10-22", timezone).map(e => e.id), ["overnight"]);
assert.deepEqual(timesheetRows(entries, employee.id, "2026-10-10", "2026-10-23", timezone).map(e => e.id), ["end"]);
assert.equal(entryMinutes(entries[0]).payable, 150);
const csv = timesheetCsv(entries, employee, "2026-10-09", "2026-10-23", timezone);
assert.ok(csv.includes("America/Winnipeg"));
assert.ok(csv.includes('"5.00","-0.50","4.50"'));
assert.ok(csv.includes('"\'=Cleaner Test,""Name"'));
assert.ok(!csv.includes('"foreign"') && !csv.includes('"open"') && !csv.includes('"after"'));
assert.equal(companyWallTimeToIso("2026-07-01T17:00", timezone), "2026-07-01T22:00:00.000Z");
assert.equal(companyWallTimeToIso("2026-12-01T17:00", timezone), "2026-12-01T23:00:00.000Z");
assert.throws(() => companyWallTimeToIso("2026-03-08T02:30", timezone), /daylight saving/);
assert.equal(companyWallTimeToIso("2026-11-01T01:30", timezone), "2026-11-01T06:30:00.000Z");
assert.equal(formatCompanyTime("2026-07-01T22:00:00Z", timezone), "5:00 PM");
const emails: any[] = [];
await notifyAdminsOfClockOut({
  getCompany: async () => ({ name: "Test Company", timezone, alertEmployeeClockedOut: true }),
  getAdminsByCompany: async () => [
    { companyId: employee.companyId, email: "ADMIN@example.invalid", isActive: true },
    { companyId: employee.companyId, email: "admin@example.invalid", isActive: true },
    { companyId: employee.companyId, email: "disabled@example.invalid", isActive: false },
    { companyId: "other-company", email: "foreign@example.invalid", isActive: true },
  ],
}, employee, entries[0], async options => { emails.push(options); });
assert.equal(emails.length, 1);
assert.equal(emails[0].to, "admin@example.invalid");
assert.equal(emails[0].timezone, timezone);
assert.ok(emails[0].clockOut.includes("CDT"));
assert.equal(new URL(emails[0].attendanceUrl).searchParams.get("date"), "2026-10-09");
assert.equal(emails[0].workedMinutes, 180);
console.log("PASS: cleaner/date boundaries, overnight shifts, adjustments, CSV escaping, browser-independent timezone/DST conversion, and company-scoped clock-out emails.");
