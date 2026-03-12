import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import { MessageSquare, X, AlertTriangle, User2, ChevronRight, Clock, Send } from "lucide-react";

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ThreadMessage({ msg, clientName }: { msg: any; clientName: string }) {
  const isAdmin = msg.authorRole === "admin";
  const isStatus = msg.messageType === "status_change";

  if (isStatus) {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
          Status → <span className="font-semibold">{STATUS_LABELS[msg.statusValue] || msg.statusValue}</span>
          <span className="ml-2 opacity-60">{formatTime(msg.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${isAdmin ? "items-end" : "items-start"}`}>
      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
        isAdmin ? "bg-primary text-primary-foreground" : "bg-card border border-border"
      }`}>
        <p className="text-xs font-medium mb-1 opacity-70">
          {isAdmin ? "You (Admin)" : `${clientName} (${msg.authorRole})`}
        </p>
        {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}
        {msg.attachments?.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {msg.attachments.map((att: any) => (
              <div key={att.id}>
                <img src={att.fileUrl} alt={att.caption || "photo"} className="w-full h-28 object-cover rounded-md cursor-pointer" onClick={() => window.open(att.fileUrl)} />
                {att.caption && <p className="text-[10px] opacity-70 mt-0.5 text-center">{att.caption}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
    </div>
  );
}

export default function AdminRequests() {
  const { toast } = useToast();
  const search_ = useSearch();
  const initParams = new URLSearchParams(search_);
  const initStatus = initParams.get("status") === "open" ? "open" : "all";

  const [statusFilter, setStatusFilter] = useState<string>(initStatus);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [detailReq, setDetailReq] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [replyPhotos, setReplyPhotos] = useState<PhotoItem[]>([]);
  const [pendingStatus, setPendingStatus] = useState<string>("");

  const { data: requests, isLoading } = useQuery<any[]>({ queryKey: ["/api/client-requests"] });
  const { data: clientsList } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: employeesList } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: messages, isLoading: msgsLoading } = useQuery<any[]>({
    queryKey: ["/api/client-requests", detailReq?.id, "messages"],
    enabled: !!detailReq,
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
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/client-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      toast({ title: "Status updated" });
    },
  });

  const clientMap = new Map((clientsList || []).map(c => [c.id, c]));
  const empMap = new Map((employeesList || []).map(e => [e.id, e]));

  function getSubmitterName(req: any) {
    if (req.createdByRole === "employee" || req.employeeId) {
      const emp = empMap.get(req.employeeId || req.createdByUserId);
      return emp ? `${emp.firstName} ${emp.lastName}` : "Employee";
    }
    if (req.clientId) {
      const cl = clientMap.get(req.clientId);
      return cl ? cl.name : "Client";
    }
    return "Admin";
  }

  const filtered = [...(requests || [])]
    .filter(r => {
      if (statusFilter === "open") return OPEN_STATUSES.has(r.status);
      return true;
    })
    .filter(r => {
      if (roleFilter === "client") return r.createdByRole === "client" || (!r.createdByRole && r.clientId);
      if (roleFilter === "employee") return r.createdByRole === "employee" || r.employeeId;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const openDetail = (req: any) => {
    setDetailReq(req);
    setPendingStatus(req.status);
    setReplyText("");
    setReplyPhotos([]);
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
    replyMut.mutate({
      body: null,
      photos: [],
      statusChange: newStatus,
      isVisibleToClient: true,
      isVisibleToEmployee: true,
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-requests-title">Client Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} of {requests?.length || 0} requests</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="select-requests-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open / Active</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36" data-testid="select-requests-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="client">Client Only</SelectItem>
              <SelectItem value="employee">Employee Only</SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter !== "all" || roleFilter !== "all") && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setStatusFilter("all"); setRoleFilter("all"); }} data-testid="button-clear-requests-filter">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">
              {statusFilter === "open" ? "No open requests" : "No requests yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => (
            <Card key={req.id} className="cursor-pointer hover:shadow-sm transition-shadow" data-testid={`card-request-${req.id}`} onClick={() => openDetail(req)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {(req.priority === "urgent" || req.priority === "high") && (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      )}
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
                        {getSubmitterName(req)} ({req.createdByRole || "client"})
                      </span>
                      <span>{req.requestType.replace(/_/g, " ")}</span>
                      <span><Clock className="w-3 h-3 inline mr-0.5" />{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      {detailReq && (
        <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
          <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-start justify-between gap-2 pr-6">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base leading-snug">{detailReq.title}</DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User2 className="w-3 h-3" />{getSubmitterName(detailReq)} ({detailReq.createdByRole || "client"})</span>
                    <span>{detailReq.requestType.replace(/_/g, " ")}</span>
                    <Badge variant={(PRIORITY_VARIANT[detailReq.priority] as any) || "secondary"} className="text-[10px] h-4 px-1">{detailReq.priority}</Badge>
                    <span><Clock className="w-3 h-3 inline mr-0.5" />{new Date(detailReq.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              {/* Status quick-change */}
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={pendingStatus} onValueChange={v => { setPendingStatus(v); changeStatusOnly(v); }}>
                  <SelectTrigger className="h-7 w-36 text-xs" data-testid="select-detail-status">
                    <SelectValue />
                  </SelectTrigger>
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
            </DialogHeader>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0 border-t">
              {msgsLoading ? (
                <div className="space-y-3 pt-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : !messages?.length ? (
                <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Send a reply below.</p>
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
                placeholder="Write a reply..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={3}
                className="resize-none text-sm"
                data-testid="input-admin-reply"
              />
              <PhotoUploader photos={replyPhotos} onChange={setReplyPhotos} maxPhotos={10} label="Attach Photos" />
              <div className="flex items-center justify-end gap-2">
                <Button
                  onClick={sendReply}
                  disabled={(!replyText.trim() && replyPhotos.length === 0) || replyMut.isPending}
                  data-testid="button-send-admin-reply"
                >
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
