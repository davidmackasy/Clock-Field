import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Calendar, User, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type Employee = { id: string; firstName: string; lastName: string; position?: string };
type Shift = { id: string; employeeId: string; shiftDate: string; scheduledStartAt: string; scheduledEndAt: string };
type Job = { id: string; scheduledDate: string; startTime: string; endTime: string; assignedEmployeeIds: string[]; title: string };

export type ScheduleBookingInfo = {
  id: string;
  name: string;
  serviceType: string;
  serviceAddress: string;
  city?: string;
  notes?: string;
  specialInstructions?: string;
  preferredDate?: string;
  preferredTime?: string;
  frequency?: string;
  convertedJobId?: string;
};

function timeToParts(t: string): { h: number; m: number } {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

function toMinutes(t: string): number {
  const { h, m } = timeToParts(t);
  return h * 60 + m;
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  if (!s1 || !e1 || !s2 || !e2) return false;
  return toMinutes(s1) < toMinutes(e2) && toMinutes(e1) > toMinutes(s2);
}

function guessEndTime(startTime: string): string {
  const { h, m } = timeToParts(startTime);
  const endH = (h + 3) % 24;
  return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parsePreferredTime(t: string | undefined): string {
  if (!t) return "09:00";
  if (/^\d{1,2}:\d{2}/.test(t)) return t.substring(0, 5);
  const lower = t.toLowerCase();
  if (lower.includes("morning")) return "09:00";
  if (lower.includes("afternoon")) return "13:00";
  if (lower.includes("evening")) return "17:00";
  if (lower.includes("night")) return "19:00";
  return "09:00";
}

function parsePrefDate(d: string | undefined): string {
  if (!d) return new Date().toISOString().substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.substring(0, 10);
  return new Date().toISOString().substring(0, 10);
}

export function ScheduleCleanerModal({
  open,
  onClose,
  booking,
  estimatedPrice,
  onJobCreated,
}: {
  open: boolean;
  onClose: () => void;
  booking: ScheduleBookingInfo;
  estimatedPrice?: string;
  onJobCreated?: (jobId: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const prefillStart = parsePreferredTime(booking.preferredTime);
  const prefillEnd = guessEndTime(prefillStart);
  const prefillDate = parsePrefDate(booking.preferredDate);

  const [title, setTitle] = useState(`${booking.serviceType} — ${booking.name}`);
  const [scheduledDate, setScheduledDate] = useState(prefillDate);
  const [startTime, setStartTime] = useState(prefillStart);
  const [endTime, setEndTime] = useState(prefillEnd);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [clientNotes, setClientNotes] = useState(booking.notes || booking.specialInstructions || "");
  const [internalNotes, setInternalNotes] = useState(
    `Source: Booking Request\nClient: ${booking.name}\nService: ${booking.serviceType}\nAddress: ${booking.serviceAddress}${booking.city ? `, ${booking.city}` : ""}${estimatedPrice ? `\nEstimated Price: ${estimatedPrice}` : ""}`
  );
  const [priority, setPriority] = useState("normal");
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ empName: string; reason: string }[]>([]);

  const alreadyScheduled = !!booking.convertedJobId;

  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const { data: allJobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: shiftsForDate = [] } = useQuery<Shift[]>({
    queryKey: ["/api/shifts/date", scheduledDate],
    queryFn: async () => {
      if (!scheduledDate) return [];
      const r = await fetch(`/api/shifts/date/${scheduledDate}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!scheduledDate,
  });

  useEffect(() => {
    if (!selectedEmpIds.length || !scheduledDate || !startTime || !endTime) {
      setConflicts([]);
      return;
    }
    const empMap = Object.fromEntries(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
    const found: { empName: string; reason: string }[] = [];

    shiftsForDate.forEach((s: Shift) => {
      if (!selectedEmpIds.includes(s.employeeId)) return;
      const sStart = (s.scheduledStartAt || "").substring(11, 16);
      const sEnd = (s.scheduledEndAt || "").substring(11, 16);
      if (sStart && sEnd && timesOverlap(startTime, endTime, sStart, sEnd)) {
        found.push({ empName: empMap[s.employeeId] || s.employeeId, reason: `has a shift ${sStart}–${sEnd}` });
      }
    });

    allJobs.forEach((j: Job) => {
      if (j.scheduledDate !== scheduledDate) return;
      const empOverlap = (j.assignedEmployeeIds || []).filter(eid => selectedEmpIds.includes(eid));
      if (!empOverlap.length) return;
      if (timesOverlap(startTime, endTime, j.startTime, j.endTime)) {
        empOverlap.forEach(eid => {
          found.push({ empName: empMap[eid] || eid, reason: `has job "${j.title}" ${j.startTime}–${j.endTime}` });
        });
      }
    });

    setConflicts(found);
  }, [selectedEmpIds, scheduledDate, startTime, endTime, shiftsForDate, allJobs, employees]);

  const timeError = !!(startTime && endTime && toMinutes(endTime) <= toMinutes(startTime));

  const createJobMutation = useMutation({
    mutationFn: async () => {
      const job = await apiRequest("POST", "/api/jobs", {
        title,
        serviceType: booking.serviceType,
        scheduledDate,
        startTime,
        endTime,
        assignedEmployeeIds: selectedEmpIds,
        status: "scheduled",
        priority,
        clientNotes: clientNotes || null,
        internalNotes: internalNotes || null,
        bookingRequestId: booking.id,
      }).then(r => r.json());
      await apiRequest("PATCH", `/api/booking-requests/${booking.id}`, {
        status: "converted_to_job",
        convertedJobId: job.id,
      });
      return job;
    },
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/booking-requests", booking.id] });
      setCreatedJobId(job.id);
      toast({ title: "Job created!", description: "The booking has been scheduled." });
      onJobCreated?.(job.id);
    },
    onError: (e: any) => toast({ title: "Failed to create job", description: e.message, variant: "destructive" }),
  });

  function toggleEmp(id: string) {
    setSelectedEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  if (createdJobId) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" /> Job Scheduled!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              The cleaning job has been created and linked to this booking request.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-emerald-800">{title}</p>
              <p className="text-emerald-700 text-xs">{scheduledDate} · {startTime} – {endTime}</p>
              {selectedEmpIds.length > 0 && (
                <p className="text-emerald-700 text-xs">
                  Assigned: {selectedEmpIds
                    .map(id => employees.find(e => e.id === id))
                    .filter(Boolean)
                    .map(e => `${e!.firstName} ${e!.lastName}`)
                    .join(", ")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button
              data-testid="button-view-scheduled-job"
              onClick={() => { onClose(); navigate("/admin/schedule?tab=jobs"); }}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View in Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Schedule Cleaner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {alreadyScheduled && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This booking already has a scheduled job linked to it. Creating another will add a second job entry.</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-medium mb-1">Pre-filled from booking request</p>
            <p>{booking.name} · {booking.serviceType} · {booking.serviceAddress}{booking.city ? `, ${booking.city}` : ""}</p>
            {booking.preferredDate && <p className="mt-0.5">Client preferred: {booking.preferredDate}{booking.preferredTime ? ` at ${booking.preferredTime}` : ""}</p>}
          </div>

          <div>
            <Label className="text-xs font-medium mb-1.5 block">Job Title *</Label>
            <Input
              data-testid="input-job-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Residential Cleaning — John Smith"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Date *</Label>
              <Input data-testid="input-job-date" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Start Time *</Label>
              <Input data-testid="input-job-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">End Time *</Label>
              <Input data-testid="input-job-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          {timeError && <p className="text-xs text-red-600 -mt-3">End time must be after start time.</p>}

          <div>
            <Label className="text-xs font-medium mb-1.5 block">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-job-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium mb-2 block">
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Assign Cleaners</span>
            </Label>
            {employees.length === 0 ? (
              <p className="text-xs text-muted-foreground">No employees found.</p>
            ) : (
              <div className="border rounded-xl divide-y max-h-48 overflow-y-auto">
                {employees.map(emp => {
                  const empName = `${emp.firstName} ${emp.lastName}`;
                  const isConflicted = conflicts.some(c => c.empName === empName);
                  const isSelected = selectedEmpIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors",
                        isConflicted && isSelected && "bg-red-50"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleEmp(emp.id)}
                        data-testid={`checkbox-emp-${emp.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{empName}</p>
                        {emp.position && <p className="text-xs text-muted-foreground">{emp.position}</p>}
                      </div>
                      {isConflicted && isSelected && (
                        <span className="text-xs text-red-600 font-medium shrink-0 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Conflict
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 space-y-0.5">
                <p className="font-semibold mb-1">Schedule conflict detected</p>
                {conflicts.map((c, i) => (
                  <p key={i}>• {c.empName} {c.reason}</p>
                ))}
                <p className="mt-1.5 text-red-700">Please choose another cleaner or adjust the time.</p>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium mb-1.5 block">Notes for Cleaner</Label>
            <Textarea
              data-testid="input-job-client-notes"
              value={clientNotes}
              onChange={e => setClientNotes(e.target.value)}
              placeholder="Cleaning instructions, access info, areas to focus on..."
              className="min-h-[70px] text-sm resize-none"
            />
          </div>

          <div>
            <Label className="text-xs font-medium mb-1.5 block">Internal Admin Notes</Label>
            <Textarea
              data-testid="input-job-internal-notes"
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              className="min-h-[80px] text-sm resize-none font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            data-testid="button-create-scheduled-job"
            disabled={!title.trim() || !scheduledDate || !startTime || !endTime || !!timeError || createJobMutation.isPending}
            onClick={() => createJobMutation.mutate()}
            className="gap-1.5"
          >
            {createJobMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Calendar className="w-4 h-4" />}
            Create Scheduled Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
