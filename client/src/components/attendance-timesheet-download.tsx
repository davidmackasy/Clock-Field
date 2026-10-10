import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localToday, shiftDateKey } from "@/lib/timezone";
import { entryMinutes, timesheetRows } from "@shared/time-report";

export function AttendanceTimesheetDownload({ entries, employees, timezone }: { entries: any[]; employees: any[]; timezone: string }) {
  const [employeeId, setEmployeeId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const endDate = end || localToday(timezone);
  const startDate = start || shiftDateKey(endDate, -13);
  const employee = employees.find(e => e.id === employeeId);
  const valid = !!startDate && !!endDate && startDate <= endDate;
  const rows = valid ? timesheetRows(entries, employeeId, startDate, endDate, timezone) : [];
  const total = rows.reduce((sum, row) => sum + entryMinutes(row).payable, 0);
  const worked = rows.reduce((sum, row) => sum + entryMinutes(row).raw, 0);
  const downloadUrl = `/api/admin/attendance/timesheet.csv?${new URLSearchParams({ employeeId, start: startDate, end: endDate })}`;
  return <section className="rounded-lg border p-4 space-y-3" aria-label="Download cleaner timesheet">
    <div><h2 className="font-semibold">Download cleaner timesheet</h2><p className="text-sm text-muted-foreground">Select a cleaner and inclusive date range. Times use {timezone}. Overnight shifts belong to their clock-in date; unfinished shifts are excluded.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1"><Label>Cleaner</Label><Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger className="w-56" aria-label="Timesheet cleaner"><SelectValue placeholder="Select cleaner" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} {e.employeeId ? `(${e.employeeId})` : ""}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label htmlFor="timesheet-start">From</Label><Input id="timesheet-start" type="date" value={startDate} onChange={e => setStart(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="timesheet-end">To</Label><Input id="timesheet-end" type="date" value={endDate} onChange={e => setEnd(e.target.value)} /></div>
      <Button variant="outline" onClick={() => setEnd(shiftDateKey(startDate, 13))}>Two weeks from start</Button>
      {employee && valid && rows.length ? <Button asChild><a href={downloadUrl} download>Download CSV</a></Button> : <Button disabled>Download CSV</Button>}
    </div>
    {!valid && <p className="text-sm text-destructive" role="alert">End date must be on or after the start date.</p>}
    {employee && valid && <p className="text-sm">{rows.length} completed shifts · <strong>{Math.floor(worked / 60)}h {worked % 60}m worked</strong> · {Math.floor(total / 60)}h {total % 60}m payable (includes attendance adjustments)</p>}
  </section>;
}
