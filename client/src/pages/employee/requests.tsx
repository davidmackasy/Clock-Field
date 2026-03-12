import { useState } from "react";
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
import { Plus, MessageSquare, ChevronRight, AlertTriangle, Clock } from "lucide-react";

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

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
          <p className="text-xs text-muted-foreground italic">
            Status changed to <span className="font-semibold">{STATUS_LABELS[msg.statusValue] || msg.statusValue}</span>
          </p>
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
                <img
                  src={`/api/attachments/${att.id}/image`}
                  alt={att.caption || "photo"}
                  className="w-full h-24 object-cover rounded-md bg-muted"
                  loading="lazy"
                />
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

export default function EmployeeRequests() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailReq, setDetailReq] = useState<any>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", requestType: "issue_report", priority: "normal",
  });
  const [replyText, setReplyText] = useState("");
  const [replyPhotos, setReplyPhotos] = useState<PhotoItem[]>([]);

  const { data: requests, isLoading } = useQuery<any[]>({ queryKey: ["/api/client-requests"] });
  const { data: messages, isLoading: msgsLoading, isError: msgsError } = useQuery<any[]>({
    queryKey: ["/api/client-requests", detailReq?.id, "messages"],
    enabled: !!detailReq?.id,
    staleTime: 30 * 1000,
    retry: 1,
  });

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

  const sorted = [...(requests || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const authorName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  return (
    <div className="p-4 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-emp-requests-title">My Reports</h1>
          <p className="text-sm text-muted-foreground">Submit operational issues to admin</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-emp-request">
          <Plus className="w-4 h-4 mr-1" />New
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm font-medium">No reports yet</p>
            <p className="text-muted-foreground text-xs mt-1">Tap New to report an issue to admin</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((req: any) => (
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
                  <span>{req.requestType.replace(/_/g, " ")}</span>
                  <span>·</span>
                  <Badge variant={(PRIORITY_VARIANT[req.priority] as any) || "secondary"} className="text-[10px] h-4 px-1">
                    {req.priority}
                  </Badge>
                  <span>·</span>
                  <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
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
              <Textarea
                data-testid="input-emp-req-description"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Describe what you found or what happened..."
              />
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

      {/* Detail / thread dialog */}
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
                <span>{detailReq.requestType.replace(/_/g, " ")}</span>
                <Badge variant={(PRIORITY_VARIANT[detailReq.priority] as any) || "secondary"} className="text-[10px] h-4 px-1">{detailReq.priority}</Badge>
                <span><Clock className="w-3 h-3 inline mr-0.5" />{new Date(detailReq.createdAt).toLocaleDateString()}</span>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
              {msgsLoading ? (
                <div className="space-y-3 pt-1">
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-12 w-2/3 ml-auto" />
                </div>
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
                <Textarea
                  placeholder="Add a follow-up comment..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                  data-testid="input-emp-reply"
                />
                <PhotoUploader photos={replyPhotos} onChange={setReplyPhotos} maxPhotos={5} maxSizeMB={10} label="Attach Photos" />
                <Button
                  className="w-full"
                  size="sm"
                  disabled={(!replyText.trim() && replyPhotos.length === 0) || replyMut.isPending}
                  onClick={() => replyMut.mutate({
                    body: replyText.trim(),
                    photos: replyPhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption })),
                  })}
                  data-testid="button-send-emp-reply"
                >
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
