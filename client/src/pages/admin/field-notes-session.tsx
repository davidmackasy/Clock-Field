import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, MapPin, Clock, Camera, Mic,
  Loader2, Edit3, X, Check, Images, FileText,
  Sparkles, NotebookPen, Share2, Copy, Link as LinkIcon,
  EyeOff, User, Printer, ChevronDown, ChevronUp,
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-500 border-gray-200",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit", inspection: "Inspection", pre_clean: "Pre-Clean",
  post_clean: "Post-Clean", damage_report: "Damage Report", maintenance: "Maintenance",
};

// ── Share Panel ───────────────────────────────────────────────────────────────
function SharePanel({ session, publicDoc, sessionId }: { session: any; publicDoc: any; sessionId: string }) {
  const { toast } = useToast();
  const [shareTitle, setShareTitle] = useState(publicDoc?.title || session.title || "");
  const [showTimestamps, setShowTimestamps] = useState(publicDoc?.showTimestamps ?? false);
  const [showInternalNotes, setShowInternalNotes] = useState(publicDoc?.showInternalNotes ?? false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    publicDoc?.isEnabled ? `${window.location.origin}/public/field-notes/${publicDoc.shareToken}` : null
  );

  const shareMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/share`, {
      title: shareTitle || null, showTimestamps, showInternalNotes,
    }).then(r => r.json()),
    onSuccess: (data) => {
      const url = `${window.location.origin}/public/field-notes/${data.rawToken || data.shareToken}`;
      setShareUrl(url);
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      toast({ title: "Public link generated" });
    },
    onError: () => toast({ title: "Failed to generate link", variant: "destructive" }),
  });

  const disableMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/field-notes/sessions/${sessionId}/share`).then(r => r.json()),
    onSuccess: () => {
      setShareUrl(null);
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      toast({ title: "Public link disabled" });
    },
    onError: () => toast({ title: "Failed to disable link", variant: "destructive" }),
  });

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied to clipboard" });
  };

  return (
    <div className="bg-muted/40 border rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Share Link</p>
      <div className="space-y-2.5">
        <div>
          <Label className="text-xs mb-1 block">Document Title (optional)</Label>
          <Input value={shareTitle} onChange={e => setShareTitle(e.target.value)} placeholder="Site Visit Report…" className="h-7 text-xs" data-testid="input-share-title" />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show timestamps</Label>
          <Switch data-testid="switch-share-timestamps" checked={showTimestamps} onCheckedChange={setShowTimestamps} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Include internal notes</Label>
          <Switch data-testid="switch-share-internal" checked={showInternalNotes} onCheckedChange={setShowInternalNotes} />
        </div>
      </div>
      {shareUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 bg-background rounded-lg border px-2.5 py-1.5">
            <LinkIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate flex-1">{shareUrl}</span>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-copy-share-link" size="sm" variant="outline" className="flex-1 gap-1.5 h-7 text-xs" onClick={copyLink}>
              <Copy className="w-3 h-3" /> Copy Link
            </Button>
            <Button data-testid="button-disable-share" size="sm" variant="ghost" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive" onClick={() => disableMutation.mutate()} disabled={disableMutation.isPending}>
              {disableMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />} Disable
            </Button>
            <Button data-testid="button-update-share" size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => shareMutation.mutate()} disabled={shareMutation.isPending}>
              {shareMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Update
            </Button>
          </div>
        </div>
      ) : (
        <Button data-testid="button-generate-share-link" size="sm" onClick={() => shareMutation.mutate()} disabled={shareMutation.isPending} className="w-full gap-1.5 h-7 text-xs">
          {shareMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />} Generate Public Link
        </Button>
      )}
    </div>
  );
}

