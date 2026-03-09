import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Trash2 } from "lucide-react";

export default function AdminSchedule() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: "", clientId: "", locationId: "",
    shiftDate: selectedDate,
    scheduledStartAt: "", scheduledEndAt: "",
    expectedHours: "", shiftNotes: "",
  });

  const { data: shifts, isLoading } = useQuery<any[]>({ queryKey: ["/api/shifts/date", selectedDate] });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: clientsList } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: locationsList } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const startDateTime = `${data.shiftDate}T${data.scheduledStartAt}:00`;
      const endDateTime = `${data.shiftDate}T${data.scheduledEndAt}:00`;
      const hours = (new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) / 3600000;
      const res = await apiRequest("POST", "/api/shifts", {
        ...data,
        scheduledStartAt: startDateTime,
        scheduledEndAt: endDateTime,
        expectedHours: hours.toFixed(2),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/date", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shift created" });
      setOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/shifts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/date", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shift deleted" });
    },
  });

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const empMap = new Map((employees || []).map(e => [e.id, e]));
  const clientMap = new Map((clientsList || []).map(c => [c.id, c]));
  const locMap = new Map((locationsList || []).map(l => [l.id, l]));

  const statusColors: Record<string, string> = {
    scheduled: "secondary",
    in_progress: "default",
    completed: "secondary",
    late: "destructive",
    missed: "destructive",
    no_show: "destructive",
    cancelled: "secondary",
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-schedule-title">Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage employee shifts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-shift"><Plus className="w-4 h-4 mr-1.5" />Create Shift</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Shift</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
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
                <Label>Date</Label>
                <Input data-testid="input-shift-date" type="date" value={form.shiftDate} onChange={e => setForm(p => ({ ...p, shiftDate: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input data-testid="input-shift-start" type="time" value={form.scheduledStartAt} onChange={e => setForm(p => ({ ...p, scheduledStartAt: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input data-testid="input-shift-end" type="time" value={form.scheduledEndAt} onChange={e => setForm(p => ({ ...p, scheduledEndAt: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea data-testid="input-shift-notes" value={form.shiftNotes} onChange={e => setForm(p => ({ ...p, shiftNotes: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-shift">
                {createMutation.isPending ? "Creating..." : "Create Shift"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => navigateDate(-1)} data-testid="button-prev-day">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm" data-testid="text-selected-date">{dateLabel}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={() => navigateDate(1)} data-testid="button-next-day">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} data-testid="button-today">
          Today
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !shifts?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No shifts scheduled</p>
            <p className="text-muted-foreground text-sm mt-1">Create a shift to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift: any) => {
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
                        <Badge variant={(statusColors[shift.status] as any) || "secondary"} className="text-xs">{shift.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(shift.scheduledEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {shift.expectedHours && <span>{parseFloat(shift.expectedHours).toFixed(1)}h expected</span>}
                        {client && <span className="truncate">{client.name}</span>}
                        {loc && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{loc.name}</span>}
                      </div>
                      {shift.shiftNotes && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{shift.shiftNotes}</p>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(shift.id)} data-testid={`button-delete-shift-${shift.id}`}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
