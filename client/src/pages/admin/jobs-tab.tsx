import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Briefcase, Calendar, Clock, MapPin, User, AlertTriangle, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const JOB_STATUSES = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "needs_review", label: "Needs Review" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Cancelled" },
];

const SERVICE_TYPES = [
  "Commercial Cleaning", "Residential Cleaning", "Office Cleaning",
  "Retail Cleaning", "Post-Construction Cleaning", "Move-In Cleaning",
  "Move-Out Cleaning", "Deep Cleaning", "Recurring Cleaning",
  "One-Time Cleaning", "General Service Request",
];

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  assigned: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  needs_review: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  missed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
  sent_to_client: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
};

const emptyForm = {
  title: "", clientId: "", locationId: "", serviceType: "General Service Request",
  scheduledDate: "", startTime: "", endTime: "",
  assignedEmployeeIds: [] as string[],
  internalNotes: "", clientNotes: "", accessInstructions: "", priority: "normal",
};

export default function JobsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: jobs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/jobs"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const empMap = useMemo(() => new Map(employees.map((e: any) => [e.id, e])), [employees]);
  const clientMap = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);
  const locMap = useMemo(() => new Map(locations.map((l: any) => [l.id, l])), [locations]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/jobs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job created" });
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${id}`, data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job updated" });
      setDetailJob(updated);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return jobs
      .filter((j: any) => statusFilter === "all" || j.status === statusFilter)
      .filter((j: any) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return j.title?.toLowerCase().includes(q) ||
          clientMap.get(j.clientId)?.name?.toLowerCase().includes(q) ||
          j.serviceType?.toLowerCase().includes(q);
      })
      .sort((a: any, b: any) => {
        if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate < b.scheduledDate ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [jobs, statusFilter, search, clientMap]);

  const toggleEmployee = (id: string) => {
    setForm(p => ({
      ...p,
      assignedEmployeeIds: p.assignedEmployeeIds.includes(id)
        ? p.assignedEmployeeIds.filter(e => e !== id)
        : [...p.assignedEmployeeIds, id],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs + Create button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {JOB_STATUSES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              data-testid={`tab-job-status-${s.value}`}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                statusFilter === s.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {s.label}
              {s.value !== "all" && (
                <span className="ml-1.5 opacity-60">
                  {jobs.filter((j: any) => j.status === s.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-job">
          <Plus className="w-4 h-4 mr-1.5" /> Create Job
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9"
          placeholder="Search jobs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-job-search"
        />
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Briefcase className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">
              {statusFilter === "all" ? "No jobs yet. Create your first job to get started." : `No jobs with status "${statusFilter}".`}
            </p>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((job: any) => {
            const client = clientMap.get(job.clientId);
            const loc = locMap.get(job.locationId);
            const assignedEmps = (job.assignedEmployeeIds || []).map((id: string) => empMap.get(id)).filter(Boolean);
            const isPast = job.scheduledDate < today;
            const maybeMissed = isPast && !["completed", "cancelled", "missed", "sent_to_client"].includes(job.status);
            return (
              <Card
                key={job.id}
                className={cn(
                  "cursor-pointer hover:shadow-md transition-shadow",
                  maybeMissed && "border-red-200 dark:border-red-800/60"
                )}
                onClick={() => setDetailJob(job)}
                data-testid={`card-job-${job.id}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{job.serviceType}</p>
                    </div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap capitalize flex-shrink-0", statusColor[job.status] || statusColor.draft)}>
                      {job.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {client && (
                      <p className="flex items-center gap-1.5 truncate">
                        <User className="w-3 h-3 flex-shrink-0" />{client.name}
                      </p>
                    )}
                    {loc && (
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />{loc.name}
                      </p>
                    )}
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      {job.scheduledDate ? format(new Date(job.scheduledDate + "T12:00:00"), "MMM d, yyyy") : "—"}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {job.startTime} – {job.endTime}
                    </p>
                  </div>
                  {assignedEmps.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                      {assignedEmps.map((e: any) => (
                        <Badge key={e.id} variant="outline" className="text-[10px] h-5 px-1.5">
                          {e.firstName} {e.lastName}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {maybeMissed && (
                    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 pt-2 border-t border-red-100 dark:border-red-900/40">
                      <AlertTriangle className="w-3 h-3" /> May have been missed
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Job Dialog */}
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setForm(emptyForm); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Job</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => { e.preventDefault(); createMutation.mutate({ ...form, status: "scheduled" }); }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label>Job Title *</Label>
              <Input
                required
                placeholder="e.g. Weekly Office Clean – ABC Corp"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                data-testid="input-job-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={form.serviceType} onValueChange={v => setForm(p => ({ ...p, serviceType: v }))}>
                  <SelectTrigger data-testid="select-job-service-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger data-testid="select-job-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger data-testid="select-job-client"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={form.locationId} onValueChange={v => setForm(p => ({ ...p, locationId: v }))}>
                  <SelectTrigger data-testid="select-job-location"><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" required value={form.scheduledDate} onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))} data-testid="input-job-date" />
              </div>
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input type="time" required value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} data-testid="input-job-start-time" />
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <Input type="time" required value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} data-testid="input-job-end-time" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign Workers</Label>
              <div className="flex flex-wrap gap-2">
                {employees.map((e: any) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleEmployee(e.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      form.assignedEmployeeIds.includes(e.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    )}
                    data-testid={`button-assign-emp-${e.id}`}
                  >
                    {e.firstName} {e.lastName}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Access Instructions</Label>
              <Input
                placeholder="e.g. Key code: 1234, park in visitor spots"
                value={form.accessInstructions}
                onChange={e => setForm(p => ({ ...p, accessInstructions: e.target.value }))}
                data-testid="input-job-access"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea className="h-20 resize-none" placeholder="Notes only admins can see" value={form.internalNotes} onChange={e => setForm(p => ({ ...p, internalNotes: e.target.value }))} data-testid="input-job-internal-notes" />
              </div>
              <div className="space-y-2">
                <Label>Client Notes</Label>
                <Textarea className="h-20 resize-none" placeholder="Notes visible to the client" value={form.clientNotes} onChange={e => setForm(p => ({ ...p, clientNotes: e.target.value }))} data-testid="input-job-client-notes" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-job">
              {createMutation.isPending ? "Creating..." : "Create Job"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Job Detail Dialog */}
      {detailJob && (
        <Dialog open={!!detailJob} onOpenChange={v => { if (!v) setDetailJob(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{detailJob.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium capitalize", statusColor[detailJob.status] || statusColor.draft)}>
                  {detailJob.status.replace(/_/g, " ")}
                </span>
                <Badge variant="outline" className="text-xs">{detailJob.serviceType}</Badge>
                {detailJob.priority !== "normal" && (
                  <Badge variant={detailJob.priority === "urgent" ? "destructive" : "secondary"} className="text-xs capitalize">
                    {detailJob.priority}
                  </Badge>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                {clientMap.get(detailJob.clientId) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />{clientMap.get(detailJob.clientId)?.name}
                  </div>
                )}
                {locMap.get(detailJob.locationId) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />{locMap.get(detailJob.locationId)?.name}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {detailJob.scheduledDate ? format(new Date(detailJob.scheduledDate + "T12:00:00"), "MMMM d, yyyy") : "—"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />{detailJob.startTime} – {detailJob.endTime}
                </div>
              </div>
              {detailJob.assignedEmployeeIds?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned Workers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detailJob.assignedEmployeeIds.map((id: string) => {
                      const e = empMap.get(id);
                      return e ? <Badge key={id} variant="secondary" className="text-xs">{e.firstName} {e.lastName}</Badge> : null;
                    })}
                  </div>
                </div>
              )}
              {detailJob.accessInstructions && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Access Instructions</p>
                  <p className="text-sm bg-muted/40 rounded-md p-3">{detailJob.accessInstructions}</p>
                </div>
              )}
              {detailJob.internalNotes && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Internal Notes</p>
                  <p className="text-sm bg-muted/40 rounded-md p-3">{detailJob.internalNotes}</p>
                </div>
              )}
              {detailJob.clientNotes && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Notes</p>
                  <p className="text-sm bg-muted/40 rounded-md p-3">{detailJob.clientNotes}</p>
                </div>
              )}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {["scheduled", "assigned", "in_progress", "completed", "needs_review", "sent_to_client", "missed", "cancelled"].map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant={detailJob.status === s ? "default" : "outline"}
                      className="h-7 text-xs capitalize"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: detailJob.id, data: { status: s } })}
                      data-testid={`button-job-status-${s}`}
                    >
                      {s.replace(/_/g, " ")}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
