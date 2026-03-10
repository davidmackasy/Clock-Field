import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface EmployeeAttendanceModalProps {
  employee: any;
  entries: any[];
  shifts: any[];
  onClose: () => void;
}

export function EmployeeAttendanceModal({ employee, entries, shifts, onClose }: EmployeeAttendanceModalProps) {
  if (!employee) return null;

  const empEntries = entries.filter(e => e.employeeId === employee.id);
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
    const dayEntries = empEntries.filter(e => format(new Date(e.clockInAt), "yyyy-MM-dd") === dateStr);

    if (dayEntries.length === 0) {
      const dayShifts = shifts.filter((s: any) => s.employeeId === employee.id && s.shiftDate === dateStr);
      if (dayShifts.length > 0) return "absent";
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
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
            <p className="text-xs text-muted-foreground">Rate</p>
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
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    empEntries
                      .sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime())
                      .slice(0, 10)
                      .map(entry => {
                        const shift = entry.shiftId ? shiftMap.get(entry.shiftId) : null;
                        const clockIn = new Date(entry.clockInAt);
                        const clockOut = entry.clockOutAt ? new Date(entry.clockOutAt) : null;

                        let variance = "-";
                        if (shift) {
                          const scheduledStart = new Date(shift.scheduledStartAt);
                          const diff = Math.round((clockIn.getTime() - scheduledStart.getTime()) / 60000);
                          if (diff > 0) variance = `+${diff} min late`;
                          else if (diff < 0) variance = `${diff} min early`;
                          else variance = "On time";
                        }

                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs">{format(clockIn, "MM/dd/yy")}</TableCell>
                            <TableCell className="text-xs">
                              {shift
                                ? `${format(new Date(shift.scheduledStartAt), "HH:mm")} - ${format(new Date(shift.scheduledEndAt), "HH:mm")}`
                                : "Unscheduled"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {format(clockIn, "HH:mm")} - {clockOut ? format(clockOut, "HH:mm") : "In progress"}
                            </TableCell>
                            <TableCell className={cn("text-xs font-medium",
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
      </DialogContent>
    </Dialog>
  );
}
