import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, Trash2, LayoutGrid, List, Columns,
  Play, Pause, XCircle
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month";

export default function AdminSchedule() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [open, setOpen] = useState(false);
  
  const [shiftType, setShiftType] = useState<"one-time" | "recurring" | "extra">("one-time");
  const [form, setForm] = useState({
    employeeId: "", clientId: "", locationId: "",
    shiftDate: selectedDate,
    scheduledStartAt: "", scheduledEndAt: "",
    shiftNotes: "", shiftLabel: "",
    // Recurring fields
    repeatFrequency: "weekly",
    repeatDays: [] as string[],
    isContinuous: true,
    endDate: "",
  });

  const { data: shifts, isLoading: shiftsLoading } = useQuery<any[]>({ 
    queryKey: viewMode === "day" ? ["/api/shifts/date", selectedDate] : ["/api/shifts"] 
  });
  const { data: recurringSchedules, isLoading: recurringLoading } = useQuery<any[]>({ 
    queryKey: ["/api/recurring-schedules"] 
  });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: clientsList } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: locationsList } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (shiftType === "recurring") {
        const res = await apiRequest("POST", "/api/recurring-schedules", {
          employeeId: data.employeeId,
          clientId: data.clientId || null,
          locationId: data.locationId || null,
          startDate: data.shiftDate,
          endDate: data.isContinuous ? null : data.endDate,
          isContinuous: data.isContinuous,
          repeatFrequency: data.repeatFrequency,
          repeatDays: data.repeatDays,
          scheduledStartTime: data.scheduledStartAt,
          scheduledEndTime: data.scheduledEndAt,
          shiftLabel: data.shiftLabel || null,
          shiftNotes: data.shiftNotes || null,
        });
        return res.json();
      } else {
        const startDateTime = `${data.shiftDate}T${data.scheduledStartAt}:00`;
        const endDateTime = `${data.shiftDate}T${data.scheduledEndAt}:00`;
        const hours = (new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) / 3600000;
        const res = await apiRequest("POST", "/api/shifts", {
          ...data,
          shiftType: shiftType === "extra" ? "extra" : "one-time",
          scheduledStartAt: startDateTime,
          scheduledEndAt: endDateTime,
          expectedHours: hours.toFixed(2),
        });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-schedules"] });
      toast({ title: shiftType === "recurring" ? "Recurring schedule created" : "Shift created" });
      setOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateRecurringMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      await apiRequest("PATCH", `/api/recurring-schedules/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-schedules"] });
      toast({ title: "Schedule updated" });
    },
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/recurring-schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Schedule deleted and future shifts removed" });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/shifts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shift deleted" });
    },
  });

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    if (viewMode === "month") {
      setSelectedDate(format(dir > 0 ? addMonths(d, 1) : subMonths(d, 1), "yyyy-MM-dd"));
    } else if (viewMode === "week") {
      setSelectedDate(format(dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1), "yyyy-MM-dd"));
    } else {
      setSelectedDate(format(dir > 0 ? addDays(d, 1) : subDays(d, 1), "yyyy-MM-dd"));
    }
  };

  const empMap = useMemo(() => new Map((employees || []).map(e => [e.id, e])), [employees]);
  const clientMap = useMemo(() => new Map((clientsList || []).map(c => [c.id, c])), [clientsList]);
  const locMap = useMemo(() => new Map((locationsList || []).map(l => [l.id, l])), [locationsList]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    (shifts || []).forEach(s => {
      const date = s.shiftDate;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(s);
    });
    return map;
  }, [shifts]);

  const statusColors: Record<string, string> = {
    scheduled: "secondary",
    in_progress: "default",
    completed: "outline",
    late: "destructive",
    missed: "destructive",
    no_show: "destructive",
    cancelled: "secondary",
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const recurringDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  const renderDayView = () => {
    const dateShifts = shiftsByDate.get(selectedDate) || [];
    return (
      <div className="space-y-3">
        {!dateShifts.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CalendarIcon className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-medium">No shifts scheduled for this day</p>
            </CardContent>
          </Card>
        ) : (
          dateShifts.map((shift: any) => {
            const emp = empMap.get(shift.employeeId);
            const client = clientMap.get(shift.clientId);
            const loc = locMap.get(shift.locationId);
            return (
              <Card key={shift.id} data-testid={`schedule-shift-${shift.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-sm">{emp ? `${emp.firstName} ${emp.lastName}` : "Unassigned"}</p>
                        <Badge variant={(statusColors[shift.status] as any) || "secondary"} className="text-xs">
                          {shift.status.replace(/_/g, " ")}
                        </Badge>
                        {shift.shiftLabel && <Badge variant="outline" className="text-xs border-primary/20 text-primary">{shift.shiftLabel}</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(shift.scheduledStartAt), "h:mm a")} - {format(new Date(shift.scheduledEndAt), "h:mm a")}
                        </span>
                        {shift.expectedHours && <span>{parseFloat(shift.expectedHours).toFixed(1)}h</span>}
                        {client && <span className="truncate">{client.name}</span>}
                        {loc && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{loc.name}</span>}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteShiftMutation.mutate(shift.id)} data-testid={`button-delete-shift-${shift.id}`}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(new Date(selectedDate));
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    
    return (
      <div className="grid grid-cols-7 gap-2 overflow-x-auto min-w-[700px]">
        {days.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayShifts = shiftsByDate.get(dateStr) || [];
          const isToday = isSameDay(day, new Date());
          
          return (
            <div key={dateStr} className="space-y-2">
              <div className={cn(
                "text-center p-2 rounded-md border",
                isToday ? "bg-primary/5 border-primary/20" : "bg-muted/30"
              )}>
                <p className="text-xs font-medium text-muted-foreground uppercase">{format(day, "EEE")}</p>
                <p className={cn("text-lg font-bold", isToday && "text-primary")}>{format(day, "d")}</p>
              </div>
              <div className="space-y-1.5 min-h-[300px] p-1 border rounded-md bg-muted/10">
                {dayShifts.map((s: any) => {
                  const emp = empMap.get(s.employeeId);
                  return (
                    <div 
                      key={s.id} 
                      className="p-1.5 rounded border bg-card text-[10px] leading-tight shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => { setSelectedDate(dateStr); setViewMode("day"); }}
                    >
                      <p className="font-bold truncate">{emp?.firstName} {emp?.lastName}</p>
                      <p className="text-muted-foreground">{format(new Date(s.scheduledStartAt), "h:mm a")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    const start = startOfMonth(new Date(selectedDate));
    const end = endOfMonth(start);
    const startCal = startOfWeek(start);
    const endCal = endOfWeek(end);
    const days = eachDayOfInterval({ start: startCal, end: endCal });

    return (
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map(d => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground uppercase border-r last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayShifts = shiftsByDate.get(dateStr) || [];
            const isCurrentMonth = isSameMonth(day, start);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate === dateStr;

            return (
              <div 
                key={dateStr} 
                className={cn(
                  "min-h-[100px] p-1 border-r border-b last:border-r-0 cursor-pointer transition-colors hover:bg-muted/20",
                  !isCurrentMonth && "bg-muted/5 opacity-50",
                  isSelected && "bg-primary/5",
                  isToday && "ring-1 ring-inset ring-primary/30"
                )}
                onClick={() => { setSelectedDate(dateStr); setViewMode("day"); }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-xs font-medium p-1 rounded-sm w-6 h-6 flex items-center justify-center",
                    isToday && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayShifts.length > 0 && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                      {dayShifts.length}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 max-h-[70px] overflow-hidden">
                  {dayShifts.slice(0, 3).map((s: any) => (
                    <div key={s.id} className="flex items-center gap-1 text-[9px] truncate bg-muted/40 px-1 rounded py-0.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", s.status === "completed" ? "bg-green-500" : "bg-primary")} />
                      {empMap.get(s.employeeId)?.lastName}
                    </div>
                  ))}
                  {dayShifts.length > 3 && (
                    <p className="text-[9px] text-center text-muted-foreground">+{dayShifts.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-schedule-title">Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage employee shifts and recurring schedules</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-shift"><Plus className="w-4 h-4 mr-1.5" />Create Shift</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Create Shift</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Shift Type</Label>
                <Tabs value={shiftType} onValueChange={(v: any) => setShiftType(v)} className="w-full">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="one-time">One-time</TabsTrigger>
                    <TabsTrigger value="recurring">Recurring</TabsTrigger>
                    <TabsTrigger value="extra">Extra Shift</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select value={form.employeeId} onValueChange={v => setForm(p => ({ ...p, employeeId: v }))}>
                      <SelectTrigger data-testid="select-shift-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        {(employees || []).map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{shiftType === "recurring" ? "Start Date" : "Date"}</Label>
                    <Input data-testid="input-shift-date" type="date" value={form.shiftDate} onChange={e => setForm(p => ({ ...p, shiftDate: e.target.value }))} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input data-testid="input-shift-start" type="time" value={form.scheduledStartAt} onChange={e => setForm(p => ({ ...p, scheduledStartAt: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input data-testid="input-shift-end" type="time" value={form.scheduledEndAt} onChange={e => setForm(p => ({ ...p, scheduledEndAt: e.target.value }))} required />
                  </div>
                </div>

                {shiftType === "recurring" && (
                  <Card className="bg-muted/30 border-dashed">
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Select value={form.repeatFrequency} onValueChange={v => setForm(p => ({ ...p, repeatFrequency: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="biweekly">Bi-weekly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Continuous</Label>
                            <Checkbox checked={form.isContinuous} onCheckedChange={c => setForm(p => ({ ...p, isContinuous: !!c }))} />
                          </div>
                          {!form.isContinuous && (
                            <Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} required />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Repeat Days</Label>
                        <div className="flex flex-wrap gap-2">
                          {recurringDays.map(day => (
                            <Button
                              key={day}
                              type="button"
                              variant={form.repeatDays.includes(day) ? "default" : "outline"}
                              size="sm"
                              className="h-8 w-10 p-0 text-xs capitalize"
                              onClick={() => {
                                setForm(p => ({
                                  ...p,
                                  repeatDays: p.repeatDays.includes(day)
                                    ? p.repeatDays.filter(d => d !== day)
                                    : [...p.repeatDays, day]
                                }));
                              }}
                            >
                              {day.slice(0, 3)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client (optional)</Label>
                    <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {(clientsList || []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Location (optional)</Label>
                    <Select value={form.locationId} onValueChange={v => setForm(p => ({ ...p, locationId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                      <SelectContent>
                        {(locationsList || []).map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shift Label (optional)</Label>
                    <Input placeholder="e.g. Morning Shift" value={form.shiftLabel} onChange={e => setForm(p => ({ ...p, shiftLabel: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea className="h-20" data-testid="input-shift-notes" value={form.shiftNotes} onChange={e => setForm(p => ({ ...p, shiftNotes: e.target.value }))} />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-shift">
                  {createMutation.isPending ? "Processing..." : "Create Schedule"}
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
          <Button 
            size="sm" 
            variant={viewMode === "day" ? "secondary" : "ghost"} 
            className="h-8 gap-1.5"
            onClick={() => setViewMode("day")}
          >
            <List className="w-3.5 h-3.5" /> Day
          </Button>
          <Button 
            size="sm" 
            variant={viewMode === "week" ? "secondary" : "ghost"} 
            className="h-8 gap-1.5"
            onClick={() => setViewMode("week")}
          >
            <Columns className="w-3.5 h-3.5" /> Week
          </Button>
          <Button 
            size="sm" 
            variant={viewMode === "month" ? "secondary" : "ghost"} 
            className="h-8 gap-1.5"
            onClick={() => setViewMode("month")}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Month
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigateDate(-1)} data-testid="button-prev-day">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 px-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm min-w-[120px] text-center" data-testid="text-selected-date">
              {viewMode === "day" ? format(new Date(selectedDate + "T12:00:00"), "EEEE, MMMM do") :
               viewMode === "week" ? `Week of ${format(startOfWeek(new Date(selectedDate)), "MMM do")}` :
               format(new Date(selectedDate + "T12:00:00"), "MMMM yyyy")}
            </span>
          </div>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigateDate(1)} data-testid="button-next-day">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} data-testid="button-today">
            Today
          </Button>
        </div>
      </div>

      {shiftsLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {viewMode === "day" && renderDayView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "month" && renderMonthView()}
        </div>
      )}

      <div className="pt-8 border-t">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Recurring Schedules</h2>
            <p className="text-muted-foreground text-sm">Active templates for generating automatic shifts</p>
          </div>
        </div>

        {recurringLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : !recurringSchedules?.length ? (
          <Card className="bg-muted/20 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Clock className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">No recurring schedules found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recurringSchedules.map((rs: any) => {
              const emp = empMap.get(rs.employeeId);
              return (
                <Card key={rs.id} className={cn("overflow-hidden", rs.status !== "active" && "opacity-60")}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-bold text-sm">{emp?.firstName} {emp?.lastName}</p>
                        <div className="flex flex-wrap gap-1">
                          {rs.repeatDays.map((d: string) => (
                            <Badge key={d} variant="outline" className="text-[10px] h-4 px-1 capitalize">{d}</Badge>
                          ))}
                        </div>
                      </div>
                      <Badge variant={rs.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                        {rs.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {rs.scheduledStartTime} - {rs.scheduledEndTime} ({rs.repeatFrequency})</p>
                      <p className="flex items-center gap-1.5"><CalendarIcon className="w-3 h-3" /> Starts {format(new Date(rs.startDate + "T12:00:00"), "MMM do")}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      {rs.status === "active" ? (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2" onClick={() => updateRecurringMutation.mutate({ id: rs.id, status: "paused" })}>
                          <Pause className="w-3 h-3" /> Pause
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2" onClick={() => updateRecurringMutation.mutate({ id: rs.id, status: "active" })}>
                          <Play className="w-3 h-3" /> Resume
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2 text-destructive hover:text-destructive" onClick={() => deleteRecurringMutation.mutate(rs.id)}>
                        <XCircle className="w-3 h-3" /> End/Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
