import { useState, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft, Upload, Sparkles, Loader2, Check, X, Plus, Trash2,
  Share2, Copy, Link as LinkIcon, Printer, FileText, Edit3, Image as ImageIcon,
  CheckSquare, Square, MapPin, Clock, Camera, NotebookPen,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

function compressImage(dataUrl: string, maxW = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.width || 1, h = img.height || 1;
        const scale = Math.min(1, maxW / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const c = document.createElement("canvas");
        c.width = tw; c.height = th;
        const ctx = c.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, tw, th);
        resolve(c.toDataURL("image/jpeg", quality));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target!.result as string);
    reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

type PageSession = {
  id: string; title: string | null; pageIntro: string | null; pageSummary: string | null;
  sessionType: string; sessionSubtype: string;
  locationId: string | null; locationName: string | null;
  status: string; aiStatus: string;
  startedAt: string; endedAt: string | null;
  createdByName: string;
};

type Asset = {
  id: string; sessionId: string; caption: string | null;
  phase: string; sequenceIndex: number; capturedAt: string;
};

type Todo = {
  id: string; sessionId: string; text: string;
  isComplete: boolean; sortOrder: number;
};

type PublicDoc = {
  id: string; shareToken: string; isEnabled: boolean;
  title: string | null; showTimestamps: boolean; showInternalNotes: boolean;
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit", inspection: "Inspection", pre_clean: "Pre-Clean",
  post_clean: "Post-Clean", damage_report: "Damage Report", maintenance: "Maintenance",
};

function PhotoCard({ asset, sessionId }: { asset: Asset; sessionId: string }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(asset.caption ?? "");

  const updateMutation = useMutation({
    mutationFn: (body: object) => apiRequest("PATCH", `/api/field-notes/assets/${asset.id}`, body).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] }); setEditing(false); },
    onError: () => toast({ title: "Failed to save caption", variant: "destructive" }),
  });

  const aiCaptionMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/assets/${asset.id}/ai-caption`).then(r => r.json()),
    onSuccess: (data) => {
      setCaptionDraft(data.caption ?? "");
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
      toast({ title: "AI caption generated" });
    },
    onError: () => toast({ title: "AI caption failed", variant: "destructive" }),
  });

  const imgUrl = `/api/field-notes/assets/${asset.id}/image`;

  return (
    <div className="rounded-xl border bg-card overflow-hidden group">
      <div className="aspect-video relative bg-muted">
        <img
          src={imgUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 cursor-pointer border-white/60 bg-black/50 text-white hover:bg-black/70",
            )}
            onClick={() => updateMutation.mutate({ phase: asset.phase === "before" ? "after" : "before" })}
          >
            {asset.phase === "after" ? "After" : "Before"}
          </Badge>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={captionDraft}
              onChange={e => setCaptionDraft(e.target.value)}
              placeholder="Describe what's shown…"
              className="text-xs min-h-[60px] resize-none"
              autoFocus
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs gap-1"
                onClick={() => updateMutation.mutate({ caption: captionDraft })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCaptionDraft(asset.caption ?? ""); setEditing(false); }}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 min-h-[2.5rem]">
              {asset.caption || <span className="italic opacity-50">No caption yet</span>}
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-6 text-[10px] gap-1"
                onClick={() => setEditing(true)}
                data-testid={`button-edit-caption-${asset.id}`}
              >
                <Edit3 className="w-2.5 h-2.5" /> Write
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-6 text-[10px] gap-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                onClick={() => aiCaptionMutation.mutate()}
                disabled={aiCaptionMutation.isPending}
                data-testid={`button-ai-caption-${asset.id}`}
              >
                {aiCaptionMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                AI
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TodoItem({ todo, sessionId }: { todo: Todo; sessionId: string }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [textDraft, setTextDraft] = useState(todo.text);

  const updateMutation = useMutation({
    mutationFn: (body: object) => apiRequest("PATCH", `/api/field-notes/todos/${todo.id}`, body).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId, "todos"] }),
    onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/field-notes/todos/${todo.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId, "todos"] }),
    onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
  });

  return (
    <div className={cn("flex items-start gap-2.5 p-3 rounded-lg border transition-colors", todo.isComplete ? "bg-muted/30 opacity-60" : "bg-card")}>
      <button
        onClick={() => updateMutation.mutate({ isComplete: !todo.isComplete })}
        className="mt-0.5 flex-shrink-0 text-primary hover:text-primary/80"
        data-testid={`button-toggle-todo-${todo.id}`}
      >
        {todo.isComplete
          ? <CheckSquare className="w-4 h-4" />
          : <Square className="w-4 h-4 text-muted-foreground" />}
      </button>

      {editing ? (
        <div className="flex-1 flex gap-1.5">
          <Input
            value={textDraft}
            onChange={e => setTextDraft(e.target.value)}
            className="h-7 text-xs flex-1"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") { updateMutation.mutate({ text: textDraft }); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={() => { updateMutation.mutate({ text: textDraft }); setEditing(false); }}>
            <Check className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <span
          className={cn("flex-1 text-sm cursor-pointer hover:text-primary transition-colors", todo.isComplete && "line-through")}
          onDoubleClick={() => setEditing(true)}
        >
          {todo.text}
        </span>
      )}

      <button
        onClick={() => deleteMutation.mutate()}
        className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-0.5"
        data-testid={`button-delete-todo-${todo.id}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SharePanel({ session, publicDoc, sessionId }: { session: PageSession; publicDoc: PublicDoc | null; sessionId: string }) {
  const { toast } = useToast();
  const [shareTitle, setShareTitle] = useState(publicDoc?.title || session.title || "");
  const [showTimestamps, setShowTimestamps] = useState(publicDoc?.showTimestamps ?? false);
  const [showInternalNotes, setShowInternalNotes] = useState(publicDoc?.showInternalNotes ?? false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    publicDoc?.isEnabled ? `${window.location.origin}/public/field-notes/${publicDoc.shareToken}` : null
  );

  const shareMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/share`, { title: shareTitle || null, showTimestamps, showInternalNotes }).then(r => r.json()),
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
    onSuccess: () => { setShareUrl(null); queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] }); toast({ title: "Link disabled" }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  return (
    <div className="bg-muted/40 border rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Share Link</p>
      <div className="space-y-2.5">
        <div>
          <Label className="text-xs mb-1 block">Document Title</Label>
          <Input value={shareTitle} onChange={e => setShareTitle(e.target.value)} placeholder="e.g. Site Visit Report" className="h-7 text-xs" data-testid="input-share-title" />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show timestamps</Label>
          <Switch checked={showTimestamps} onCheckedChange={setShowTimestamps} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Include internal notes</Label>
          <Switch checked={showInternalNotes} onCheckedChange={setShowInternalNotes} />
        </div>
      </div>
      {shareUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 bg-background rounded-lg border px-2.5 py-1.5">
            <LinkIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate flex-1">{shareUrl}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(shareUrl!); toast({ title: "Copied" }); }} data-testid="button-copy-share-link">
              <Copy className="w-3 h-3" /> Copy Link
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => disableMutation.mutate()} disabled={disableMutation.isPending}>
              {disableMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Disable"}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" className="w-full gap-1.5 h-8 text-xs" onClick={() => shareMutation.mutate()} disabled={shareMutation.isPending} data-testid="button-generate-share-link">
          {shareMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
          Generate Share Link
        </Button>
      )}
    </div>
  );
}

export default function FieldNotesPageEditor() {
  const [, params] = useRoute("/admin/field-notes/page/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.id ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingIntro, setEditingIntro] = useState(false);
  const [introDraft, setIntroDraft] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "photos" | "todos" | "share">("overview");

  const { data: session, isLoading } = useQuery<PageSession & { assets: Asset[]; publicDoc?: PublicDoc | null }>({
    queryKey: ["/api/field-notes/sessions", sessionId],
    queryFn: () => fetch(`/api/field-notes/sessions/${sessionId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!sessionId,
  });

  const { data: todos = [] } = useQuery<Todo[]>({
    queryKey: ["/api/field-notes/sessions", sessionId, "todos"],
    queryFn: () => fetch(`/api/field-notes/sessions/${sessionId}/todos`, { credentials: "include" }).then(r => r.json()),
    enabled: !!sessionId,
  });

  const assets = session?.assets ?? [];
  const publicDoc = session?.publicDoc ?? null;

  const updateMutation = useMutation({
    mutationFn: (body: object) => apiRequest("PATCH", `/api/field-notes/sessions/${sessionId}`, body).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] }); setEditingTitle(false); setEditingIntro(false); setEditingSummary(false); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const createTodoMutation = useMutation({
    mutationFn: (text: string) => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/todos`, { text, sortOrder: todos.length }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId, "todos"] }); setNewTodo(""); },
    onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
  });

  const uploadPhoto = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Only image files can be uploaded", variant: "destructive" });
      return;
    }
    try {
      const raw = await fileToDataUrl(file);
      const compressed = await compressImage(raw);
      const res = await apiRequest("POST", `/api/field-notes/sessions/${sessionId}/photo`, {
        fileUrl: compressed,
        capturedAt: new Date().toISOString(),
        sequenceIndex: assets.length,
      });
      await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes/sessions", sessionId] });
    } catch (err: any) {
      console.error("[PageEditor] Photo upload failed:", err?.message ?? err);
      toast({ title: "Photo upload failed. Please try again.", variant: "destructive" });
    }
  }, [sessionId, assets.length, toast]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const f of files) await uploadPhoto(f);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadPhoto]);

  if (!sessionId) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Invalid page ID</p>
    </div>
  );

  if (isLoading) return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="flex-1 p-6 space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    </div>
  );

  if (!session) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Page not found</p>
    </div>
  );

  const typeLabel = SESSION_TYPE_LABELS[session.sessionType] ?? session.sessionType;
  const completedTodos = todos.filter(t => t.isComplete).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none border-b bg-background px-4 py-3 flex items-center gap-3">
        <button
          data-testid="button-back-page-editor"
          onClick={() => navigate("/admin/field-notes")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Field Notes</span>
        </button>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                className="h-7 text-sm font-semibold"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") updateMutation.mutate({ title: titleDraft }); if (e.key === "Escape") setEditingTitle(false); }}
              />
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => updateMutation.mutate({ title: titleDraft })} disabled={updateMutation.isPending}>
                <Check className="w-3 h-3" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingTitle(false)}><X className="w-3 h-3" /></Button>
            </div>
          ) : (
            <button
              className="text-left min-w-0 group"
              onClick={() => { setTitleDraft(session.title ?? ""); setEditingTitle(true); }}
              data-testid="button-edit-page-title"
            >
              <h1 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {session.title || typeLabel}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">Page</Badge>
                <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                {session.locationName && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <MapPin className="w-2.5 h-2.5" /> {session.locationName}
                  </span>
                )}
              </div>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 hidden sm:flex"
            onClick={() => window.print()}
            data-testid="button-print-page"
          >
            <Printer className="w-3 h-3" /> Print
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setActiveTab("share")}
            data-testid="button-open-share"
          >
            <Share2 className="w-3 h-3" /> Share
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex-none border-b bg-background px-4">
        <div className="flex gap-0">
          {([
            { key: "overview", label: "Overview", icon: FileText },
            { key: "photos", label: `Photos${assets.length ? ` (${assets.length})` : ""}`, icon: ImageIcon },
            { key: "todos", label: `To-do${todos.length ? ` (${completedTodos}/${todos.length})` : ""}`, icon: CheckSquare },
            { key: "share", label: "Share", icon: Share2 },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-12">

          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {format(parseISO(session.startedAt), "MMM d, yyyy · h:mm a")}
                </span>
                <span className="flex items-center gap-1">
                  <NotebookPen className="w-3.5 h-3.5" />
                  {session.createdByName}
                </span>
                {session.locationName && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {session.locationName}
                  </span>
                )}
              </div>

              {/* Page intro */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page Introduction</Label>
                  {!editingIntro && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => { setIntroDraft(session.pageIntro ?? ""); setEditingIntro(true); }}>
                      <Edit3 className="w-3 h-3" /> Edit
                    </Button>
                  )}
                </div>
                {editingIntro ? (
                  <div className="space-y-2">
                    <Textarea
                      value={introDraft}
                      onChange={e => setIntroDraft(e.target.value)}
                      placeholder="Write a brief introduction or overview for this page…"
                      className="min-h-[100px] text-sm resize-none"
                      autoFocus
                      data-testid="input-page-intro"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 text-xs h-7" onClick={() => updateMutation.mutate({ pageIntro: introDraft })} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingIntro(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-lg border bg-muted/30 p-3 min-h-[60px] cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => { setIntroDraft(session.pageIntro ?? ""); setEditingIntro(true); }}
                    data-testid="area-page-intro"
                  >
                    {session.pageIntro
                      ? <p className="text-sm leading-relaxed">{session.pageIntro}</p>
                      : <p className="text-sm text-muted-foreground italic">Click to add an introduction…</p>
                    }
                  </div>
                )}
              </div>

              {/* Page summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page Summary</Label>
                  {!editingSummary && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => { setSummaryDraft(session.pageSummary ?? ""); setEditingSummary(true); }}>
                      <Edit3 className="w-3 h-3" /> Edit
                    </Button>
                  )}
                </div>
                {editingSummary ? (
                  <div className="space-y-2">
                    <Textarea
                      value={summaryDraft}
                      onChange={e => setSummaryDraft(e.target.value)}
                      placeholder="Write a closing summary for this page (2–4 sentences)…"
                      className="min-h-[100px] text-sm resize-none"
                      autoFocus
                      data-testid="input-page-summary"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 text-xs h-7" onClick={() => updateMutation.mutate({ pageSummary: summaryDraft })} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingSummary(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-lg border bg-muted/30 p-3 min-h-[60px] cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => { setSummaryDraft(session.pageSummary ?? ""); setEditingSummary(true); }}
                    data-testid="area-page-summary"
                  >
                    {session.pageSummary
                      ? <p className="text-sm leading-relaxed">{session.pageSummary}</p>
                      : <p className="text-sm text-muted-foreground italic">Click to add a closing summary…</p>
                    }
                  </div>
                )}
              </div>

              {/* Photo grid preview */}
              {assets.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photos ({assets.length})</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setActiveTab("photos")}>
                      View all <ChevronLeft className="w-3 h-3 rotate-180" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {assets.slice(0, 8).map(a => (
                      <div key={a.id} className="aspect-square rounded-md overflow-hidden bg-muted">
                        <img src={`/api/field-notes/assets/${a.id}/image`} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                    {assets.length > 8 && (
                      <div className="aspect-square rounded-md overflow-hidden bg-muted/60 flex items-center justify-center cursor-pointer border-2 border-dashed" onClick={() => setActiveTab("photos")}>
                        <span className="text-xs font-semibold text-muted-foreground">+{assets.length - 8}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* To-do preview */}
              {todos.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To-do ({completedTodos}/{todos.length})</Label>
                  <div className="space-y-1.5">
                    {todos.slice(0, 5).map(t => (
                      <div key={t.id} className={cn("flex items-center gap-2 p-2 rounded-lg text-sm", t.isComplete ? "opacity-50 line-through" : "")}>
                        {t.isComplete ? <CheckSquare className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : <Square className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                        {t.text}
                      </div>
                    ))}
                    {todos.length > 5 && (
                      <button className="text-xs text-primary hover:underline pl-2" onClick={() => setActiveTab("todos")}>
                        +{todos.length - 5} more items
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Photos tab */}
          {activeTab === "photos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Photos ({assets.length})</h2>
                <Button
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="button-upload-photos"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? "Uploading…" : "Upload Photos"}
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileInput}
                data-testid="input-file-upload"
              />

              {assets.length === 0 ? (
                <div
                  className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">Upload photos to this page</p>
                  <p className="text-xs text-muted-foreground/70">Tap to select photos from your device</p>
                  <Button size="sm" className="gap-1.5 mt-1" data-testid="button-upload-photos-empty">
                    <Upload className="w-3.5 h-3.5" /> Choose Photos
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {assets.map(a => (
                      <PhotoCard key={a.id} asset={a} sessionId={sessionId} />
                    ))}
                  </div>
                  <div
                    className="border-2 border-dashed rounded-xl p-6 flex items-center justify-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Add more photos</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* To-do tab */}
          {activeTab === "todos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">To-do List</h2>
                {todos.length > 0 && (
                  <span className="text-xs text-muted-foreground">{completedTodos} of {todos.length} done</span>
                )}
              </div>

              {/* Add new item */}
              <div className="flex gap-2">
                <Input
                  value={newTodo}
                  onChange={e => setNewTodo(e.target.value)}
                  placeholder="Add a to-do item…"
                  className="text-sm"
                  data-testid="input-new-todo"
                  onKeyDown={e => { if (e.key === "Enter" && newTodo.trim()) createTodoMutation.mutate(newTodo); }}
                />
                <Button
                  size="sm"
                  onClick={() => { if (newTodo.trim()) createTodoMutation.mutate(newTodo); }}
                  disabled={!newTodo.trim() || createTodoMutation.isPending}
                  data-testid="button-add-todo"
                  className="gap-1 px-4"
                >
                  {createTodoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add
                </Button>
              </div>

              {todos.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No to-do items yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Add items to track tasks for this page</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todos.map(t => (
                    <TodoItem key={t.id} todo={t} sessionId={sessionId} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Share tab */}
          {activeTab === "share" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Share & Export</h2>
              <SharePanel session={session} publicDoc={publicDoc} sessionId={sessionId} />
              <div className="border rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Export</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 h-9 text-sm"
                  onClick={() => window.print()}
                  data-testid="button-export-pdf"
                >
                  <Printer className="w-4 h-4" /> Print / Export as PDF
                </Button>
                <p className="text-[10px] text-muted-foreground">Use your browser's print dialog and select "Save as PDF".</p>
              </div>
            </div>
          )}

        </div>
      </ScrollArea>

      {/* Hidden file input (already declared above) */}
    </div>
  );
}
