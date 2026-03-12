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
import { Plus, MessageSquare, ChevronRight, Image, Clock, X, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function UrlLightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
      data-testid="lightbox-overlay"
    >
      <button
        className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-2 hover:bg-black/70"
        onClick={onClose}
        data-testid="button-lightbox-close"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="relative flex items-center justify-center w-full max-w-2xl px-12" onClick={e => e.stopPropagation()}>
        {urls.length > 1 && (
          <button
            className="absolute left-2 text-white bg-black/40 rounded-full p-2 hover:bg-black/70 disabled:opacity-30"
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            data-testid="button-lightbox-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <img
          src={urls[idx]}
          alt={`photo ${idx + 1}`}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-xl"
          data-testid="lightbox-image"
        />
        {urls.length > 1 && (
          <button
            className="absolute right-2 text-white bg-black/40 rounded-full p-2 hover:bg-black/70 disabled:opacity-30"
            onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))}
            disabled={idx === urls.length - 1}
            data-testid="button-lightbox-next"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      {urls.length > 1 && <p className="text-white/50 text-xs mt-2">{idx + 1} / {urls.length}</p>}
    </div>
  );
}

function AttachmentLightbox({ attachments, startIndex, onClose }: { attachments: any[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const att = attachments[idx];
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
      data-testid="lightbox-overlay"
    >
      <button
        className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-2 hover:bg-black/70"
        onClick={onClose}
        data-testid="button-lightbox-close"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="relative flex items-center justify-center w-full max-w-2xl px-12" onClick={e => e.stopPropagation()}>
        {attachments.length > 1 && (
          <button
            className="absolute left-2 text-white bg-black/40 rounded-full p-2 hover:bg-black/70 disabled:opacity-30"
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            data-testid="button-lightbox-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <img
          src={`/api/attachments/${att.id}/image`}
          alt={att.caption || "photo"}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-xl"
          data-testid="lightbox-image"
        />
        {attachments.length > 1 && (
          <button
            className="absolute right-2 text-white bg-black/40 rounded-full p-2 hover:bg-black/70 disabled:opacity-30"
            onClick={() => setIdx(i => Math.min(attachments.length - 1, i + 1))}
            disabled={idx === attachments.length - 1}
            data-testid="button-lightbox-next"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      {att.caption && <p className="text-white/70 text-sm mt-3">{att.caption}</p>}
      {attachments.length > 1 && <p className="text-white/50 text-xs mt-2">{idx + 1} / {attachments.length}</p>}
    </div>
  );
}

function ThreadMessage({ msg, authorName }: { msg: any; authorName: string }) {
  const isAdmin = msg.authorRole === "admin";
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  return (
    <>
      {lightboxIdx !== null && msg.attachments?.length > 0 && (
        <AttachmentLightbox
          attachments={msg.attachments}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
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
              <p className="text-xs font-medium mb-1 opacity-70">{isAdmin ? "Support Team" : authorName}</p>
              {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}
            </>
          )}
          {msg.attachments?.length > 0 && (
            <div className="grid grid-cols-2 gap-1 mt-2">
              {msg.attachments.map((att: any, i: number) => (
                <div key={att.id}>
                  <img
                    src={`/api/attachments/${att.id}/image`}
                    alt={att.caption || "photo"}
                    className="w-full h-24 object-cover rounded-md bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => setLightboxIdx(i)}
                    data-testid={`img-attachment-${att.id}`}
                  />
                  {att.caption && <p className="text-[10px] opacity-70 mt-0.5 text-center">{att.caption}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
      </div>
    </>
  );
}

export default function ClientRequests() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailReq, setDetailReq] = useState<any>(null);
  const [createPhotos, setCreatePhotos] = useState<PhotoItem[]>([]);
  const [form, setForm] = useState({ title: "", description: "", requestType: "service_request", priority: "normal" });
  const [replyText, setReplyText] = useState("");
  const [replyPhotos, setReplyPhotos] = useState<PhotoItem[]>([]);
  const [urlLightbox, setUrlLightbox] = useState<{ urls: string[]; idx: number } | null>(null);

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
      toast({ title: "Request submitted" });
      setCreateOpen(false);
      setForm({ title: "", description: "", requestType: "service_request", priority: "normal" });
      setCreatePhotos([]);
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
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      setReplyText("");
      setReplyPhotos([]);
      toast({ title: "Reply sent" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sorted = [...(requests || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const clientName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  return (
    <div className="p-4 pb-24 space-y-5">
      {urlLightbox && (
        <UrlLightbox
          urls={urlLightbox.urls}
          startIndex={urlLightbox.idx}
          onClose={() => setUrlLightbox(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-requests-title">Requests</h1>
          <p className="text-sm text-muted-foreground">Submit and track service requests</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-request">
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
            <p className="text-muted-foreground text-sm">No requests yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((req: any) => (
            <Card key={req.id} className="cursor-pointer hover:shadow-sm transition-shadow" data-testid={`request-card-${req.id}`} onClick={() => setDetailReq(req)}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium flex-1 min-w-0 truncate">{req.title}</p>
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
                  <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                  {req.imageUrls?.length > 0 && (
                    <span className="flex items-center gap-0.5"><Image className="w-3 h-3" />{req.imageUrls.length}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Request</DialogTitle></DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            createMut.mutate({ ...form, photos: createPhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption })) });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input data-testid="input-req-title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.requestType} onValueChange={v => setForm(p => ({ ...p, requestType: v }))}>
                <SelectTrigger data-testid="select-req-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_request">Service Request</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                  <SelectItem value="issue_report">Issue Report</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="special_task">Special Task</SelectItem>
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
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea data-testid="input-req-description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Image className="w-3.5 h-3.5" />Photos (optional · up to 10 · JPG/PNG · max 10 MB each)</Label>
              <PhotoUploader photos={createPhotos} onChange={setCreatePhotos} maxPhotos={10} maxSizeMB={10} label="Add Photos" />
            </div>
            <Button type="submit" className="w-full" disabled={createMut.isPending} data-testid="button-submit-request">
              {createMut.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail / thread dialog */}
      {detailReq && (
        <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
          <DialogContent className="max-w-lg max-h-[92vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="pr-6 text-base leading-snug">{detailReq.title}</DialogTitle>
                <Badge variant={(STATUS_VARIANT[detailReq.status] as any) || "secondary"} className="text-xs flex-shrink-0 mt-0.5">
                  {STATUS_LABELS[detailReq.status] || detailReq.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <span>{detailReq.requestType.replace(/_/g, " ")}</span>
                <span>·</span>
                <span className="capitalize">{detailReq.priority} priority</span>
                <span>·</span>
                <span><Clock className="w-3 h-3 inline mr-0.5" />{new Date(detailReq.createdAt).toLocaleDateString()}</span>
              </div>
              {detailReq.imageUrls?.length > 0 && (
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {detailReq.imageUrls.map((url: string, i: number) => (
                    <img
                      key={url}
                      src={url}
                      alt={`photo ${i + 1}`}
                      className="w-full h-20 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setUrlLightbox({ urls: detailReq.imageUrls, idx: i })}
                      data-testid={`img-req-photo-${i}`}
                    />
                  ))}
                </div>
              )}
            </DialogHeader>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
              {msgsLoading ? (
                <div className="space-y-3 pt-1">
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-12 w-2/3 ml-auto" />
                </div>
              ) : msgsError ? (
                <p className="text-xs text-muted-foreground text-center py-6">Unable to load conversation. Please close and try again.</p>
              ) : !messages?.length ? (
                <p className="text-xs text-muted-foreground text-center py-6">No messages yet. We'll reply soon!</p>
              ) : (
                messages.map((msg: any) => (
                  <ThreadMessage key={msg.id} msg={msg} authorName={clientName} />
                ))
              )}
            </div>

            {/* Reply composer — only if not closed */}
            {detailReq.status !== "closed" && (
              <div className="border-t pt-3 space-y-2">
                <Textarea
                  placeholder="Add a follow-up comment..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                  data-testid="input-client-reply"
                />
                <PhotoUploader photos={replyPhotos} onChange={setReplyPhotos} maxPhotos={3} maxSizeMB={10} label="Attach Photos" />
                <Button
                  className="w-full"
                  size="sm"
                  disabled={(!replyText.trim() && replyPhotos.length === 0) || replyMut.isPending}
                  onClick={() => replyMut.mutate({
                    body: replyText.trim(),
                    photos: replyPhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption })),
                  })}
                  data-testid="button-send-client-reply"
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
