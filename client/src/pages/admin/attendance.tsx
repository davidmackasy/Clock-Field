import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ClipboardList, Search, CalendarIcon, Filter, X, User } from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth, isWithinInterval, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { EmployeeAttendanceModal } from "@/components/employee-attendance-modal";

const flagColors: Record<string, string> = {
  late_clock_in: "destructive",
  early_clock_in: "secondary",
  left_early: "destructive",
  overtime: "default",
  no_show: "destructive",
  unscheduled_clock_in: "secondary",
  stayed_late: "secondary",
};

export default function AdminAttendance() {
  const { data: entries, isLoading } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: shifts } = useQuery<any[]>({ queryKey: ["/api/shifts"] });

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<string>("this_week");
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  const empMap = useMemo(() => new Map((employees || []).map(e => [e.id, e])), [employees]);
  const shiftMap = useMemo(() => new Map((shifts || []).map(s => [s.id, s])), [shifts]);

  const filtered = useMemo(() => {
    if (!entries) return [];

    return entries
      .filter((entry: any) => {
        const emp = empMap.get(entry.employeeId);
        if (!emp) return false;

        // Search filter
        const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        if (search && !fullName.includes(search.toLowerCase()) && !(emp.employeeId || "").toLowerCase().includes(search.toLowerCase())) {
          return false;
        }

        // Employee filter
        if (employeeFilter !== "all" && entry.employeeId !== employeeFilter) {
          return false;
        }

        // Status filter
        if (statusFilter !== "all") {
          if (statusFilter === "completed" && entry.status !== "completed") return false;
          if (statusFilter === "active" && entry.status !== "active") return false;
          if (["late_clock_in", "left_early", "no_show", "early_clock_in", "overtime"].includes(statusFilter)) {
            if (!entry.flags?.includes(statusFilter)) return false;
          }
        }

        // Date range filter
        const clockIn = new Date(entry.clockInAt);
        const now = new Date();
        if (dateRange === "today") {
          if (format(clockIn, "yyyy-MM-dd") !== format(now, "yyyy-MM-dd")) return false;
        } else if (dateRange === "this_week") {
          const weekStart = startOfWeek(now);
          if (clockIn < weekStart) return false;
        } else if (dateRange === "this_month") {
          const monthStart = startOfMonth(now);
          if (clockIn < monthStart) return false;
        } else if (dateRange === "custom") {
          if (customRange.from && clockIn < customRange.from) return false;
          if (customRange.to && clockIn > customRange.to) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime());
  }, [entries, empMap, search, employeeFilter, statusFilter, dateRange, customRange]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-attendance-title">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Review all time entries and attendance records</p>
        </div>
      </div>

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
                          <Badge variant={entry.status === "active" ? "default" : "secondary"} className="text-[10px] h-4">
                            {entry.status}
                          </Badge>
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
    </div>
  );
}
