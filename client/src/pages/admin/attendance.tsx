import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ClipboardList, Search, CalendarIcon, Filter, User, Clock, BarChart2, Users2, TrendingUp, AlertCircle, LogOut } from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { EmployeeAttendanceModal } from "@/components/employee-attendance-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const flagColors: Record<string, string> = {
  late_clock_in: "destructive",
  early_clock_in: "secondary",
  left_early: "destructive",
  early_clock_out: "destructive",
  late_clock_out: "secondary",
  overtime: "default",
  no_show: "destructive",
  unscheduled_clock_in: "secondary",
  stayed_late: "secondary",
};

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

function formatRunningTime(clockInAt: string) {
  const diffMs = Date.now() - new Date(clockInAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// ── Manual Clock-Out Modal ─────────────────────────────────────────────────────
function ManualClockOutModal({
  entry,
  emp,
  shift,
  onClose,
}: {
  entry: any;
  emp: any;
  shift: any;
  onClose: () => void;
}) {
  const { toast } = useToast();

  // Pre-fill with scheduled end time or current time
  const defaultClockOut = useMemo(() => {
    if (shift?.scheduledEndAt) {
      const d = new Date(shift.scheduledEndAt);
      return format(d, "yyyy-MM-dd'T'HH:mm");
    }
    return format(new Date(), "yyyy-MM-dd'T'HH:mm");
  }, [shift]);

  const [clockOutValue, setClockOutValue] = useState(defaultClockOut);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/time-entries/${entry.id}/admin-clock-out`, {
        clockOutAt: new Date(clockOutValue).toISOString(),
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to clock out");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({ title: "Shift closed", description: `${emp?.firstName} ${emp?.lastName} has been clocked out.` });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const clockInDate = new Date(entry.clockInAt);
  const clockOutDate = clockOutValue ? new Date(clockOutValue) : null;
  const isValidTime = clockOutDate && clockOutDate > clockInDate;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual Clock-Out</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Employee info */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee</span>
              <span className="font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{format(clockInDate, "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Clocked in at</span>
              <span className="font-medium">{format(clockInDate, "HH:mm")}</span>
            </div>
            {shift && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled shift</span>
                <span className="font-medium">
                  {format(new Date(shift.scheduledStartAt), "HH:mm")} – {format(new Date(shift.scheduledEndAt), "HH:mm")}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Running for</span>
              <span className="font-medium text-orange-500">{formatRunningTime(entry.clockInAt)}</span>
            </div>
          </div>

          {/* Clock-out time picker */}
          <div className="space-y-1.5">
            <Label htmlFor="clockout-time">Clock-out time</Label>
            <Input
              id="clockout-time"
              type="datetime-local"
              value={clockOutValue}
              onChange={(e) => setClockOutValue(e.target.value)}
              data-testid="input-manual-clockout-time"
            />
            {clockOutValue && !isValidTime && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Clock-out time cannot be before clock-in time.
              </p>
            )}
          </div>

          {/* Optional reason */}
          <div className="space-y-1.5">
            <Label htmlFor="clockout-reason">Reason / note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="clockout-reason"
              placeholder="e.g. Employee forgot to clock out"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              data-testid="input-manual-clockout-reason"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-manual-clockout">Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isValidTime || mutation.isPending}
            data-testid="button-save-manual-clockout"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            {mutation.isPending ? "Saving…" : "Save Clock-Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminAttendance() {
  const { toast } = useToast();
  const search_ = useSearch();
  const initParams = new URLSearchParams(search_);

  const { data: entries, isLoading } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: shifts } = useQuery<any[]>({ queryKey: ["/api/shifts"] });

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<string>(initParams.get("dateRange") || "this_week");
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState<string>(initParams.get("status") || "all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [manualClockOutEntry, setManualClockOutEntry] = useState<any>(null);

  const empMap = useMemo(() => new Map((employees || []).map(e => [e.id, e])), [employees]);
  const shiftMap = useMemo(() => new Map((shifts || []).map(s => [s.id, s])), [shifts]);

  // Forgotten clock-out assist — only entries that are scheduled, still active,
  // and more than 5 minutes past their scheduled end time.
  const overdueEntries = useMemo(() => {
    if (!entries || !shifts) return [];
    const THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();
    return entries
      .filter((e: any) => {
        if (e.status !== "active" || e.clockOutAt || !e.shiftId) return false;
        const shift = shiftMap.get(e.shiftId);
        if (!shift?.scheduledEndAt) return false;
        return now > new Date(shift.scheduledEndAt).getTime() + THRESHOLD_MS;
      })
      .map((e: any) => {
        const shift = shiftMap.get(e.shiftId);
        const overdueMs = now - new Date(shift.scheduledEndAt).getTime();
        const overdueMin = Math.floor(overdueMs / 60000);
        return { ...e, _shift: shift, _overdueMin: overdueMin };
      })
      .sort((a, b) => b._overdueMin - a._overdueMin);
  }, [entries, shifts, shiftMap]);

  const filtered = useMemo(() => {
    if (!entries) return [];

    return entries
      .filter((entry: any) => {
        const emp = empMap.get(entry.employeeId);
        if (!emp) return false;

        const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        if (search && !fullName.includes(search.toLowerCase()) && !(emp.employeeId || "").toLowerCase().includes(search.toLowerCase())) {
          return false;
        }

        if (employeeFilter !== "all" && entry.employeeId !== employeeFilter) return false;

        if (statusFilter !== "all") {
          if (statusFilter === "completed" && entry.status !== "completed") return false;
          if (statusFilter === "active" && entry.status !== "active") return false;
          if (["late_clock_in", "left_early", "no_show", "early_clock_in", "overtime"].includes(statusFilter)) {
            if (!entry.flags?.includes(statusFilter)) return false;
          }
        }

        const clockIn = new Date(entry.clockInAt);
        const now = new Date();
        if (dateRange === "today") {
          if (format(clockIn, "yyyy-MM-dd") !== format(now, "yyyy-MM-dd")) return false;
        } else if (dateRange === "this_week") {
          if (clockIn < startOfWeek(now)) return false;
        } else if (dateRange === "last_2_weeks") {
          if (clockIn < subDays(now, 14)) return false;
        } else if (dateRange === "this_month") {
          if (clockIn < startOfMonth(now)) return false;
        } else if (dateRange === "custom") {
          if (customRange.from && clockIn < startOfDay(customRange.from)) return false;
          if (customRange.to && clockIn > endOfDay(customRange.to)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime());
  }, [entries, empMap, search, employeeFilter, statusFilter, dateRange, customRange]);

  const summary = useMemo(() => {
    const withHours = filtered.filter(e => e.clockInAt && e.clockOutAt);
    const totalMinutes = withHours.reduce((sum, e) => {
      if (e.workedMinutes != null) return sum + e.workedMinutes;
      const diff = (new Date(e.clockOutAt).getTime() - new Date(e.clockInAt).getTime()) / 60000;
      return sum + Math.max(0, diff);
    }, 0);
    const totalShifts = withHours.length;
    const avgMinutes = totalShifts > 0 ? totalMinutes / totalShifts : 0;
    const uniqueEmployees = new Set(filtered.map((e: any) => e.employeeId)).size;
    return { totalMinutes, totalShifts, avgMinutes, uniqueEmployees };
  }, [filtered]);

  const selectedEmployeeName = useMemo(() => {
    if (employeeFilter === "all") return null;
    const emp = employees?.find(e => e.id === employeeFilter);
    return emp ? `${emp.firstName} ${emp.lastName}` : null;
  }, [employeeFilter, employees]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-attendance-title">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Review all time entries and attendance records</p>
        </div>
      </div>

      {/* ── Forgotten Clock-Outs Assist ── only shown when >5 min past scheduled end */}
      {!isLoading && overdueEntries.length > 0 && (
        <div
          className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 space-y-2"
          data-testid="section-forgotten-clockouts"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              Forgotten clock-outs
            </span>
            <Badge variant="secondary" className="text-[10px] h-4 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-0">
              {overdueEntries.length}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {overdueEntries.map((entry: any) => {
              const emp = empMap.get(entry.employeeId);
              const overdueH = Math.floor(entry._overdueMin / 60);
              const overdueM = entry._overdueMin % 60;
              const overdueLabel = overdueH > 0 ? `${overdueH}h ${overdueM}m` : `${overdueM} min`;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-white dark:bg-orange-950/40 border border-orange-100 dark:border-orange-800 px-3 py-2"
                  data-testid={`row-overdue-${entry.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      Scheduled end: {format(new Date(entry._shift.scheduledEndAt), "h:mm a")}
                    </span>
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                      Overdue by {overdueLabel}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-shrink-0 border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900 dark:border-orange-700"
                    onClick={() => setManualClockOutEntry(entry)}
                    data-testid={`button-manual-clockout-${entry.id}`}
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    Manual Clock-Out
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-attendance"
          />
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger>
            <CalendarIcon className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="last_2_weeks">Last 2 Weeks</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        {dateRange === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customRange.from ? (
                  customRange.to ? (
                    <>
                      {format(customRange.from, "LLL dd, y")} -{" "}
                      {format(customRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(customRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                initialFocus
                mode="range"
                defaultMonth={customRange.from}
                selected={{ from: customRange.from, to: customRange.to }}
                onSelect={(range: any) => setCustomRange(range || { from: undefined, to: undefined })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="active">In Progress</SelectItem>
            <SelectItem value="late_clock_in">Late Clock-in</SelectItem>
            <SelectItem value="left_early">Left Early</SelectItem>
            <SelectItem value="early_clock_in">Early Clock-in</SelectItem>
            <SelectItem value="overtime">Overtime</SelectItem>
            <SelectItem value="no_show">No Show / Missed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger>
            <User className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {(employees || []).map(emp => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Summary Cards ── */}
      {!isLoading && (
        <div className="space-y-2">
          {selectedEmployeeName && (
            <p className="text-xs text-muted-foreground" data-testid="text-summary-label">
              Showing totals for: <span className="font-medium text-foreground">{selectedEmployeeName}</span>
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Total Hours Worked</p>
                  <p className="text-lg font-bold leading-tight" data-testid="text-summary-hours">{formatMinutes(summary.totalMinutes)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-4 h-4 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Total Shifts</p>
                  <p className="text-lg font-bold leading-tight" data-testid="text-summary-shifts">{summary.totalShifts}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Avg Hours / Shift</p>
                  <p className="text-lg font-bold leading-tight" data-testid="text-summary-avg">{formatMinutes(summary.avgMinutes)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Users2 className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Employees</p>
                  <p className="text-lg font-bold leading-tight" data-testid="text-summary-employees">{summary.uniqueEmployees}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── All Entries Table ── */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No attendance records matching filters</p>
            <Button variant="ghost" className="text-primary hover:underline underline-offset-4" onClick={() => {
              setSearch("");
              setDateRange("all");
              setStatusFilter("all");
              setEmployeeFilter("all");
            }}>Clear all filters</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Actual Time</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry: any) => {
                    const emp = empMap.get(entry.employeeId);
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
                      <TableRow key={entry.id} data-testid={`row-attendance-${entry.id}`}>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => setSelectedEmployee(emp)}
                            className="text-primary hover:underline font-medium text-sm text-left"
                            data-testid={`button-employee-detail-${entry.id}`}
                          >
                            {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm">{format(clockIn, "MM/dd/yyyy")}</TableCell>
                        <TableCell className="text-sm">
                          {shift ? `${format(new Date(shift.scheduledStartAt), "HH:mm")} - ${format(new Date(shift.scheduledEndAt), "HH:mm")}` : "Unscheduled"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(clockIn, "HH:mm")} - {clockOut ? format(clockOut, "HH:mm") : "In progress"}
                        </TableCell>
                        <TableCell className={cn("text-sm font-medium",
                          variance.includes("late") ? "text-destructive" : variance.includes("early") ? "text-orange-500" : "text-green-600"
                        )}>
                          {variance}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant={entry.status === "active" ? "default" : "secondary"} className="text-[10px] h-4">
                              {entry.status}
                            </Badge>
                            {entry.manuallyClosedByAdmin && (
                              <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground">
                                Admin corrected
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(entry.flags || []).map((flag: string, i: number) => (
                              <Badge key={i} variant={(flagColors[flag] as any) || "secondary"} className="text-[10px] h-4">
                                {flag.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEmployee && (
        <EmployeeAttendanceModal
          employee={selectedEmployee}
          entries={entries || []}
          shifts={shifts || []}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

      {manualClockOutEntry && (
        <ManualClockOutModal
          entry={manualClockOutEntry}
          emp={empMap.get(manualClockOutEntry.employeeId)}
          shift={manualClockOutEntry.shiftId ? shiftMap.get(manualClockOutEntry.shiftId) : null}
          onClose={() => setManualClockOutEntry(null)}
        />
      )}
    </div>
  );
}
