import type { Express } from "express";
import { storage } from "./storage";
import { pool } from "./db";
import { requireRole } from "./auth";
import { dateInZone, entryMinutes, timesheetRows } from "../shared/time-report";
import { dateShift, payrollPeriod, validDate } from "../shared/payroll-cycle";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendPayrollHoursEmail } from "./mail";
import { createTimesheetWorkbook } from "./timesheet-workbook";

export async function payrollSnapshot(companyId: string, start: string, employeeId = "all", end?: string) {
  const [company, employees, allEntries, adjustments, locations, shifts] = await Promise.all([
    storage.getCompany(companyId), storage.getEmployeesByCompany(companyId), storage.getTimeEntriesByCompany(companyId),
    storage.getAttendanceAdjustmentsByCompany(companyId), storage.getLocationsByCompany(companyId), storage.getShiftsByCompany(companyId),
  ]);
  if (!company) throw new Error("Company not found");
  const payroll = payrollPeriod(company.payrollCycleStartDate || start, start, company.payrollPaydayDelayDays, company.payrollSummaryDays);
  const period = {...payroll, start, end: end || dateShift(start,13), payday: start === payroll.start && (end || dateShift(start,13)) === payroll.end ? payroll.payday : null};
  const dayCount=Math.round((Date.parse(period.end)-Date.parse(start))/86400000)+1;
  if(dayCount<1||dayCount>366)throw new Error("Invalid date range");
  const shiftLocations=new Map(shifts.map(shift=>[shift.id,shift.locationId]));
  const locationNames = new Map(locations.map(location => [location.id, location.name]));
  const totals = new Map<string, number>();
  for (const adjustment of adjustments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    totals.set(adjustment.timeEntryId, (totals.get(adjustment.timeEntryId) || 0) + adjustment.adjustmentMinutes);
  }
  const enriched = allEntries.map(entry => ({ ...entry, totalAdjustmentMinutes: totals.get(entry.id) || 0 }));
  const time = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: company.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
  const selected = employees.filter(employee => employeeId === "all" || employee.id === employeeId);
  if (employeeId !== "all" && !selected.length) throw new Error("Cleaner not found");
  return {
    company: { id: company.id, name: company.name, timezone: company.timezone, companyLogoUrl: company.companyLogoUrl, payrollCycleStartDate: company.payrollCycleStartDate, payrollPaydayDelayDays: company.payrollPaydayDelayDays, payrollSummaryDays: company.payrollSummaryDays, payrollSummaryHour: company.payrollSummaryHour, payrollSummaryEnabled: company.payrollSummaryEnabled },
    period,
    employees: selected.map(employee => {
      const entries = timesheetRows(enriched, employee.id, period.start, period.end, company.timezone);
      const rows = [];
      for (let day = 0; day < dayCount; day++) {
        const date = dateShift(start, day);
        const daily = entries.filter(entry => dateInZone(entry.clockInAt, company.timezone) === date);
        const dayName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(date + "T12:00:00Z"));
        if (!daily.length) rows.push({ date, day: dayName, id: null, startTime: "", endTime: "", rawMinutes: 0, payableMinutes: 0, location: "" });
        for (const entry of daily) {
          const minutes = entryMinutes(entry);
          rows.push({ date, day: dayName, id: entry.id, clockInAt: entry.clockInAt, clockOutAt: entry.clockOutAt, endDate: dateInZone(entry.clockOutAt!,company.timezone), startTime: time(entry.clockInAt), endTime: time(entry.clockOutAt!), actualStartTime: time(entry.clockInAt), actualEndTime: time(entry.clockOutAt!), rawMinutes: minutes.raw, payableMinutes: minutes.payable, location: locationNames.get(entry.locationId || shiftLocations.get(entry.shiftId!) || "") || "Not recorded", adjustmentMinutes: minutes.adjustment });
        }
      }
      const pendingEntries=enriched.filter(entry=>entry.employeeId===employee.id && !entry.clockOutAt && dateInZone(entry.clockInAt,company.timezone)>=period.start && dateInZone(entry.clockInAt,company.timezone)<=period.end).length;
      return { id: employee.id, name: `${employee.firstName} ${employee.lastName}`, employeeNumber: employee.employeeId || "", hourlyRate: employee.hourlyRate, estimatedGross: employee.hourlyRate == null ? null : Math.round(entries.reduce((sum,entry)=>sum+entryMinutes(entry).payable,0)/60*Number(employee.hourlyRate)*100)/100, rows, pendingEntries, rawMinutes: entries.reduce((sum, entry) => sum + entryMinutes(entry).raw, 0), payableMinutes: entries.reduce((sum, entry) => sum + entryMinutes(entry).payable, 0) };
    }),
  };
}

