import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import {
  Plus, MessageSquare, ChevronRight, AlertTriangle, Clock,
  ShieldAlert, CheckCircle2, Info, ExternalLink, ChevronDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  new: "Pending", pending: "Pending", replied: "Replied",
  in_review: "In Review", in_progress: "In Progress",
  scheduled: "Scheduled", resolved: "Resolved", closed: "Closed",
};

const STATUS_VARIANT: Record<string, string> = {
  new: "secondary", pending: "secondary", replied: "default",
  in_review: "default", in_progress: "default",
  scheduled: "secondary", resolved: "secondary", closed: "outline",
};

const PRIORITY_VARIANT: Record<string, string> = {
  low: "secondary", normal: "secondary", high: "destructive", urgent: "destructive",
};

const QUICK_REPLIES = [
  "Work completed as requested.",
  "I checked and resolved the issue.",
  "I completed the re-clean and submitted the work report.",
  "I need a follow-up — more information required.",
  "Unable to complete — please advise.",
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Used in employee's own report dialog ──────────────────────────────────────
function ThreadMessage({ msg, authorName }: { msg: any; authorName: string }) {
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
            <p className="text-xs font-medium mb-1 opacity-70">{isAdmin ? "Admin" : authorName}</p>
            {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}
          </>
        )}
        {msg.attachments?.length > 0 && (
          <div className="grid grid-cols-2 gap-1 mt-2">
            {msg.attachments.map((att: any) => (
              <div key={att.id}>
                <img src={`/api/attachments/${att.id}/image`} alt={att.caption || "photo"} className="w-full h-24 object-cover rounded-md bg-muted" loading="lazy" />
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

// ── Conversation-style message for admin requests ──────────────────────────────
function ConversationMessage({ msg, authorName, onImageClick }: {
  msg: any; authorName: string; onImageClick: (src: string) => void;
}) {
  const isAdmin = msg.authorRole === "admin";

  if (msg.messageType === "status_change") {
    return (
      <div className="flex justify-center">
        <span className="text-[10px] text-muted-foreground bg-muted/80 rounded-full px-3 py-1 border">
          Status → {STATUS_LABELS[msg.statusValue] || msg.statusValue}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${isAdmin ? "items-start" : "items-end"} px-3`}>
      <div className={`max-w-[88%] overflow-hidden shadow-sm ${
        isAdmin
          ? "rounded-2xl rounded-tl-sm bg-primary text-primary-foreground"
          : "rounded-2xl rounded-tr-sm bg-muted/90 border text-foreground"
      }`}>
        {(msg.body || msg.attachments?.length > 0) && (
          <div className="px-3.5 pt-3 pb-2.5">
            <p className={`text-[10px] font-semibold mb-1.5 ${isAdmin ? "opacity-60" : "text-muted-foreground"}`}>
              {isAdmin ? "Admin" : authorName}
            </p>
            {msg.body && (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.body}</p>
            )}
          </div>
        )}
        {msg.attachments?.length > 0 && (
          <div className={`space-y-1.5 pb-2.5 px-2 ${!msg.body ? "pt-2.5" : "pt-0"}`}>
            {msg.attachments.map((att: any) => (
              <div
                key={att.id}
                className="cursor-pointer overflow-hidden rounded-xl"
                onClick={() => onImageClick(`/api/attachments/${att.id}/image`)}
              >
                <img
                  src={`/api/attachments/${att.id}/image`}
                  alt={att.caption || "photo"}
                  className="w-full max-h-64 object-cover"
                  loading="lazy"
                />
                {att.caption && (
                  <p className={`text-[10px] px-2 pt-1.5 pb-1 ${isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {att.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
    </div>
  );
}

// ── Admin Request Detail — conversation style ──────────────────────────────────
function AdminRequestDetail({ req, onClose }: { req: any; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [replyText, setReplyText] = useState("");
  const [replyPhotos, setReplyPhotos] = useState<PhotoItem[]>([]);
  const [guideOpen, setGuideOpen] = useState(!req.cleanerViewedAt);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const authorName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  const { data: messages, isLoading: msgsLoading } = useQuery<any[]>({
    queryKey: ["/api/client-requests", req.id, "messages"],
    enabled: !!req.id,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!req.cleanerViewedAt) {
      fetch(`/api/client-requests/${req.id}/mark-viewed`, { method: "POST", credentials: "include" })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
        })
        .catch(() => {});
    }
  }, [req.id]);

  const replyMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/client-requests/${req.id}/messages`, data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests", req.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests", user?.id] });
      setReplyText("");
      setReplyPhotos([]);
      toast({ title: "Reply sent to admin" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canReply = !["closed", "resolved"].includes(req.status);
  const hasReplied = req.status === "replied";

  const sendReply = () => {
    const body = replyText.trim();
    if (!body && replyPhotos.length === 0) return;
    replyMut.mutate({ body: body || null, photos: replyPhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption })) });
  };

  return (
    <>
      <Dialog open={!!req} onOpenChange={onClose}>
        <DialogContent className="max-w-lg p-0 gap-0 flex flex-col" style={{ maxHeight: "92vh" }}>

          {/* ── Header ── */}
          <div className="px-4 pt-4 pb-3 border-b shrink-0">
            <div className="flex items-start gap-2 pr-6">
              <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <h2 className="font-semibold text-sm leading-snug">{req.title}</h2>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Badge variant={(STATUS_VARIANT[req.status] as any) || "secondary"} className="text-xs">
                {STATUS_LABELS[req.status] || req.status}
              </Badge>
              <span className="text-xs text-muted-foreground">{req.requestType?.replace(/_/g, " ")}</span>
              <Badge variant={(PRIORITY_VARIANT[req.priority] as any) || "secondary"} className="text-[10px] h-4 px-1">{req.priority}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" />{new Date(req.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* ── Scrollable thread ── */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* Collapsible guidance */}
            {!hasReplied ? (
              <div className="mx-3 mt-3 rounded-xl border border-blue-200 bg-blue-50/90 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left gap-2"
                  onClick={() => setGuideOpen(v => !v)}
                  data-testid="button-toggle-action-guide"
                >
                  <span className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    {guideOpen ? "Action Required" : "Action Required — tap to view steps"}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-blue-500 shrink-0 transition-transform", guideOpen && "rotate-180")} />
                </button>
                {guideOpen && (
                  <div className="px-3 pb-3 border-t border-blue-200/60 space-y-2.5">
                    <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside pt-2.5">
                      <li>Read the instructions below carefully</li>
                      <li>Start your work or work submission from the home screen</li>
                      <li>Complete the requested task</li>
                      <li>Return here and send a reply{req.requiresReplyBeforeClockOut ? " before clocking out" : ""}</li>
                    </ol>
                    <Link href="/employee/work-log">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-blue-300 text-blue-700 hover:bg-blue-100 text-xs h-8"
                        onClick={onClose}
                        data-testid="button-start-work-from-request"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Start Work Submission
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-3 mt-3 rounded-xl bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium">Replied — admin has been notified.</p>
              </div>
            )}

            {/* Messages */}
            <div className="py-4 space-y-4">
              {msgsLoading ? (
                <div className="space-y-3 px-3 pt-1">
                  <Skeleton className="h-24 w-4/5" />
                  <Skeleton className="h-12 w-3/4 ml-auto" />
                </div>
              ) : !messages?.length ? (
                <p className="text-xs text-muted-foreground text-center py-4">No messages yet.</p>
              ) : (
                messages.map((msg: any) => (
                  <ConversationMessage key={msg.id} msg={msg} authorName={authorName} onImageClick={setLightbox} />
                ))
              )}
            </div>
          </div>

          {/* ── Sticky reply composer ── */}
          {canReply && (
            <div className="border-t bg-background px-3 pt-3 pb-4 space-y-2.5 shrink-0">
              {!hasReplied && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                  {QUICK_REPLIES.map((qr, i) => (
                    <button
                      key={i}
                      onClick={() => setReplyText(replyText === qr ? "" : qr)}
                      className={cn(
                        "text-[10px] px-2.5 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors",
                        replyText === qr
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground hover:text-foreground border-border"
                      )}
                      data-testid={`button-quick-reply-${i}`}
                    >
                      {qr.length > 28 ? qr.slice(0, 28) + "…" : qr}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                placeholder="Tell admin what was done..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                data-testid="input-admin-req-reply"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <PhotoUploader photos={replyPhotos} onChange={setReplyPhotos} maxPhotos={3} maxSizeMB={10} label="Attach Photos" />
                </div>
                <Button
                  size="sm"
                  className="shrink-0 h-9 px-5"
                  disabled={(!replyText.trim() && replyPhotos.length === 0) || replyMut.isPending}
                  onClick={sendReply}
                  data-testid="button-send-admin-req-reply"
                >
                  {replyMut.isPending ? "Sending…" : "Send Reply"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/92 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}

// ── Main Employee Requests Page ───────────────────────────────────────────────
export default function EmployeeRequests() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailReq, setDetailReq] = useState<any>(null);
  const [adminDetailReq, setAdminDetailReq] = useState<any>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", requestType: "issue_report", priority: "normal",
  });
  const [replyText, setReplyText] = useState("");
  const [replyPhotos, setReplyPhotos] = useState<PhotoItem[]>([]);

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/client-requests", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/client-requests", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: messages, isLoading: msgsLoading, isError: msgsError } = useQuery<any[]>({
    queryKey: ["/api/client-requests", detailReq?.id, "messages"],
    enabled: !!detailReq?.id,
    staleTime: 30 * 1000,
    retry: 1,
  });

  // Deep-link: auto-open a specific request via ?openId=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("openId");
    if (openId && requests) {
      const target = requests.find(r => r.id === openId);
      if (target) {
        setAdminDetailReq(target);
        window.history.replaceState({}, "", "/employee/requests");
      }
    }
  }, [requests]);

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/client-requests", data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      toast({ title: "Request submitted to admin" });
      setCreateOpen(false);
      setForm({ title: "", description: "", requestType: "issue_report", priority: "normal" });
      setPhotos([]);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const replyMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/client-requests/${detailReq.id}/messages`, data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests", detailReq?.id, "messages"] });
      setReplyText("");
      setReplyPhotos([]);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const allRequests = requests || [];
  const adminAssigned = allRequests
    .filter(r => r.createdByRole === "admin")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const myRequests = allRequests
    .filter(r => r.createdByRole !== "admin")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingAdminCount = adminAssigned.filter(r => !["closed", "resolved", "replied"].includes(r.status)).length;
  const authorName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  return (
    <div className="pb-24">
      {/* Section nav */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg w-fit">
          <Link href="/employee/reports">
            <button data-testid="nav-section-reports" className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${location.startsWith("/employee/reports") ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Reports
            </button>
          </Link>
          <Link href="/employee/requests">
            <button data-testid="nav-section-requests" className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors relative ${location === "/employee/requests" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Requests
              {pendingAdminCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-destructive rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5">
                  {pendingAdminCount}
                </span>
              )}
            </button>
          </Link>
        </div>
      </div>

      {/* Admin-assigned requests section */}
      {adminAssigned.length > 0 && (
        <div className="mt-4 px-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              From Admin
              {pendingAdminCount > 0 && (
                <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold">{pendingAdminCount} pending</span>
              )}
            </h2>
          </div>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-2">
              {adminAssigned.map((req: any) => {
                const isPending = !["closed", "resolved", "replied"].includes(req.status);
                const isReplied = req.status === "replied";
                return (
                  <Card
                    key={req.id}
                    className={cn(
                      "cursor-pointer transition-shadow",
                      isPending ? "border-destructive/40 bg-destructive/5 hover:shadow-md" : "hover:shadow-sm"
                    )}
                    data-testid={`admin-request-card-${req.id}`}
                    onClick={() => setAdminDetailReq(req)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isPending && !isReplied && (
                            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                          )}
                          {isReplied && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                          <p className="text-sm font-semibold truncate">{req.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant={(STATUS_VARIANT[req.status] as any) || "secondary"}
                            className={cn("text-xs", isPending && !isReplied && "bg-destructive/20 text-destructive border-destructive/30")}
                          >
                            {isPending && !isReplied ? "Action Required" : (STATUS_LABELS[req.status] || req.status)}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      {req.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{req.description}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge variant={(PRIORITY_VARIANT[req.priority] as any) || "secondary"} className="text-[10px] h-4 px-1">{req.priority}</Badge>
                        <span>{req.requestType?.replace(/_/g, " ")}</span>
                        <span>·</span>
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                        {req.requiresReplyBeforeClockOut && (
                          <span className="text-amber-600 font-medium">· Reply before clock-out</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* My reports section */}
      <div className="mt-5 px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Reports to Admin</h2>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} data-testid="button-new-emp-request">
            <Plus className="w-4 h-4 mr-1" />New
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : myRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <MessageSquare className="w-10 h-10 text-muted-foreground/20 mb-2" />
              <p className="text-muted-foreground text-sm font-medium">No reports yet</p>
              <p className="text-muted-foreground text-xs mt-1">Tap New to report an issue to admin</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {myRequests.map((req: any) => (
              <Card key={req.id} className="cursor-pointer hover:shadow-sm transition-shadow" data-testid={`emp-request-card-${req.id}`} onClick={() => setDetailReq(req)}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {(req.priority === "urgent" || req.priority === "high") && (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      )}
                      <p className="text-sm font-medium truncate">{req.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant={(STATUS_VARIANT[req.status] as any) || "secondary"} className="text-xs">
                        {STATUS_LABELS[req.status] || req.status}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  {req.description && <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{req.description}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{req.requestType?.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <Badge variant={(PRIORITY_VARIANT[req.priority] as any) || "secondary"} className="text-[10px] h-4 px-1">{req.priority}</Badge>
                    <span>·</span>
                    <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Admin request detail — conversation style */}
      {adminDetailReq && (
        <AdminRequestDetail req={adminDetailReq} onClose={() => setAdminDetailReq(null)} />
      )}

      {/* Create dialog for employee→admin reports */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Report to Admin</DialogTitle></DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            createMut.mutate({ ...form, photos: photos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption })) });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input data-testid="input-emp-req-title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="Brief description of the issue" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.requestType} onValueChange={v => setForm(p => ({ ...p, requestType: v }))}>
                <SelectTrigger data-testid="select-emp-req-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="issue_report">Issue Report</SelectItem>
                  <SelectItem value="damage_report">Damage Report</SelectItem>
                  <SelectItem value="supply_issue">Supply Issue</SelectItem>
                  <SelectItem value="emergency_issue">Emergency Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">🚨 Urgent / Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea data-testid="input-emp-req-description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe what you found or what happened..." />
            </div>
            <div className="space-y-2">
              <Label>Photos (optional, up to 5)</Label>
              <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={5} label="Add Evidence Photos" />
            </div>
            <Button type="submit" className="w-full" disabled={createMut.isPending} data-testid="button-submit-emp-request">
              {createMut.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* My report detail dialog */}
      {detailReq && (
        <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
          <DialogContent className="max-w-lg max-h-[92vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-start gap-2">
                {(detailReq.priority === "urgent" || detailReq.priority === "high") && (
                  <AlertTriangle className="w-4 h-4 text-destructive mt-1 flex-shrink-0" />
                )}
                <DialogTitle className="text-base leading-snug pr-6">{detailReq.title}</DialogTitle>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
                <Badge variant={(STATUS_VARIANT[detailReq.status] as any) || "secondary"} className="text-xs">
                  {STATUS_LABELS[detailReq.status] || detailReq.status}
                </Badge>
                <span>{detailReq.requestType?.replace(/_/g, " ")}</span>
                <Badge variant={(PRIORITY_VARIANT[detailReq.priority] as any) || "secondary"} className="text-[10px] h-4 px-1">{detailReq.priority}</Badge>
                <span><Clock className="w-3 h-3 inline mr-0.5" />{new Date(detailReq.createdAt).toLocaleDateString()}</span>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
              {msgsLoading ? (
                <div className="space-y-3 pt-1"><Skeleton className="h-12 w-3/4" /><Skeleton className="h-12 w-2/3 ml-auto" /></div>
              ) : msgsError ? (
                <p className="text-xs text-muted-foreground text-center py-6">Unable to load messages. Please close and try again.</p>
              ) : !messages?.length ? (
                <p className="text-xs text-muted-foreground text-center py-4">Report sent. Admin will reply soon.</p>
              ) : (
                messages.map((msg: any) => (
                  <ThreadMessage key={msg.id} msg={msg} authorName={authorName} />
                ))
              )}
            </div>
            {detailReq.status !== "closed" && (
              <div className="border-t pt-3 space-y-2">
                <Textarea placeholder="Add a follow-up comment..." value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} className="resize-none text-sm" data-testid="input-emp-reply" />
                <PhotoUploader photos={replyPhotos} onChange={setReplyPhotos} maxPhotos={3} maxSizeMB={10} label="Attach Photos" />
                <Button className="w-full" size="sm" disabled={(!replyText.trim() && replyPhotos.length === 0) || replyMut.isPending} onClick={() => replyMut.mutate({ body: replyText.trim(), photos: replyPhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption })) })} data-testid="button-send-emp-reply">
                  {replyMut.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
