import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch, useLocation, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import {
  MessageSquare, X, AlertTriangle, User2, ChevronRight, Clock,
  Send, ChevronLeft, ChevronRight as ChevronRightIcon, Image,
  Plus, Users, CheckCircle, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const OPEN_STATUSES = new Set(["new", "open", "in_review", "scheduled", "replied", "in_progress"]);

const STATUS_LABELS: Record<string, string> = {
  new: "New", pending: "Pending", replied: "Replied",
  open: "Open", in_review: "In Review", in_progress: "In Progress",
  scheduled: "Scheduled", resolved: "Resolved", closed: "Closed",
};

const STATUS_VARIANT: Record<string, string> = {
  new: "default", pending: "secondary", replied: "default",
  open: "default", in_review: "default", in_progress: "default",
  scheduled: "secondary", resolved: "secondary", closed: "outline",
};

const PRIORITY_VARIANT: Record<string, string> = {
  low: "secondary", normal: "secondary", high: "destructive", urgent: "destructive",
};

const CLEANER_REQUEST_TYPES = [
  { value: "complaint_followup", label: "Complaint Follow-up" },
  { value: "re_clean", label: "Re-Clean Required" },
  { value: "inspection", label: "Inspection Required" },
  { value: "missing_task", label: "Missing Task Follow-up" },
  { value: "incident_followup", label: "Incident Follow-up" },
  { value: "field_check", label: "Field Check" },
  { value: "custom", label: "Custom" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function UrlLightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center" onClick={onClose} data-testid="lightbox-overlay">
      <button className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-2 hover:bg-black/70" onClick={onClose} data-testid="button-lightbox-close">
        <X className="w-5 h-5" />
      </button>
      <div className="relative flex items-center justify-center w-full max-w-3xl px-14" onClick={e => e.stopPropagation()}>
        {urls.length > 1 && (
          <button className="absolute left-2 text-white bg-black/40 rounded-full p-2 hover:bg-black/70 disabled:opacity-30" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} data-testid="button-lightbox-prev">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <img src={urls[idx]} alt={`photo ${idx + 1}`} className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-xl" data-testid="lightbox-image" />
        {urls.length > 1 && (
          <button className="absolute right-2 text-white bg-black/40 rounded-full p-2 hover:bg-black/70 disabled:opacity-30" onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))} disabled={idx === urls.length - 1} data-testid="button-lightbox-next">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      <p className="text-white/60 text-xs mt-4">{idx + 1} / {urls.length}</p>
    </div>
  );
}

function ThreadMessage({ msg, clientName }: { msg: any; clientName: string }) {
  const isAdmin = msg.authorRole === "admin";
  return (
    <div className={`flex flex-col gap-1 ${isAdmin ? "items-end" : "items-start"}`}>
      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
        isAdmin ? "bg-primary text-primary-foreground" :
        msg.messageType === "status_change" ? "bg-muted border border-border" :
        "bg-card border border-border"
      }`}>
        {msg.messageType === "status_change" ? (
          <p className="text-xs text-muted-foreground italic">Status: <span className="font-semibold">{STATUS_LABELS[msg.statusValue] || msg.statusValue}</span></p>
        ) : (
          <>
            <p className="text-xs font-medium mb-1 opacity-70">{isAdmin ? "Admin" : clientName}</p>
            {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}
          </>
        )}
        {msg.attachments?.length > 0 && (
          <div className="grid grid-cols-2 gap-1 mt-2">
            {msg.attachments.map((att: any) => (
              <img key={att.id} src={`/api/attachments/${att.id}/image`} alt={att.caption || "photo"} className="w-full h-24 object-cover rounded-md bg-muted" loading="lazy" />
            ))}
          </div>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
    </div>
  );
}

// ── New Cleaner Request Dialog ────────────────────────────────────────────────
function NewCleanerRequestDialog({ open, onClose, employees, locations }: { open: boolean; onClose: () => void; employees: any[]; locations: any[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    assignedCleanerId: "",
    title: "",
    requestType: "complaint_followup",
    description: "",
    complaintDetails: "",
    requestedAction: "",
    locationId: "",
    priority: "normal",
    requiresReplyBeforeClockOut: false,
  });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/cleaner-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const raw = await res.text();
        console.error("[send-cleaner-req] Non-JSON response:", res.status, raw.slice(0, 300));
        throw new Error("Unable to send request right now. Please try again.");
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to send request to cleaner");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      toast({ title: "Request sent to cleaner" });
      onClose();
      setForm({ assignedCleanerId: "", title: "", requestType: "complaint_followup", description: "", complaintDetails: "", requestedAction: "", locationId: "", priority: "normal", requiresReplyBeforeClockOut: false });
      setPhotos([]);
    },
    onError: (err: any) => toast({ title: "Unable to send request", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Request to Cleaner</DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); createMut.mutate({ ...form, photos: photos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption })) }); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Assign to Cleaner <span className="text-destructive">*</span></Label>
            <Select value={form.assignedCleanerId} onValueChange={v => set("assignedCleanerId", v)}>
              <SelectTrigger data-testid="select-cleaner-assignee"><SelectValue placeholder="Select cleaner..." /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Request Title <span className="text-destructive">*</span></Label>
            <Input data-testid="input-cleaner-req-title" value={form.title} onChange={e => set("title", e.target.value)} required placeholder="Brief description of what's needed" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Request Type</Label>
              <Select value={form.requestType} onValueChange={v => set("requestType", v)}>
                <SelectTrigger data-testid="select-cleaner-req-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLEANER_REQUEST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger data-testid="select-cleaner-req-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {locations.length > 0 && (
            <div className="space-y-1.5">
              <Label>Location / Site (optional)</Label>
              <Select value={form.locationId || "none"} onValueChange={v => set("locationId", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-cleaner-req-location"><SelectValue placeholder="Select location..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific location</SelectItem>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Issue / Complaint Details</Label>
            <Textarea data-testid="input-cleaner-complaint" value={form.complaintDetails} onChange={e => set("complaintDetails", e.target.value)} rows={2} placeholder="Describe the complaint or issue that needs attention..." />
          </div>

          <div className="space-y-1.5">
            <Label>What Needs to Be Checked</Label>
            <Textarea data-testid="input-cleaner-description" value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="What the cleaner should inspect or verify..." />
          </div>

          <div className="space-y-1.5">
            <Label>What Needs to Be Done</Label>
            <Textarea data-testid="input-cleaner-action" value={form.requestedAction} onChange={e => set("requestedAction", e.target.value)} rows={2} placeholder="Specific actions the cleaner should take..." />
          </div>

          <div className="space-y-1.5">
            <Label>Attach Photos (optional)</Label>
            <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={5} label="Add Reference Photos" />
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3 bg-amber-50 border-amber-200">
            <Switch
              id="requires-reply"
              checked={form.requiresReplyBeforeClockOut}
              onCheckedChange={v => set("requiresReplyBeforeClockOut", v)}
              data-testid="switch-requires-reply"
            />
            <div>
              <Label htmlFor="requires-reply" className="text-sm font-medium cursor-pointer">Require reply before clock out</Label>
              <p className="text-xs text-muted-foreground">Cleaner will be reminded to reply before ending their shift</p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={!form.assignedCleanerId || !form.title.trim() || createMut.isPending} data-testid="button-send-cleaner-request">
            <Send className="w-4 h-4 mr-2" />
            {createMut.isPending ? "Sending..." : "Send to Cleaner"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminRequests() {
  const [location] = useLocation();
  const [search_] = useSearch();
  const { toast } = useToast();

  const initParams = new URLSearchParams(search_);
  const initStatus = initParams.get("status") === "open" ? "open" : "all";

  const [view, setView] = useState<"incoming" | "assigned">("incoming");
  const [statusFilter, setStatusFilter] = useState<string>(initStatus);
  const [detailReq, setDetailReq] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [replyPhotos, setReplyPhotos] = useState<PhotoItem[]>([]);
  const [pendingStatus, setPendingStatus] = useState<string>("");
  const [urlLightbox, setUrlLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const [newCleanerOpen, setNewCleanerOpen] = useState(false);

  const { data: requests, isLoading } = useQuery<any[]>({ queryKey: ["/api/client-requests"] });
  const { data: clientsList } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: employeesList = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: locationsList = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });
  const { data: messages, isLoading: msgsLoading, isError: msgsError } = useQuery<any[]>({
    queryKey: ["/api/client-requests", detailReq?.id, "messages"],
    enabled: !!detailReq?.id,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const replyMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/client-requests/${detailReq.id}/messages`, data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests", detailReq?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      setReplyText("");
      setReplyPhotos([]);
      if (vars.statusChange) {
        setDetailReq((prev: any) => prev ? { ...prev, status: vars.statusChange } : prev);
        toast({ title: `Status changed to ${STATUS_LABELS[vars.statusChange] || vars.statusChange}` });
      } else {
        toast({ title: "Reply sent" });
      }
    },
    onError: (err: any) => toast({ title: "Unable to send reply", description: err.message, variant: "destructive" }),
  });

  const markAdminReadMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/client-requests/${id}/mark-admin-read`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] }),
  });

  const clientMap = new Map((clientsList || []).map(c => [c.id, c]));
  const empMap = new Map((employeesList as any[]).map(e => [e.id, e]));

  function getSubmitterName(req: any) {
    if (req.createdByRole === "employee" || (req.employeeId && req.createdByRole !== "admin")) {
      const emp = empMap.get(req.employeeId || req.createdByUserId);
      return emp ? `${emp.firstName} ${emp.lastName}` : "Employee";
    }
    if (req.clientId) {
      const cl = clientMap.get(req.clientId);
      return cl ? cl.name : "Client";
    }
    if (req.createdByRole === "admin") {
      const emp = empMap.get(req.employeeId);
      return emp ? `${emp.firstName} ${emp.lastName}` : "Cleaner";
    }
    return "Unknown";
  }

  const allIncoming = (requests || []).filter(r => r.createdByRole !== "admin");
  const allAssigned = (requests || []).filter(r => r.createdByRole === "admin");
  const unreadAssigned = allAssigned.filter(r => r.status === "replied" && !r.adminReadReplyAt).length;

  const filtered = (view === "assigned" ? allAssigned : allIncoming)
    .filter(r => statusFilter === "open" ? OPEN_STATUSES.has(r.status) : true)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const openDetail = (req: any) => {
    setDetailReq(req);
    setPendingStatus(req.status);
    setReplyText("");
    setReplyPhotos([]);
    if (req.createdByRole === "admin" && req.status === "replied" && !req.adminReadReplyAt) {
      markAdminReadMut.mutate(req.id);
    }
  };

  const sendReply = () => {
    const hasBody = !!replyText.trim();
    const hasPhotos = replyPhotos.length > 0;
    const hasStatusChange = pendingStatus !== detailReq?.status;
    if (!hasBody && !hasPhotos && !hasStatusChange) return;
    replyMut.mutate({
      body: replyText.trim() || null,
      photos: replyPhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption })),
      statusChange: hasStatusChange ? pendingStatus : undefined,
      isVisibleToClient: true,
      isVisibleToEmployee: true,
    });
  };

  const changeStatusOnly = (newStatus: string) => {
    replyMut.mutate({ body: null, photos: [], statusChange: newStatus, isVisibleToClient: true, isVisibleToEmployee: true });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {urlLightbox && (
        <UrlLightbox urls={urlLightbox.urls} startIndex={urlLightbox.idx} onClose={() => setUrlLightbox(null)} />
      )}

      {/* View toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
          <button
            onClick={() => setView("incoming")}
            data-testid="tab-requests-incoming"
            className={cn("px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors", view === "incoming" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            From Others
            {allIncoming.filter(r => OPEN_STATUSES.has(r.status)).length > 0 && (
              <span className="ml-1.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{allIncoming.filter(r => OPEN_STATUSES.has(r.status)).length}</span>
            )}
          </button>
          <button
            onClick={() => setView("assigned")}
            data-testid="tab-requests-assigned"
            className={cn("px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors relative", view === "assigned" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Sent to Cleaners
            {unreadAssigned > 0 && (
              <span className="ml-1.5 text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">{unreadAssigned}</span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-requests-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open / Active</SelectItem>
            </SelectContent>
          </Select>
          {view === "assigned" && (
            <Button size="sm" onClick={() => setNewCleanerOpen(true)} data-testid="button-new-cleaner-request">
              <Plus className="w-4 h-4 mr-1.5" />Assign to Cleaner
            </Button>
          )}
        </div>
      </div>

      {/* Assigned view info banner */}
      {view === "assigned" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <Users className="w-4 h-4 text-blue-600 shrink-0" />
          <span>These are requests you sent directly to cleaners. Cleaners see them in their Reports app.</span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            {view === "assigned" ? (
              <>
                <Users className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">No cleaner requests yet</p>
                <p className="text-muted-foreground text-xs mt-1">Assign a request to a cleaner to get started</p>
                <Button size="sm" className="mt-4" onClick={() => setNewCleanerOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />Assign to Cleaner
                </Button>
              </>
            ) : (
              <>
                <MessageSquare className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">{statusFilter === "open" ? "No open requests" : "No requests yet"}</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const isUnread = view === "assigned" && req.status === "replied" && !req.adminReadReplyAt;
            return (
              <Card
                key={req.id}
                className={cn("cursor-pointer hover:shadow-sm transition-shadow", isUnread && "ring-2 ring-primary/30 border-primary/30")}
                data-testid={`card-request-${req.id}`}
                onClick={() => openDetail(req)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {(req.priority === "urgent" || req.priority === "high") && (
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                        )}
                        {isUnread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        <p className="font-medium text-sm">{req.title}</p>
                        <Badge variant={(STATUS_VARIANT[req.status] as any) || "secondary"} className="text-xs">
                          {STATUS_LABELS[req.status] || req.status}
                        </Badge>
                        <Badge variant={(PRIORITY_VARIANT[req.priority] as any) || "secondary"} className="text-xs">{req.priority}</Badge>
                      </div>
                      {req.description && <p className="text-sm text-muted-foreground line-clamp-2">{req.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User2 className="w-3 h-3" />
                          {view === "assigned" ? `→ ${getSubmitterName(req)}` : `${getSubmitterName(req)} (${req.createdByRole || "client"})`}
                        </span>
                        <span>{req.requestType.replace(/_/g, " ")}</span>
                        <span><Clock className="w-3 h-3 inline mr-0.5" />{new Date(req.createdAt).toLocaleDateString()}</span>
                        {req.requiresReplyBeforeClockOut && (
                          <span className="text-amber-600 font-medium">Reply required</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New cleaner request dialog */}
      <NewCleanerRequestDialog
        open={newCleanerOpen}
        onClose={() => setNewCleanerOpen(false)}
        employees={employeesList as any[]}
        locations={locationsList as any[]}
      />

      {/* Detail dialog */}
      {detailReq && (
        <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
          <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-start justify-between gap-2 pr-6">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base leading-snug">{detailReq.title}</DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User2 className="w-3 h-3" />
                      {detailReq.createdByRole === "admin" ? `→ ${getSubmitterName(detailReq)}` : `${getSubmitterName(detailReq)} (${detailReq.createdByRole || "client"})`}
                    </span>
                    <span>{detailReq.requestType.replace(/_/g, " ")}</span>
                    <Badge variant={(PRIORITY_VARIANT[detailReq.priority] as any) || "secondary"} className="text-[10px] h-4 px-1">{detailReq.priority}</Badge>
                    <span><Clock className="w-3 h-3 inline mr-0.5" />{new Date(detailReq.createdAt).toLocaleDateString()}</span>
                    {detailReq.requiresReplyBeforeClockOut && (
                      <span className="text-amber-600 font-medium text-[10px]">Reply required before clock-out</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Tracking badges for admin-assigned */}
              {detailReq.createdByRole === "admin" && (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {detailReq.cleanerViewedAt && (
                    <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <Eye className="w-3 h-3" />Viewed {new Date(detailReq.cleanerViewedAt).toLocaleDateString()}
                    </span>
                  )}
                  {detailReq.status === "replied" && (
                    <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" />Cleaner replied
                    </span>
                  )}
                </div>
              )}
              {/* Status quick-change */}
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={pendingStatus} onValueChange={v => { setPendingStatus(v); changeStatusOnly(v); }}>
                  <SelectTrigger className="h-7 w-36 text-xs" data-testid="select-detail-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {detailReq.imageUrls?.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5"><Image className="w-3 h-3" />Photos ({detailReq.imageUrls.length})</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {detailReq.imageUrls.map((url: string, i: number) => (
                      <img key={url} src={url} alt={`photo ${i + 1}`} className="w-full h-20 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity border" onClick={() => setUrlLightbox({ urls: detailReq.imageUrls, idx: i })} data-testid={`img-req-photo-${i}`} />
                    ))}
                  </div>
                </div>
              )}
            </DialogHeader>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0 border-t">
              {msgsLoading ? (
                <div className="space-y-3 pt-2"><Skeleton className="h-14 w-3/4" /><Skeleton className="h-14 w-2/3 ml-auto" /></div>
              ) : msgsError ? (
                <p className="text-xs text-muted-foreground text-center py-8">Unable to load messages.</p>
              ) : !messages?.length ? (
                <p className="text-xs text-muted-foreground text-center py-8">No messages yet.</p>
              ) : (
                <div className="space-y-4 pt-2">
                  {messages.map((msg: any) => (
                    <ThreadMessage key={msg.id} msg={msg} clientName={getSubmitterName(detailReq)} />
                  ))}
                </div>
              )}
            </div>

            {/* Reply composer */}
            <div className="border-t pt-3 space-y-3">
              <Textarea
                placeholder={detailReq.createdByRole === "admin" ? "Add a follow-up or close this request..." : "Write a reply..."}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                data-testid="input-admin-reply"
              />
              <PhotoUploader photos={replyPhotos} onChange={setReplyPhotos} maxPhotos={3} maxSizeMB={10} label="Attach Photos" />
              <div className="flex items-center justify-end gap-2">
                <Button onClick={sendReply} disabled={(!replyText.trim() && replyPhotos.length === 0) || replyMut.isPending} data-testid="button-send-admin-reply">
                  <Send className="w-4 h-4 mr-2" />
                  {replyMut.isPending ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