// ── Document Observation Section ──────────────────────────────────────────────
function DocumentObservation({ entry, assets, sessionId, index, onPhotoClick }: {
  entry: any; assets: any[]; sessionId: string; index: number;
  onPhotoClick: (url: string, entry: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [form, setForm] = useState({ title: entry.title, body: entry.body, recommendedAction: entry.recommendedAction ?? "" });
  const { toast } = useToast();

  const linkedAssets: any[] = (() => {
    try {
      const ids: string[] = JSON.parse(entry.assetIds || "[]");
      return ids.map((id: string) => assets.find(a => a.id === id)).filter(Boolean);
    } catch {
      try {
        const idxs: number[] = JSON.parse(entry.photoIndexes || "[]");
        return idxs.map((i: number) => assets[i]).filter(Boolean);
      } catch { return []; }
    }
  })();

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/field-notes/entries/${entry.id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      setEditing(false);
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  return (
    <div className="group relative">
      {/* Section divider with number */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest whitespace-nowrap">
          Observation {index}
        </span>
        <div className="flex-1 h-px bg-border" />
        {/* Edit toggle */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {editing ? (
            <>
              <Button size="icon" variant="ghost" className="w-6 h-6" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(form)}>
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => { setEditing(false); setForm({ title: entry.title, body: entry.body, recommendedAction: entry.recommendedAction ?? "" }); }}>
                <X className="w-3 h-3" />
              </Button>
            </>
          ) : (
            <Button data-testid={`button-edit-entry-${entry.id}`} size="icon" variant="ghost" className="w-6 h-6" onClick={() => setEditing(true)}>
              <Edit3 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Observation metadata */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        {entry.areaName && (
          <span className="text-xs font-medium text-muted-foreground bg-muted rounded px-2 py-0.5">{entry.areaName}</span>
        )}
        {(entry.priority === "high" || entry.priority === "critical") && (
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", PRIORITY_BADGE[entry.priority])}>
            {entry.priority}
          </Badge>
        )}
        {entry.issueDetected && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">Issue</Badge>
        )}
        {(entry.tags ?? []).map((t: string) => (
          <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>
        ))}
      </div>

      {/* Title */}
      {editing ? (
        <Input data-testid="input-entry-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="text-base font-semibold mb-3 h-8" />
      ) : (
        <h3 className="text-base font-semibold text-foreground mb-3 leading-snug">{entry.title}</h3>
      )}

      {/* Photos — larger, embedded in context */}
      {linkedAssets.length > 0 && (
        <div className={cn(
          "mb-4 rounded-xl overflow-hidden",
          linkedAssets.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-1.5"
        )}>
          {linkedAssets.map((asset: any, i: number) => (
            <div
              key={asset.id}
              data-testid={`img-doc-photo-${asset.id}`}
              className="overflow-hidden rounded-lg cursor-pointer bg-muted hover:opacity-95 transition-opacity"
              onClick={() => onPhotoClick(asset.fileUrl, entry)}
            >
              <img
                src={asset.fileUrl}
                alt={`Photo ${i + 1}`}
                className={cn("w-full object-cover", linkedAssets.length === 1 ? "max-h-72" : "aspect-[4/3]")}
              />
            </div>
          ))}
        </div>
      )}

      {/* Body text */}
      {editing ? (
        <Textarea data-testid="textarea-entry-body" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} className="text-sm mb-3" />
      ) : (
        <p className="text-sm text-foreground/80 leading-relaxed mb-3">{entry.body}</p>
      )}

      {/* Spoken note — collapsible */}
      {entry.relatedTranscript && (
        <button
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2.5 w-full text-left"
          onClick={() => setShowTranscript(v => !v)}
        >
          <Mic className="w-3 h-3 shrink-0" />
          <span className="font-medium">Spoken note</span>
          {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
      {showTranscript && entry.relatedTranscript && (
        <blockquote className="text-xs italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-3 mb-3 leading-relaxed">
          "{entry.relatedTranscript}"
        </blockquote>
      )}

      {/* Recommended action */}
      {editing ? (
        <Input data-testid="input-entry-action" value={form.recommendedAction} onChange={e => setForm(f => ({ ...f, recommendedAction: e.target.value }))} placeholder="Recommended action…" className="text-sm h-7" />
      ) : entry.recommendedAction ? (
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg px-3 py-2.5 text-xs text-blue-700 dark:text-blue-300">
          <span className="font-semibold shrink-0 mt-0.5">→ Follow-up:</span>
          <span className="leading-relaxed">{entry.recommendedAction}</span>
        </div>
      ) : null}
    </div>
  );
}

// ── Transcript view ────────────────────────────────────────────────────────────
function TranscriptView({ chunks, assets }: { chunks: any[]; assets: any[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  type Event = { ms: number; type: "chunk" | "photo"; data: any };
  const events: Event[] = [
    ...chunks.map(c => ({ ms: c.startedAt ? new Date(c.startedAt).getTime() : 0, type: "chunk" as const, data: c })),
    ...assets.map(a => ({ ms: a.capturedAt ? new Date(a.capturedAt).getTime() : 0, type: "photo" as const, data: a })),
  ].sort((a, b) => a.ms - b.ms);
  const sessionStart = events[0]?.ms ?? 0;
  const fmtElapsed = (ms: number) => {
    const diff = Math.max(0, ms - sessionStart);
    const s = Math.floor(diff / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  if (events.length === 0) return (
    <div className="text-center py-16 text-muted-foreground">
      <Mic className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No voice recording</p>
      <p className="text-xs mt-1">Voice notes appear here when recorded during a session.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5 pb-4 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Transcript Record</p>
        <p className="text-xs text-muted-foreground">
          Raw voice-to-text transcript with photos shown in capture sequence.
          Times shown are relative to session start.
        </p>
      </div>
      <div className="space-y-2">
        {events.map((ev, i) => ev.type === "photo" ? (
          <div key={i} className="flex items-center gap-3 py-1">
            <code className="text-[10px] text-muted-foreground font-mono w-10 shrink-0">{fmtElapsed(ev.ms)}</code>
            <div
              className="flex items-center gap-2.5 bg-muted/60 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted transition-colors flex-1"
              onClick={() => setLightbox(ev.data.fileUrl)}
            >
              <Camera className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <img src={ev.data.fileUrl} alt="" className="w-9 h-9 rounded object-cover border" />
              <div>
                <p className="text-xs font-medium">Photo {assets.indexOf(ev.data) + 1}</p>
                {ev.data.capturedAt && (
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(ev.data.capturedAt), "h:mm:ss a")}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div key={i} className="flex gap-3">
            <code className="text-[10px] text-muted-foreground font-mono w-10 pt-2.5 shrink-0">{fmtElapsed(ev.ms)}</code>
            <div className="flex-1 bg-background border rounded-lg px-3.5 py-2.5">
              <p className="text-sm text-foreground/80 leading-relaxed">{ev.data.rawText}</p>
            </div>
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-full max-h-full rounded-lg" alt="" />
          <button className="absolute top-4 right-4 text-white/80 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminFieldNotesSession() {
  const [location, navigate] = useLocation();
  const [, adminParams] = useRoute("/admin/field-notes/session/:id");
  const [, employeeParams] = useRoute("/employee/field-notes/session/:id");
  const sessionId = adminParams?.id ?? employeeParams?.id;
  const backPath = location.startsWith("/employee") ? "/employee/field-notes" : "/admin/field-notes";
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; entry?: any } | null>(null);
  const [showShare, setShowShare] = useState(false);

  const { data: session, isLoading } = useQuery<any>({
    queryKey: ["/api/field-notes/sessions", sessionId],
    queryFn: () => apiRequest("GET", `/api/field-notes/sessions/${sessionId}`).then(r => r.json()),
    enabled: !!sessionId,
    refetchInterval: (data: any) => (data?.status === "processing" || data?.status === "uploading") ? 3000 : false,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/field-notes/sessions/${sessionId}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] }); setEditingTitle(false); },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const processMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/process`).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] }); toast({ title: "AI processing started…" }); },
    onError: () => toast({ title: "Failed to start AI", variant: "destructive" }),
  });

  if (isLoading || !session) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  const duration = session.endedAt ? differenceInMinutes(parseISO(session.endedAt), parseISO(session.startedAt)) : null;
  const entries: any[] = session.entries ?? [];
  const assets: any[] = session.assets ?? [];
  const chunks: any[] = session.transcriptChunks ?? [];
  const isProcessing = session.status === "processing" || session.status === "uploading";
  const isReady = session.status === "ready";
  const canShare = isReady && (entries.length > 0 || assets.length > 0);

  const recommendedActions = entries
    .map(e => e.recommendedAction)
    .filter((a): a is string => !!a && a.trim().length > 0);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="border-b bg-background px-4 md:px-6 pt-3 pb-3 print:hidden">
        <button data-testid="button-back-session"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs mb-2"
          onClick={() => navigate(backPath)}>
          <ChevronLeft className="w-3.5 h-3.5" /> Field Notes
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                <Input data-testid="input-session-title-edit" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-7 text-sm font-semibold" autoFocus />
                <Button size="icon" variant="ghost" className="w-7 h-7 shrink-0" onClick={() => updateMutation.mutate({ title: editTitle })}><Check className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" className="w-7 h-7 shrink-0" onClick={() => setEditingTitle(false)}><X className="w-3.5 h-3.5" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-semibold truncate">{session.title || SESSION_TYPE_LABELS[session.sessionType] || session.sessionType}</h1>
                <button data-testid="button-edit-title" className="text-muted-foreground hover:text-foreground shrink-0" onClick={() => { setEditTitle(session.title ?? ""); setEditingTitle(true); }}>
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
              {session.locationName && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{session.locationName}</span>}
              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{format(parseISO(session.startedAt), "MMM d h:mm a")}{duration !== null ? ` · ${duration}m` : ""}</span>
              {session.createdByName && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{session.createdByName}</span>}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {isProcessing && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                {session.status}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {canShare && (
              <Button data-testid="button-print-doc" size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => window.print()}>
                <Printer className="w-3 h-3" /> Print
              </Button>
            )}
            {canShare && (
              <Button data-testid="button-share-doc" size="sm" variant={showShare ? "default" : "outline"} className="gap-1 text-xs h-7" onClick={() => setShowShare(s => !s)}>
                <Share2 className="w-3 h-3" /> Share
              </Button>
            )}
            {(session.aiStatus === "failed" || (isReady && entries.length === 0)) && (
              <Button data-testid="button-retry-ai" size="sm" variant="outline" onClick={() => processMutation.mutate()} disabled={processMutation.isPending} className="gap-1 text-xs h-7">
                {processMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Process AI
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Share panel */}
      {showShare && canShare && (
        <div className="border-b px-4 md:px-6 py-3 print:hidden">
          <SharePanel session={session} publicDoc={session.publicDoc} sessionId={sessionId!} />
        </div>
      )}

      {isProcessing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 px-4 py-2 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 print:hidden">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          AI is analyzing your recording… usually 15–30 seconds.
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="document" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 md:mx-6 mt-2 self-start h-8 print:hidden">
            <TabsTrigger data-testid="tab-document" value="document" className="text-xs px-3">
              <NotebookPen className="w-3 h-3 mr-1" />Document {entries.length > 0 ? `(${entries.length})` : ""}
            </TabsTrigger>
            <TabsTrigger data-testid="tab-photos" value="photos" className="text-xs px-3">
              <Images className="w-3 h-3 mr-1" />Photos {assets.length > 0 ? `(${assets.length})` : ""}
            </TabsTrigger>
            <TabsTrigger data-testid="tab-transcript" value="transcript" className="text-xs px-3">
              <FileText className="w-3 h-3 mr-1" />Transcript
            </TabsTrigger>
          </TabsList>

          {/* ── DOCUMENT TAB ── */}
          <TabsContent value="document" className="flex-1 overflow-y-auto mt-0">
            {entries.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground px-4">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">{isProcessing ? "Generating document…" : "No notes yet"}</p>
                {!isProcessing && (
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    {assets.length > 0 || chunks.length > 0
                      ? "Click 'Process AI' to generate structured documentation"
                      : "Start a recording session with photos or voice to generate notes"}
                  </p>
                )}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-0">

                {/* Document intro */}
                {session.aiSummary && (
                  <div className="mb-8">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Introduction</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{session.aiSummary}</p>
                    <div className="h-px bg-border mt-6" />
                  </div>
                )}

                {/* Observations */}
                <div className="space-y-10">
                  {entries.map((entry: any, i: number) => (
                    <DocumentObservation
                      key={entry.id}
                      entry={entry}
                      assets={assets}
                      sessionId={sessionId!}
                      index={i + 1}
                      onPhotoClick={(url, e) => setLightboxPhoto({ url, entry: e })}
                    />
                  ))}
                </div>

                {/* Recommendations summary */}
                {recommendedActions.length > 0 && (
                  <div className="mt-10 pt-6 border-t">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Recommended Follow-Up</p>
                    <ul className="space-y-2">
                      {recommendedActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                          <span className="text-muted-foreground font-medium shrink-0 mt-0.5">{i + 1}.</span>
                          <span className="leading-relaxed">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Closing */}
                <div className="mt-8 pt-5 border-t">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This field note is intended to support follow-up planning, internal review, and client communication
                    regarding the areas documented during this visit.
                  </p>
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t text-[10px] text-muted-foreground/60">
                    <NotebookPen className="w-3 h-3" />
                    <span>Field Note · {format(parseISO(session.startedAt), "MMMM d, yyyy")}</span>
                    {session.createdByName && <span>· Prepared by {session.createdByName}</span>}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── PHOTOS TAB ── */}
          <TabsContent value="photos" className="flex-1 overflow-y-auto px-4 md:px-6 py-4 mt-0">
            {assets.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">No photos captured</p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                  Site Photos ({assets.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {assets.map((asset: any, i: number) => {
                    const linkedEntry = entries.find(e => {
                      try { const ids = JSON.parse(e.assetIds || "[]"); return ids.includes(asset.id); } catch { return false; }
                    });
                    return (
                      <div
                        key={asset.id}
                        data-testid={`img-photo-${asset.id}`}
                        className="rounded-xl overflow-hidden bg-muted border cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setLightboxPhoto({ url: asset.fileUrl, entry: linkedEntry })}
                      >
                        <img src={asset.fileUrl} alt={`Photo ${i + 1}`} className="w-full aspect-square object-cover" />
                        <div className="p-2 space-y-0.5">
                          {linkedEntry && (
                            <p className="text-[11px] font-medium truncate">{linkedEntry.areaName || linkedEntry.title}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            Photo {i + 1}{asset.capturedAt ? ` · ${format(parseISO(asset.capturedAt), "h:mm:ss a")}` : ""}
                          </p>
                          {linkedEntry?.relatedTranscript && (
                            <p className="text-[10px] text-muted-foreground italic truncate">"{linkedEntry.relatedTranscript}"</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── TRANSCRIPT TAB ── */}
          <TabsContent value="transcript" className="flex-1 overflow-y-auto px-4 md:px-6 py-4 mt-0">
            <TranscriptView chunks={chunks} assets={assets} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={() => setLightboxPhoto(null)}>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={lightboxPhoto.url} className="max-w-full max-h-full rounded-lg" alt="Full size" />
          </div>
          {lightboxPhoto.entry && (
            <div className="bg-black/80 px-4 py-3 flex-none" onClick={e => e.stopPropagation()}>
              <p className="text-white font-semibold text-sm">{lightboxPhoto.entry.title}</p>
              {lightboxPhoto.entry.relatedTranscript && (
                <p className="text-white/60 text-xs mt-0.5 italic">"{lightboxPhoto.entry.relatedTranscript}"</p>
              )}
              {lightboxPhoto.entry.body && <p className="text-white/80 text-xs mt-1">{lightboxPhoto.entry.body}</p>}
            </div>
          )}
          <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white" onClick={() => setLightboxPhoto(null)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
