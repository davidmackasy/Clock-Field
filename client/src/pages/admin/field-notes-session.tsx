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
  Loader2, RefreshCw, CheckCircle2, AlertTriangle,
  Edit3, X, Check, NotebookPen, Images, FileText,
  Sparkles, ChevronDown, ChevronUp
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit",
  inspection: "Inspection",
  pre_clean: "Pre-Clean",
  post_clean: "Post-Clean",
  damage_report: "Damage Report",
  maintenance: "Maintenance",
};

const ENTRY_TYPE_ICONS: Record<string, string> = {
  issue: "⚠️",
  damage: "🚨",
  risk: "⚡",
  observation: "👁️",
  cleaning_scope: "🧹",
  before_condition: "📸",
  after_condition: "✅",
  supply_note: "📦",
  general_note: "📝",
};

function EntryCard({ entry, sessionId }: { entry: any; sessionId: string }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: entry.title, body: entry.body, recommendedAction: entry.recommendedAction ?? "" });
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/field-notes/entries/${entry.id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      setEditing(false);
      toast({ title: "Entry updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-lg leading-none mt-0.5">{ENTRY_TYPE_ICONS[entry.entryType] ?? "📝"}</span>
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                data-testid="input-entry-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="text-sm font-semibold h-7 mb-1"
              />
            ) : (
              <p className="font-semibold text-sm leading-snug">{entry.title}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {entry.areaName && (
                <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{entry.areaName}</span>
              )}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[entry.priority] ?? ""}`}>
                {entry.priority}
              </Badge>
              {entry.issueDetected && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">
                  Issue
                </Badge>
              )}
              {(entry.tags ?? []).map((t: string) => (
                <span key={t} className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5">#{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {editing ? (
            <>
              <Button
                data-testid="button-save-entry"
                size="icon"
                variant="ghost"
                className="w-7 h-7"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate(form)}
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                data-testid={`button-edit-entry-${entry.id}`}
                size="icon"
                variant="ghost"
                className="w-7 h-7"
                onClick={() => setEditing(true)}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2 pl-6">
          <Textarea
            data-testid="textarea-entry-body"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={3}
            className="text-sm"
            placeholder="Details…"
          />
          <Input
            data-testid="input-entry-action"
            value={form.recommendedAction}
            onChange={e => setForm(f => ({ ...f, recommendedAction: e.target.value }))}
            placeholder="Recommended action…"
            className="text-sm h-8"
          />
        </div>
      ) : expanded ? (
        <div className="pl-6 space-y-1.5">
          <p className="text-sm text-muted-foreground leading-relaxed">{entry.body}</p>
          {entry.recommendedAction && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
              Action: {entry.recommendedAction}
            </p>
          )}
          {entry.clientSafeSummary && (
            <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 italic">
              Client view: {entry.clientSafeSummary}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground line-clamp-2 pl-6">{entry.body}</p>
      )}
    </div>
  );
}

export default function AdminFieldNotesSession() {
  const [location, navigate] = useLocation();
  const [, adminParams] = useRoute("/admin/field-notes/session/:id");
  const [, employeeParams] = useRoute("/employee/field-notes/session/:id");
  const sessionId = adminParams?.id ?? employeeParams?.id;
  const backPath = location.startsWith("/employee") ? "/employee/field-notes" : "/admin/field-notes";
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: session, isLoading } = useQuery<any>({
    queryKey: ["/api/field-notes/sessions", sessionId],
    queryFn: () => apiRequest("GET", `/api/field-notes/sessions/${sessionId}`).then(r => r.json()),
    enabled: !!sessionId,
    refetchInterval: (data: any) => (data?.status === "processing" || data?.status === "uploading") ? 3000 : false,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/field-notes/sessions/${sessionId}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      setEditingTitle(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const processMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/process`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      toast({ title: "AI processing started…" });
    },
    onError: () => toast({ title: "Failed to start AI processing", variant: "destructive" }),
  });

  if (isLoading || !session) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const duration = session.endedAt
    ? differenceInMinutes(parseISO(session.endedAt), parseISO(session.startedAt))
    : null;

  const statusColor: Record<string, string> = {
    recording: "text-red-600",
    uploading: "text-yellow-600",
    processing: "text-blue-600",
    ready: "text-green-600",
    failed: "text-gray-500",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-4 md:px-6 py-4">
        <button
          data-testid="button-back-session"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-3"
          onClick={() => navigate(backPath)}
        >
          <ChevronLeft className="w-4 h-4" /> Field Notes
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  data-testid="input-session-title-edit"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="h-8 text-base font-semibold"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => updateMutation.mutate({ title })}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setEditingTitle(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold leading-snug truncate">
                  {session.title || SESSION_TYPE_LABELS[session.sessionType] || session.sessionType}
                </h1>
                <button
                  data-testid="button-edit-title"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => { setTitle(session.title ?? ""); setEditingTitle(true); }}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {session.locationName && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.locationName}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(parseISO(session.startedAt), "MMM d, yyyy h:mm a")}
                {duration !== null && ` · ${duration}m`}
              </span>
              <span className={cn("flex items-center gap-1 font-medium", statusColor[session.status])}>
                {(session.status === "processing" || session.status === "uploading") && <Loader2 className="w-3 h-3 animate-spin" />}
                {session.status}
              </span>
            </div>
          </div>
          {(session.aiStatus === "failed" || (session.status === "ready" && !session.aiSummary)) && (
            <Button
              data-testid="button-retry-ai"
              size="sm"
              variant="outline"
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
              className="gap-1.5 flex-shrink-0"
            >
              {processMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Process with AI
            </Button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {(session.status === "processing" || session.status === "uploading") && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 px-4 py-2.5 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          AI is analyzing your photos and voice notes… This usually takes 15–30 seconds.
        </div>
      )}

      {/* AI Summary bar */}
      {session.aiSummary && (
        <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800 px-4 py-2.5 text-sm text-green-800 dark:text-green-300">
          <span className="font-semibold">Summary: </span>{session.aiSummary}
        </div>
      )}

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="entries" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 md:mx-6 mt-3 mb-0 w-auto self-start">
            <TabsTrigger data-testid="tab-entries" value="entries">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              AI Notes ({(session.entries ?? []).length})
            </TabsTrigger>
            <TabsTrigger data-testid="tab-photos" value="photos">
              <Images className="w-3.5 h-3.5 mr-1" />
              Photos ({(session.assets ?? []).length})
            </TabsTrigger>
            <TabsTrigger data-testid="tab-transcript" value="transcript">
              <FileText className="w-3.5 h-3.5 mr-1" />
              Transcript
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3 mt-0">
            {(session.entries ?? []).length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No AI notes yet</p>
                <p className="text-sm mt-1">
                  {session.status === "ready"
                    ? "Click 'Process with AI' to generate structured notes"
                    : "Notes will appear here after processing"}
                </p>
              </div>
            ) : (
              (session.entries ?? []).map((entry: any) => (
                <EntryCard key={entry.id} entry={entry} sessionId={sessionId!} />
              ))
            )}
          </TabsContent>

          <TabsContent value="photos" className="flex-1 overflow-y-auto px-4 md:px-6 py-4 mt-0">
            {(session.assets ?? []).length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No photos captured</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {(session.assets ?? []).map((asset: any, i: number) => (
                  <div
                    key={asset.id}
                    data-testid={`img-photo-${asset.id}`}
                    className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 ring-primary transition-all"
                    onClick={() => setSelectedPhoto(asset.fileUrl)}
                  >
                    <img
                      src={asset.fileUrl}
                      alt={asset.caption ?? `Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transcript" className="flex-1 overflow-y-auto px-4 md:px-6 py-4 mt-0">
            {(session.transcriptChunks ?? []).length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Mic className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No voice recording</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(session.transcriptChunks ?? []).map((chunk: any, i: number) => (
                  <p key={chunk.id} className="text-sm text-muted-foreground leading-relaxed p-3 bg-muted rounded-lg">
                    {chunk.rawText}
                  </p>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <img src={selectedPhoto} className="max-w-full max-h-full rounded-lg" alt="Full size photo" />
          <button className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
