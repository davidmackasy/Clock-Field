import {entryMinutes} from '@shared/time-report';
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { companyDateKey, formatCompanyDate, formatCompanyTime, formatLocalWallTime } from "@/lib/timezone";

export interface EmployeeAttendanceModalProps {
  employee: any;
  entries: any[];
  shifts: any[];
  timezone?: string;
  onClose: () => void;
}

export function EmployeeAttendanceModal({ employee, entries, shifts, timezone, onClose }: EmployeeAttendanceModalProps) {
  if (!employee) return null;
  const { data: timezoneData } = useQuery<{ timezone: string }>({ queryKey: ["/api/settings/timezone"], staleTime: Infinity });
  const tz = timezone || timezoneData?.timezone || "UTC";

  const [range,setRange]=useState("all"),[start,setStart]=useState(""),[end,setEnd]=useState(""),[page,setPage]=useState(0);
  const today=companyDateKey(new Date(),tz);const back=(days:number)=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10);};
  const lower=range==="custom"?start:range==="month"?today.slice(0,7)+"-01":range==="week"?back(6):range==="two-weeks"?back(13):range==="30-days"?back(29):"";
  const upper=range==="custom"?end:range==="all"?"":today;
  const empEntries=entries.filter(e=>e.employeeId===employee.id).filter(e=>{const day=companyDateKey(e.clockInAt,tz);return (!lower||day>=lower)&&(!upper||day<=upper);}).sort((a,b)=>b.clockInAt.localeCompare(a.clockInAt));

  const totalShifts = empEntries.length;
  const completed = empEntries.filter(e => e.status === "completed").length;
  const lates = empEntries.filter(e => e.flags?.includes("late_clock_in")).length;
  const earlyLeaves = empEntries.filter(e => e.flags?.includes("left_early")).length;
  const noShows = empEntries.filter(e => e.flags?.includes("no_show")).length;
  const attendanceRate = totalShifts > 0 ? Math.round((completed / totalShifts) * 100) : 0;

  const shiftMap = new Map((shifts || []).map((s: any) => [s.id, s]));

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayEntries = empEntries.filter(e => companyDateKey(e.clockInAt, tz) === dateStr);

    if (dayEntries.length === 0) {
      const dayShifts = shifts.filter((s: any) => s.employeeId === employee.id && s.shiftDate === dateStr);
      if(dayShifts.some((s:any)=>s.status!=="cancelled"&&s.shiftDate<today))return "absent";
      return "none";
    }

    const hasIssue = dayEntries.some(e => e.flags?.includes("late_clock_in") || e.flags?.includes("left_early"));
    return hasIssue ? "issue" : "on-time";
  };

  const modifiers = {
    onTime: (date: Date) => getDayStatus(date) === "on-time",
    issue: (date: Date) => getDayStatus(date) === "issue",
    absent: (date: Date) => getDayStatus(date) === "absent",
  };

  const modifierStyles = {
    onTime: { color: "white", backgroundColor: "rgb(34 197 94)" },
    issue: { color: "white", backgroundColor: "rgb(245 158 11)" },
    absent: { color: "white", backgroundColor: "rgb(239 68 68)" },
  };

  return (
    <Dialog open={!!employee} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={employee.avatarUrl} alt={`${employee.firstName} ${employee.lastName}`} />
              <AvatarFallback>{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl">
                {employee.firstName} {employee.lastName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">ID: {employee.employeeId || "N/A"}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{employee.position || "Staff"}</span>
                <Badge variant={employee.accountStatus === "active" ? "default" : "secondary"} className="ml-2 text-[10px] h-4">
                  {employee.accountStatus}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 mt-4"><label className="text-sm">Period <select className="border rounded-md p-2 ml-2" aria-label="Attendance period" value={range} onChange={e=>{setRange(e.target.value);setPage(0);}}><option value="all">All attendance</option><option value="week">Last 7 days</option><option value="two-weeks">Last 2 weeks</option><option value="30-days">Last 30 days</option><option value="month">This month</option><option value="custom">Custom dates</option></select></label>{range==="custom"&&<><input aria-label="Attendance start date" type="date" className="border rounded-md p-2" value={start} onChange={e=>{setStart(e.target.value);setPage(0);}}/><input aria-label="Attendance end date" type="date" className="border rounded-md p-2" value={end} onChange={e=>{setEnd(e.target.value);setPage(0);}}/></>}<p className="text-sm text-muted-foreground">{empEntries.length} clock-in records · {(empEntries.reduce((sum,e)=>sum+(e.clockOutAt?entryMinutes(e).raw:0),0)/60).toFixed(2)} recorded hours</p></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Shifts</p>
            <p className="text-xl font-bold">{totalShifts}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-xl font-bold">{completed}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Late Arrivals</p>
            <p className="text-xl font-bold text-destructive">{lates}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Left Early</p>
            <p className="text-xl font-bold text-destructive">{earlyLeaves}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">No Shows</p>
            <p className="text-xl font-bold text-destructive">{noShows}</p>
          </Card>
          <Card className="p-3 text-center bg-primary/5 border-primary/20">
            <p className="text-xs text-muted-foreground">Completed sessions</p>
            <p className="text-xl font-bold text-primary">{attendanceRate}%</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-1">
            <h3 className="text-sm font-semibold mb-4">Attendance Calendar</h3>
            <Card className="p-4 flex justify-center">
              <Calendar
                mode="single"
                month={calendarDate}
                onMonthChange={setCalendarDate}
                modifiers={modifiers}
                modifiersStyles={modifierStyles}
                className="rounded-md border"
              />
            </Card>
            <div className="flex flex-wrap gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>On-time</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Late/Early</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Absent</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold mb-4">Attendance History</h3>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Scheduled</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Hours</TableHead><TableHead className="hidden sm:table-cell">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    empEntries
                      .sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime())
                      .slice(page*20,page*20+20)
                      .map(entry => {
                        const shift = entry.shiftId ? shiftMap.get(entry.shiftId) : null;
                        const clockIn = new Date(entry.clockInAt);
                        const clockOut = entry.clockOutAt ? new Date(entry.clockOutAt) : null;

                        let variance = "-";
                        if (shift) {
                          const localClock = new Date(`${companyDateKey(clockIn, tz)}T${formatCompanyInstantParts(clockIn, tz)}Z`);
                          const scheduledStart = new Date(`${shift.scheduledStartAt}Z`);
                          const diff = Math.round((localClock.getTime() - scheduledStart.getTime()) / 60000);
                          if (diff > 0) variance = `+${diff} min late`;
                          else if (diff < 0) variance = `${diff} min early`;
                          else variance = "On time";
                        }

                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs">{formatCompanyDate(clockIn, tz, true)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs">
                              {shift
                                ? `${formatLocalWallTime(shift.scheduledStartAt)} – ${formatLocalWallTime(shift.scheduledEndAt)}`
                                : "Unscheduled"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatCompanyTime(clockIn, tz)} – {clockOut ? formatCompanyTime(clockOut, tz) : "In progress"}<p className="text-muted-foreground mt-1">{entry.locationName||""}</p>
                            </TableCell>
                            <TableCell className="text-xs">{clockOut?(entryMinutes(entry).raw/60).toFixed(2):"—"}</TableCell><TableCell className={cn("hidden sm:table-cell text-xs font-medium",
                              variance.includes("late") ? "text-destructive" : variance.includes("early") ? "text-orange-500" : "text-green-600"
                            )}>
                              {variance}
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        {empEntries.length>20&&<div className="flex justify-between items-center gap-3"><button className="border rounded-md px-3 py-2 text-sm" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span className="text-sm">{page+1} / {Math.ceil(empEntries.length/20)}</span><button className="border rounded-md px-3 py-2 text-sm" disabled={(page+1)*20>=empEntries.length} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
      </DialogContent>
    </Dialog>
  );
}

function formatCompanyInstantParts(value: string | Date, tz: string): string {
  return new Date(value).toLocaleTimeString("sv-SE", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