export function registerPayrollTimesheetRoutes(app: Express) {
  app.get("/api/admin/attendance/payroll-timesheet", requireRole("admin"), async (req, res) => {
    try {
      if (!validDate(req.query.start)) return res.status(400).json({ message: "Select a valid period start" });
      res.json(await payrollSnapshot((req.user as any).companyId, req.query.start, typeof req.query.employeeId === "string" ? req.query.employeeId : "all", validDate(req.query.end) ? req.query.end : undefined));
    } catch { res.status(404).json({ message: "Timesheet not found" }); }
  });
  app.get("/api/admin/attendance/payroll-timesheet.xlsx", requireRole("admin"), async (req, res) => {
    try {
      if (!validDate(req.query.start)) return res.status(400).json({ message: "Select a valid period start" });
      const snapshot = await payrollSnapshot((req.user as any).companyId, req.query.start, typeof req.query.employeeId === "string" ? req.query.employeeId : "all", validDate(req.query.end) ? req.query.end : undefined);
      const file = await createTimesheetWorkbook(snapshot);
      const label=req.query.employeeId && req.query.employeeId!=="all" ? (snapshot.employees[0]?.employeeNumber || snapshot.employees[0]?.id || "employee").replace(/[^a-zA-Z0-9_-]/g,"_") : "all";
      res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="timesheets-${label}-${snapshot.period.start}-${snapshot.period.end}.xlsx"`, "Cache-Control": "private, no-store" });
      res.send(file);
    } catch { res.status(500).json({ message: "Could not download the workbook" }); }
  });
  app.post("/api/admin/attendance/payroll-timesheet/:id/adjust", requireRole("admin"), async (req, res) => {
    const admin = req.user as any;
    const { payableMinutes, expectedMinutes, reason, startTime, endTime } = req.body || {};
    if (!Number.isInteger(payableMinutes) || payableMinutes < 0 || payableMinutes > 2147483647 || !Number.isInteger(expectedMinutes) || typeof reason !== "string" || !reason.trim() || reason.length > 2000 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime || "") || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime || "")) return res.status(400).json({ message: "Enter valid hours, times, and an adjustment reason" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: [entry] } = await client.query("SELECT * FROM time_entries WHERE id=$1 AND company_id=$2 AND status='completed' FOR UPDATE", [String(req.params.id), admin.companyId]);
      if (!entry) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Completed attendance entry not found" }); }
      const { rows: [adjustment] } = await client.query("SELECT COALESCE(SUM(adjustment_minutes),0)::integer total FROM attendance_adjustments WHERE time_entry_id=$1 AND company_id=$2 AND is_voided=false", [entry.id, admin.companyId]);
      const recorded = Math.max(0,Math.round((Date.parse(entry.clock_out_at)-Date.parse(entry.clock_in_at))/60000));
      const currentBeforeClamp = recorded + adjustment.total;
      const current = Math.max(0, currentBeforeClamp);
      if (current !== expectedMinutes) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Hours changed since this sheet was opened. Refresh and review again." }); }
      const note = JSON.stringify({ kind: "timesheet_hours", startTime, endTime });
      await client.query(`INSERT INTO attendance_adjustments(id,company_id,time_entry_id,employee_id,adjustment_minutes,reason,note,created_by_user_id,created_at,is_voided) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,false)`, [admin.companyId, entry.id, entry.employee_id, payableMinutes - currentBeforeClamp, reason.trim(), note, admin.id, new Date().toISOString()]);
      await client.query("COMMIT"); res.json({ saved: true });
    } catch { await client.query("ROLLBACK"); res.status(500).json({ message: "Could not save the adjustment" }); } finally { client.release(); }
  });
  app.patch("/api/admin/attendance/payroll-schedule", requireRole("admin"), async (req, res) => {
    const { anchor, summaryDays, hour, enabled } = req.body || {};
    if (!validDate(anchor) || new Date(anchor + "T12:00:00Z").getUTCDay() !== 1 || !Array.isArray(summaryDays) || !summaryDays.length || summaryDays.some(day => ![2,4].includes(day)) || !Number.isInteger(hour) || hour < 0 || hour > 23 || typeof enabled !== "boolean") return res.status(400).json({ message: "Select a Monday cycle start, summary dates, and a valid hour" });
    const company=await storage.updateCompany((req.user as any).companyId, { defaultPayPeriodType: "biweekly", payrollCycleStartDate: anchor, payrollPaydayDelayDays: 5, payrollSummaryDays: Array.from(new Set<number>(summaryDays)).sort((a,b)=>a-b), payrollSummaryHour: hour, payrollSummaryEnabled: enabled });
    res.json({ saved: true, company });
  });
  app.post("/api/internal/payroll-summary", async (req, res) => {
    const timestamp = String(req.headers["x-clockfield-timestamp"] || ""); const signature = String(req.headers["x-clockfield-signature"] || "");
    if (!process.env.SESSION_SECRET || !/^\d+$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 5 * 60000 || !/^[a-f0-9]{64}$/.test(signature)) return res.status(401).end();
    const expected = createHmac("sha256", process.env.SESSION_SECRET).update(`payroll-summary:${timestamp}`).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return res.status(401).end();
    try { res.json(await sendDuePayrollSummaries()); } catch { res.status(500).json({ message: "Summary processing failed" }); }
  });
}

export async function sendDuePayrollSummaries(now = new Date(), send = sendPayrollHoursEmail) {
  const { rows: companies } = await pool.query("SELECT * FROM companies WHERE payroll_summary_enabled=true AND payroll_cycle_start_date IS NOT NULL");
  let sent = 0;
  for (const company of companies) {
    const today = dateInZone(now, company.timezone);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: company.timezone, hour: "2-digit", hourCycle: "h23" }).format(now));
    if (hour < company.payroll_summary_hour) continue;
    const current = payrollPeriod(company.payroll_cycle_start_date, today);
    const start = dateShift(current.start, -14);
    const period = payrollPeriod(start, start, 5, company.payroll_summary_days);
    if (!period.summaryDates.includes(today)) continue;
    const snapshot = await payrollSnapshot(company.id, start);
    const admins = (await storage.getAdminsByCompany(company.id)).filter(admin => admin.isActive && admin.email);
    const emails = new Set<string>();
    for (const admin of admins) {
      const recipient = admin.email!.trim().toLowerCase();
      if (emails.has(recipient)) continue; emails.add(recipient);
      const claim = await pool.query(`INSERT INTO payroll_summary_deliveries(company_id,period_start,summary_date,recipient_id,status) VALUES($1,$2,$3,$4,'sending') ON CONFLICT(company_id,period_start,summary_date,recipient_id) DO UPDATE SET status='sending',claimed_at=now(),attempts=payroll_summary_deliveries.attempts+1 WHERE payroll_summary_deliveries.status='failed' OR (payroll_summary_deliveries.status='sending' AND payroll_summary_deliveries.claimed_at < now()-interval '30 minutes') RETURNING recipient_id`, [company.id, start, today, recipient]);
      if (!claim.rowCount) continue;
      try {
        await send(admin.email!, snapshot, await createTimesheetWorkbook(snapshot));
        await pool.query("UPDATE payroll_summary_deliveries SET status='sent',sent_at=now(),last_error=NULL WHERE company_id=$1 AND period_start=$2 AND summary_date=$3 AND recipient_id=$4", [company.id,start,today,recipient]); sent++;
      } catch {
        await pool.query("UPDATE payroll_summary_deliveries SET status='failed',last_error='Email delivery failed' WHERE company_id=$1 AND period_start=$2 AND summary_date=$3 AND recipient_id=$4", [company.id,start,today,recipient]);
      }
    }
  }
  return { sent, schedules: companies.map((company:any)=>({id:company.id,timezone:company.timezone,anchor:company.payroll_cycle_start_date,days:company.payroll_summary_days,hour:company.payroll_summary_hour,enabled:true})) };
}
