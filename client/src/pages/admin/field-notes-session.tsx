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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, MapPin, User, Clock, Camera, Mic,
  Loader2, Edit3, X, Check, Images, FileText,
  Sparkles, ChevronDown, ChevronUp, AlertTriangle, NotebookPen, RefreshCw
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
  high: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20",
  normal: "border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/10",
  low: "border-l-gray-300 bg-gray-50/50 dark:bg-gray-900/20",
};

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

const ENTRY_ICON: Record<string, string> = {
  issue: "⚠️", damage: "🚨", risk: "⚡", observation: "👁️", cleaning_scope: "🧹",
  before_condition: "📸", after_condition: "✅", supply_note: "📦", general_note: "📝",
};

// ── Document Entry Card ────────────────────────────────────────────────────────
function DocumentCard({ entry, assets, sessionId, onPhotoClick }: {
  entry: any; assets: any[]; sessionId: string;
  onPhotoClick: (url: string, entry: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(true);
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] }); setEditing(false); toast({ title: "Updated" }); },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  return (
    <div className={cn("rounded-xl border-l-4 border border-l-current bg-card overflow-hidden", PRIORITY_COLORS[entry.priority] ?? PRIORITY_COLORS.normal)}>
      {/* Photo row */}
      {linkedAssets.length > 0 && (
        <div className="flex gap-2 p-3 pb-0 overflow-x-auto">
          {linkedAssets.map((asset: any, i: number) => (
            <div
              key={asset.id}
              data-testid={`img-doc-photo-${asset.id}`}
              className="flex-shrink-0 w-32 h-24 sm:w-40 sm:h-28 rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onPhotoClick(asset.fileUrl, entry)}
            >
              <img src={asset.fileUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base">{ENTRY_ICON[entry.entryType] ?? "📝"}</span>
              {editing ? (
                <Input data-testid="input-entry-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-6 text-sm font-semibold flex-1" />
              ) : (
                <span className="font-semibold text-sm">{entry.title}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {entry.areaName && <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 font-medium">{entry.areaName}</span>}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_BADGE[entry.priority] ?? ""}`}>{entry.priority}</Badge>
              {entry.issueDetected && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">Issue</Badge>}
              {(entry.tags ?? []).map((t: string) => (
                <span key={t} className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5">#{t}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-0.5 flex-shrink-0">
            {editing ? (
              <>
                <Button size="icon" variant="ghost" className="w-7 h-7" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(form)}>
                  {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
              </>
            ) : (
              <>
                <Button data-testid={`button-edit-entry-${entry.id}`} size="icon" variant="ghost" className="w-7 h-7" onClick={() => setEditing(true)}><Edit3 className="w-3.5 h-3.5" /></Button>
                <button className="text-muted-foreground hover:text-foreground w-7 h-7 flex items-center justify-center" onClick={() => setExpanded(e => !e)}>
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Related transcript */}
        {expanded && entry.relatedTranscript && (
          <div className="bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2 border-l-2 border-muted-foreground/30">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Spoken Note</p>
            <p className="text-xs text-muted-foreground italic">"{entry.relatedTranscript}"</p>
          </div>
        )}

        {/* AI note body */}
        {expanded && (
          editing ? (
            <Textarea data-testid="textarea-entry-body" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} className="text-sm" />
          ) : (
            <p className="text-sm text-foreground/80 leading-relaxed">{entry.body}</p>
          )
        )}

        {/* Recommended action */}
        {expanded && (editing ? (
          <Input data-testid="input-entry-action" value={form.recommendedAction} onChange={e => setForm(f => ({ ...f, recommendedAction: e.target.value }))} placeholder="Recommended action…" className="text-sm h-7" />
        ) : entry.recommendedAction ? (
          <div className="flex items-start gap-1.5 bg-blue-50 dark:bg-blue-950/20 rounded px-2.5 py-1.5 text-xs text-blue-700 dark:text-blue-300">
            <span className="font-semibold shrink-0">Action:</span>
            <span>{entry.recommendedAction}</span>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

// ── Transcript with photo markers ──────────────────────────────────────────────
function TranscriptWithMarkers({ chunks, assets }: { chunks: any[]; assets: any[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Build a timeline of events sorted by timestamp
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
    </div>
  );

  return (
    <div className="space-y-3">
      {events.map((ev, i) =>
        ev.type === "photo" ? (
          <div key={i} className="flex items-center gap-3 py-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono w-10">{fmtElapsed(ev.ms)}</div>
            <div
              className="flex items-center gap-2 bg-muted/60 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => setLightbox(ev.data.fileUrl)}
            >
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              <img src={ev.data.fileUrl} alt="" className="w-8 h-8 rounded object-cover" />
              <span className="text-xs text-muted-foreground">Photo {assets.indexOf(ev.data) + 1} captured</span>
            </div>
          </div>
        ) : (
          <div key={i} className="flex gap-3">
            <div className="text-[10px] text-muted-foreground font-mono w-10 pt-1 flex-shrink-0">{fmtElapsed(ev.ms)}</div>
            <p className="text-sm text-muted-foreground leading-relaxed flex-1 bg-muted/30 rounded-lg px-3 py-2">{ev.data.rawText}</p>
          </div>
        )
      )}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-full max-h-full rounded-lg" alt="" />
          <button className="absolute top-4 right-4 text-white/80"><X className="w-6 h-6" /></button>
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

  const defaultTab = isReady && entries.length > 0 ? "document" : isProcessing ? "photos" : "document";

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="border-b bg-background px-4 md:px-6 pt-3 pb-3">
        <button
          data-testid="button-back-session"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs mb-2"
          onClick={() => navigate(backPath)}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Field Notes
        </button>

        {/* Title row */}
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
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {isProcessing && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                {session.status}
              </Badge>
            </div>
          </div>
          {(session.aiStatus === "failed" || (isReady && entries.length === 0)) && (
            <Button data-testid="button-retry-ai" size="sm" variant="outline" onClick={() => processMutation.mutate()} disabled={processMutation.isPending} className="gap-1 text-xs h-7 shrink-0">
              {processMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Process AI
            </Button>
          )}
        </div>
      </div>

      {/* Processing banner */}
      {isProcessing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 px-4 py-2 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          AI is analyzing your recording… usually 15–30 seconds.
        </div>
      )}

      {/* AI Summary strip */}
      {session.aiSummary && isReady && (
        <div className="bg-muted/50 border-b px-4 py-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Summary</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{session.aiSummary}</p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 md:mx-6 mt-2 self-start h-8">
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

          {/* Document tab */}
          <TabsContent value="document" className="flex-1 overflow-y-auto px-4 md:px-6 py-3 space-y-3 mt-0">
            {entries.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">
                  {isProcessing ? "Generating document…" : "No notes yet"}
                </p>
                {!isProcessing && (
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    {assets.length > 0 || chunks.length > 0
                      ? "Click 'Process AI' to generate structured documentation"
                      : "Start a recording session with photos or voice to generate notes"}
                  </p>
                )}
              </div>
            ) : (
              entries.map((entry: any) => (
                <DocumentCard
                  key={entry.id}
                  entry={entry}
                  assets={assets}
                  sessionId={sessionId!}
                  onPhotoClick={(url, e) => setLightboxPhoto({ url, entry: e })}
                />
              ))
            )}
          </TabsContent>

          {/* Photos tab */}
          <TabsContent value="photos" className="flex-1 overflow-y-auto px-4 md:px-6 py-3 mt-0">
            {assets.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">No photos captured</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                      {linkedEntry && (
                        <div className="p-2 border-t">
                          <p className="text-[11px] font-medium truncate">{linkedEntry.areaName || linkedEntry.title}</p>
                          {linkedEntry.relatedTranscript && (
                            <p className="text-[10px] text-muted-foreground truncate italic">"{linkedEntry.relatedTranscript}"</p>
                          )}
                        </div>
                      )}
                      <div className="px-2 pb-2">
                        <p className="text-[10px] text-muted-foreground">Photo {i + 1}{asset.capturedAt ? ` · ${format(parseISO(asset.capturedAt), "h:mm:ss a")}` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Transcript tab */}
          <TabsContent value="transcript" className="flex-1 overflow-y-auto px-4 md:px-6 py-3 mt-0">
            <TranscriptWithMarkers chunks={chunks} assets={assets} />
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
              {lightboxPhoto.entry.body && (
                <p className="text-white/80 text-xs mt-1">{lightboxPhoto.entry.body}</p>
              )}
            </div>
          )}
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxPhoto(null)}>
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
