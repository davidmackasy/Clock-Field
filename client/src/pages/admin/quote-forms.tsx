import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  FileText, Plus, ExternalLink, Trash2, Loader2, Copy,
  ClipboardList, Settings2, Inbox, GitBranch, Zap, Mail, Code2,
  ChevronRight, ChevronLeft, User, Phone, MapPin, Calendar,
  RotateCw, CheckCircle2, XCircle, AlertCircle, Clock, DollarSign,
  Save, ArrowRight, FileCheck, SlidersHorizontal, RefreshCw, Eye,
  Send, Sparkles, Building2, Home, BarChart3, Camera, Images, Mic,
  Edit3, X, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type QuoteForm = { id: string; name: string; slug: string; companyId: string; isActive: boolean; createdAt: string; config: any };
type WalkthroughPhoto = { id: string; walkthroughId: string; fileUrl: string; orderIndex: number; capturedAt: string; aiLabel?: string; aiDescription?: string; adminLabel?: string; adminDescription?: string };
type WalkthroughSection = { id: string; walkthroughId: string; title: string; description: string; orderIndex: number; photoIds: string; aiGenerated: boolean; adminEdited: boolean; adminNotes?: string };
type WalkthroughDetail = { id: string; submissionId?: string; photoCount: number; durationSeconds?: number; audioUrl?: string; transcript?: string; aiTitle?: string; aiSummary?: string; aiStatus: string; photos: WalkthroughPhoto[]; sections: WalkthroughSection[] };
type Submission = {
  id: string; formId: string; formName: string; companyId: string;
  data: Record<string, any>; status: string; submittedAt: string;
  clientName?: string; clientEmail?: string; clientPhone?: string;
  serviceType?: string; serviceAddress?: string;
  pipelineStage: string; estimateStatus: string; adminNotes?: string; archivedAt?: string;
  estimate?: any; quote?: any; activity?: any[];
  walkthrough?: WalkthroughDetail | null;
  hasWalkthrough?: boolean;
};

const PIPELINE_STAGES = [
  { id: "new_request",  label: "New Request",  color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "estimated",    label: "Estimated",    color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "needs_review", label: "Needs Review", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { id: "quote_ready",  label: "Quote Ready",  color: "bg-orange-100 text-orange-800 border-orange-200" },
  { id: "quote_sent",   label: "Quote Sent",   color: "bg-sky-100 text-sky-800 border-sky-200" },
  { id: "follow_up",    label: "Follow Up",    color: "bg-pink-100 text-pink-800 border-pink-200" },
  { id: "won",          label: "Won",          color: "bg-green-100 text-green-800 border-green-200" },
  { id: "lost",         label: "Lost",         color: "bg-gray-100 text-gray-500 border-gray-200" },
];

const ESTIMATE_STATUS = {
  pending:   { label: "Pending",  icon: Clock,        cls: "text-gray-500" },
  running:   { label: "Running",  icon: Loader2,      cls: "text-blue-500 animate-spin" },
  completed: { label: "Estimated",icon: CheckCircle2, cls: "text-green-600" },
  failed:    { label: "Failed",   icon: XCircle,      cls: "text-red-500" },
};

function stageBadge(stage: string) {
  const s = PIPELINE_STAGES.find(x => x.id === stage);
  return s ? <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", s.color)}>{s.label}</span> : null;
}

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
}
function fmtCurrency(v: string | number | null | undefined) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(v));
}

// ── Forms Tab ─────────────────────────────────────────────────────────────────
function FormsTab() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [smartMode, setSmartMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuoteForm | null>(null);

  const { data: forms = [], isLoading } = useQuery<QuoteForm[]>({ queryKey: ["/api/admin/quote-forms"] });

  const createMutation = useMutation({
    mutationFn: ({ name, smart }: { name: string; smart: boolean }) =>
      apiRequest("POST", "/api/admin/quote-forms", {
        name,
        config: smart ? { smartMode: "cleaning", steps: [] } : undefined,
      }).then(r => r.json()),
    onSuccess: (form, { smart }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/quote-forms"] });
      setCreateOpen(false); setNewName(""); setSmartMode(false);
      if (smart) { toast({ title: `Smart Cleaning Form "${form.name}" created!` }); }
      else { navigate(`/admin/quote-forms/${form.id}`); }
    },
    onError: () => toast({ title: "Failed to create form", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/quote-forms/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/quote-forms"] }); toast({ title: "Form deleted." }); setDeleteTarget(null); },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PATCH", `/api/admin/quote-forms/${id}`, { isActive }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/quote-forms"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Shareable multi-step forms clients fill out to request a quote.</p>
        <Button data-testid="button-new-quote-form" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> New Form
        </Button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><FileText className="w-8 h-8 text-muted-foreground/40" /></div>
          <p className="font-semibold text-muted-foreground">No forms yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">Create a form to share with clients so they can request a quote.</p>
          <Button className="mt-5 gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create First Form</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {forms.map(form => {
            const publicUrl = `${window.location.origin}/form/${form.companyId}/${form.slug}`;
            return (
              <div key={form.id} data-testid={`card-quote-form-${form.id}`}
                className="group rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all duration-150 flex flex-col overflow-hidden cursor-pointer"
                onClick={() => navigate(`/admin/quote-forms/${form.id}`)}>
                <div className={cn("h-1 w-full", form.isActive ? "bg-green-400" : "bg-gray-200")} />
                <div className="p-4 flex flex-col gap-3 flex-1 relative">
                  <button data-testid={`button-delete-form-${form.id}`}
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md items-center justify-center hidden group-hover:flex text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(form); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate leading-tight">{form.name}</p>
                        {form.config?.smartMode === "cleaning" && (
                          <span className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">Smart</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">/{form.slug}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", form.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500")}>
                      {form.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Created {fmtDate(form.createdAt)}</p>
                  <div className="flex items-center gap-2 mt-auto pt-2 border-t">
                    <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(publicUrl); toast({ title: "Link copied!" }); }}>
                      <Copy className="w-3 h-3" /> Copy Link
                    </button>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                      onClick={e => e.stopPropagation()}>
                      <ExternalLink className="w-3 h-3" /> Preview
                    </a>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <span className="text-[11px] text-muted-foreground">{form.isActive ? "On" : "Off"}</span>
                      <Switch data-testid={`switch-form-active-${form.id}`} checked={form.isActive} onCheckedChange={v => toggleMutation.mutate({ id: form.id, isActive: v })} className="scale-75" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) { setNewName(""); setSmartMode(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary" /> New Form</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Form Name</Label>
              <Input data-testid="input-new-form-name" placeholder="e.g. Cleaning Quote Request" value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate({ name: newName.trim(), smart: smartMode }); }} autoFocus />
              <p className="text-[11px] text-muted-foreground mt-1">URL: /form/…/{newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "form"}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium block">Form Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  className={cn("p-3 rounded-xl border text-left transition-all", !smartMode ? "border-primary bg-primary/5 text-primary" : "border-muted bg-muted/30 text-muted-foreground hover:border-primary/30")}
                  onClick={() => setSmartMode(false)}>
                  <FileText className="w-4 h-4 mb-1.5" />
                  <p className="text-xs font-semibold">Custom Builder</p>
                  <p className="text-[10px] mt-0.5 opacity-70">Build your own form with shared, residential, and commercial field groups</p>
                </button>
                <button type="button" data-testid="button-select-smart-form"
                  className={cn("p-3 rounded-xl border text-left transition-all", smartMode ? "border-purple-500 bg-purple-50 text-purple-700" : "border-muted bg-muted/30 text-muted-foreground hover:border-purple-300")}
                  onClick={() => setSmartMode(true)}>
                  <Sparkles className="w-4 h-4 mb-1.5" />
                  <p className="text-xs font-semibold">Smart Cleaning Form</p>
                  <p className="text-[10px] mt-0.5 opacity-70">Pre-built cleaning quote form with residential and commercial conditional steps</p>
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button data-testid="button-create-form-confirm" className={cn("flex-1", smartMode && "bg-purple-600 hover:bg-purple-700")} disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newName.trim(), smart: smartMode })}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {smartMode ? "Create Smart Form" : "Create & Edit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-4 h-4" /> Delete Form?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete <span className="font-medium text-foreground">"{deleteTarget?.name}"</span> and all its submissions.</p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button data-testid="button-confirm-delete-form" variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Submissions Tab ───────────────────────────────────────────────────────────
function SubmissionsTab({ onGoToEstimator }: { onGoToEstimator: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("all");
  const [noteInput, setNoteInput] = useState("");
  const [respondOpen, setRespondOpen] = useState(false);
  const [respondTo, setRespondTo] = useState("");
  const [respondSubject, setRespondSubject] = useState("");
  const [respondMessage, setRespondMessage] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const [editSectionDesc, setEditSectionDesc] = useState("");
  const [editSectionNotes, setEditSectionNotes] = useState("");
  const [respondSelectedPhotoIds, setRespondSelectedPhotoIds] = useState<string[]>([]);
  const [estimatorNotConfigured, setEstimatorNotConfigured] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({ queryKey: ["/api/admin/submissions"] });
  const { data: detail } = useQuery<Submission>({
    queryKey: ["/api/admin/submissions", selectedId],
    queryFn: async () => { if (!selectedId) throw new Error(); const r = await fetch(`/api/admin/submissions/${selectedId}`, { credentials: "include" }); return r.json(); },
    enabled: !!selectedId,
  });

  const estimateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/submissions/${id}/estimate`, {}).then(r => r.json()),
    onSuccess: () => { setEstimatorNotConfigured(false); qc.invalidateQueries({ queryKey: ["/api/admin/submissions"] }); qc.invalidateQueries({ queryKey: ["/api/admin/submissions", selectedId] }); },
    onError: (e: any) => {
      if (e.message?.includes("Configure Estimator Settings")) {
        setEstimatorNotConfigured(true);
      } else {
        toast({ title: "Estimate failed", description: e.message, variant: "destructive" });
      }
    },
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, pipelineStage }: { id: string; pipelineStage: string }) =>
      apiRequest("PATCH", `/api/admin/submissions/${id}`, { pipelineStage }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/submissions"] }); qc.invalidateQueries({ queryKey: ["/api/admin/submissions", selectedId] }); },
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiRequest("POST", `/api/admin/submissions/${id}/activity`, { eventType: "note", note }).then(r => r.json()),
    onSuccess: () => { setNoteInput(""); qc.invalidateQueries({ queryKey: ["/api/admin/submissions", selectedId] }); },
  });

  const editSectionMutation = useMutation({
    mutationFn: ({ submissionId, sectionId, title, description, adminNotes }: { submissionId: string; sectionId: string; title: string; description: string; adminNotes: string }) =>
      apiRequest("PATCH", `/api/admin/submissions/${submissionId}/walkthrough/sections/${sectionId}`, { title, description, adminNotes }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/submissions", selectedId] }); setEditingSection(null); toast({ title: "Section updated." }); },
  });

  const processAiMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/submissions/${id}/walkthrough/process-ai`, {}).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/submissions", selectedId] }); toast({ title: "AI processing started." }); },
  });

  const startWalkMutation = useMutation({
    mutationFn: (sub: Submission) => apiRequest("POST", "/api/jobsite-walks", {
      submissionId: sub.id,
      title: `Walk — ${sub.clientName || sub.serviceAddress || "Lead"}`,
      siteType: ["Commercial","Industrial / Warehouse"].includes(sub.data?.propertyCategory) ? "commercial" : "residential",
    }).then(r => r.json()),
    onSuccess: (data) => {
      stageMutation.mutate({ id: selectedId!, pipelineStage: "quote_ready" });
      navigate(`/admin/field-notes/jobsite-walks/${data.id}`);
    },
    onError: () => toast({ title: "Failed to start walk", variant: "destructive" }),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, to, subject, message }: { id: string; to: string; subject: string; message: string }) =>
      apiRequest("POST", `/api/admin/submissions/${id}/respond`, { to, subject, message }).then(r => r.json()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/submissions", selectedId] });
      if (res.success) {
        toast({ title: "Email sent successfully!" });
        setRespondOpen(false); setRespondTo(""); setRespondSubject(""); setRespondMessage("");
      } else {
        toast({ title: "Email not sent", description: res.emailError || "Unknown error", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  const openRespondModal = (sub: Submission) => {
    setRespondTo(sub.clientEmail || "");
    setRespondSubject(`Re: Your Cleaning Quote Request`);
    setRespondMessage(`Hi ${sub.clientName?.split(" ")[0] || "there"},\n\nThank you for reaching out! We've reviewed your request and would love to help.\n\n`);
    setRespondOpen(true);
  };

  const filtered = stageFilter === "all" ? submissions : submissions.filter(s => s.pipelineStage === stageFilter);

  return (
    <div className="flex gap-4 min-h-0 h-full">
      {/* List */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2">
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-stage-filter">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {PIPELINE_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex-1 overflow-y-auto space-y-1">
          {isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />) :
            filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">No submissions yet.</p> :
            filtered.map(sub => (
              <button key={sub.id} data-testid={`card-submission-${sub.id}`}
                className={cn("w-full text-left p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors",
                  selectedId === sub.id && "border-primary/40 bg-primary/5")}
                onClick={() => setSelectedId(sub.id)}>
                <div className="flex items-start justify-between gap-1">
                  <span className="font-medium text-sm truncate">{sub.clientName || "Unknown Client"}</span>
                  {stageBadge(sub.pipelineStage)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub.serviceType || sub.formName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-muted-foreground">{fmtDate(sub.submittedAt)}</p>
                  {sub.hasWalkthrough && (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full border border-violet-200">
                      <Camera className="w-2.5 h-2.5" /> Walkthrough
                    </span>
                  )}
                </div>
              </button>
            ))
          }
        </div>
      </div>

      {/* Detail pane */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Select a submission to view details</p>
          </div>
        ) : !detail ? (
          <div className="space-y-3 p-4"><Skeleton className="h-6 w-48" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        ) : (
          <div className="space-y-4 p-1">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {["Commercial","Industrial / Warehouse"].includes(detail.data?.propertyCategory) ? <Building2 className="w-5 h-5 text-primary" /> : <Home className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base">{detail.clientName || "Unknown Client"}</h2>
                <div className="flex items-center gap-3 flex-wrap mt-0.5">
                  {detail.clientEmail && <span className="text-xs text-muted-foreground">{detail.clientEmail}</span>}
                  {detail.clientPhone && <span className="text-xs text-muted-foreground">{detail.clientPhone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {stageBadge(detail.pipelineStage)}
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  data-testid="button-respond-email"
                  onClick={() => openRespondModal(detail)}>
                  <Send className="w-3.5 h-3.5" /> Respond
                </Button>
              </div>
            </div>

            {/* Info row */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {detail.serviceType && <div className="flex items-center gap-1.5 text-muted-foreground"><FileText className="w-3.5 h-3.5" /> {detail.serviceType}</div>}
              {detail.serviceAddress && <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> {detail.serviceAddress}</div>}
              <div className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="w-3.5 h-3.5" /> {fmtDate(detail.submittedAt)}</div>
              <div className="flex items-center gap-1.5 text-muted-foreground"><ClipboardList className="w-3.5 h-3.5" /> {detail.formName}</div>
            </div>

            {/* Pipeline stage + quick actions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium">Move to Stage:</Label>
                <Select value={detail.pipelineStage} onValueChange={v => stageMutation.mutate({ id: detail.id, pipelineStage: v })}>
                  <SelectTrigger className="h-7 text-xs w-44" data-testid="select-pipeline-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  data-testid="button-start-walk"
                  disabled={startWalkMutation.isPending}
                  onClick={() => startWalkMutation.mutate(detail)}
                >
                  {startWalkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  Start Site Walk
                </Button>
              </div>
            </div>

            {/* AI Estimate */}
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Zap className="w-4 h-4 text-purple-500" /> AI Estimate</h3>
                {!estimatorNotConfigured && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                    data-testid="button-run-estimate"
                    disabled={estimateMutation.isPending}
                    onClick={() => estimateMutation.mutate(detail.id)}>
                    {estimateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                    {detail.estimate ? "Re-run" : "Run Estimate"}
                  </Button>
                )}
              </div>
              {estimatorNotConfigured ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3" data-testid="card-estimator-not-configured">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Estimator setup required</p>
                      <p className="text-xs text-amber-700 mt-0.5">You need to set up your pricing before generating estimates.</p>
                      <p className="text-xs text-amber-600 mt-0.5 italic">Takes less than 1 minute.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <Button size="sm" className="h-7 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="button-setup-estimator"
                      onClick={onGoToEstimator}>
                      <Zap className="w-3.5 h-3.5" /> Set Up Estimator
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                      data-testid="button-learn-estimator"
                      onClick={() => setLearnOpen(true)}>
                      Learn how it works
                    </Button>
                  </div>
                  <Dialog open={learnOpen} onOpenChange={setLearnOpen}>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Zap className="w-4 h-4 text-purple-500" /> How AI Estimating Works</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <p>The AI estimator uses your pricing rules to automatically calculate a price range for each quote request.</p>
                        <p className="font-medium text-foreground">You'll need to define:</p>
                        <ul className="space-y-1.5 list-none">
                          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" /> Pricing type (per visit, per hour, or per sq ft)</li>
                          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" /> Base price for residential and/or commercial jobs</li>
                          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" /> Any add-ons or room-based adjustments</li>
                        </ul>
                        <p>Once set up, click "Run Estimate" on any submission and the AI will suggest a price instantly.</p>
                      </div>
                      <Button className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white mt-2" onClick={() => { setLearnOpen(false); onGoToEstimator(); }}>
                        <Zap className="w-3.5 h-3.5" /> Set Up Estimator Now
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : !detail.estimate ? (
                <p className="text-xs text-muted-foreground">No estimate yet. Click "Run Estimate" to use AI pricing.</p>
              ) : detail.estimate.status === "failed" && detail.estimate.errorMessage?.includes("Configure Estimator Settings") ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3" data-testid="card-estimator-not-configured-saved">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Estimator setup required</p>
                      <p className="text-xs text-amber-700 mt-0.5">You need to set up your pricing before generating estimates.</p>
                      <p className="text-xs text-amber-600 mt-0.5 italic">Takes less than 1 minute.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <Button size="sm" className="h-7 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={onGoToEstimator}>
                      <Zap className="w-3.5 h-3.5" /> Set Up Estimator
                    </Button>
                  </div>
                </div>
              ) : detail.estimate.status === "failed" ? (
                <p className="text-xs text-red-500 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> {detail.estimate.errorMessage || "Estimate failed"}</p>
              ) : detail.estimate.status === "running" ? (
                <p className="text-xs text-blue-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running AI estimate…</p>
              ) : (
                <div className="space-y-3">
                  {/* Price header */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-center bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                      <p className="text-[10px] text-green-700 font-medium uppercase tracking-wide">Recommended</p>
                      <p className="text-xl font-bold text-green-700">{fmtCurrency(detail.estimate.recommendedPrice)}</p>
                      {(() => {
                        try { const r = JSON.parse(detail.estimate.rawResponse || "{}"); return r.billing_type === "per_visit" ? <p className="text-[10px] text-green-600">per visit</p> : null; } catch { return null; }
                      })()}
                    </div>
                    <div className="text-center bg-muted/50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Range</p>
                      <p className="text-sm font-semibold">{fmtCurrency(detail.estimate.priceMin)} – {fmtCurrency(detail.estimate.priceMax)}</p>
                    </div>
                    {(() => {
                      try {
                        const r = JSON.parse(detail.estimate.rawResponse || "{}");
                        if (r.monthly_total) return (
                          <div className="text-center bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-purple-700 font-medium uppercase tracking-wide">Monthly</p>
                            <p className="text-sm font-semibold text-purple-700">{fmtCurrency(r.monthly_total)}</p>
                            {r.estimated_visits_per_month && <p className="text-[9px] text-purple-500">{r.estimated_visits_per_month} visits/mo</p>}
                          </div>
                        );
                      } catch {}
                      return null;
                    })()}
                    {(() => {
                      try {
                        const r = JSON.parse(detail.estimate.rawResponse || "{}");
                        if (r.contract_total && r.contract_months) return (
                          <div className="text-center bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">{r.contract_months}-Mo Total</p>
                            <p className="text-sm font-semibold text-amber-700">{fmtCurrency(r.contract_total)}</p>
                          </div>
                        );
                      } catch {}
                      return null;
                    })()}
                  </div>
                  {/* Frequency summary row */}
                  {(() => {
                    try {
                      const r = JSON.parse(detail.estimate.rawResponse || "{}");
                      if (r.frequency_summary) return (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                          <span className="font-medium text-foreground">Frequency:</span> {r.frequency_summary}
                          {r.estimated_visits_per_month && r.billing_type === "per_visit" && (
                            <span className="ml-auto text-[10px]">≈ {r.estimated_visits_per_month} visits/month</span>
                          )}
                        </div>
                      );
                    } catch {}
                    return null;
                  })()}

                  {/* Pricing breakdown */}
                  {(() => {
                    try {
                      const r = JSON.parse(detail.estimate.rawResponse || "{}");
                      if (r.pricing_breakdown?.length) return (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pricing Breakdown</p>
                          <div className="space-y-1">
                            {r.pricing_breakdown.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{item.label}</span>
                                <span className="font-medium">{fmtCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    } catch {}
                    return null;
                  })()}

                  <p className="text-xs text-muted-foreground">Labor: {detail.estimate.laborHours}h · Crew: {detail.estimate.crewSize || "—"}</p>
                  {detail.estimate.suggestedServices && <p className="text-xs bg-purple-50 text-purple-800 rounded p-2">{detail.estimate.suggestedServices}</p>}
                  {detail.estimate.riskNotes && <p className="text-xs text-yellow-700 bg-yellow-50 rounded p-2"><AlertCircle className="inline w-3.5 h-3.5 mr-1" />{detail.estimate.riskNotes}</p>}
                  {detail.estimate.followUpQuestions && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2">{detail.estimate.followUpQuestions}</p>}
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    Confidence: <span className={cn("font-medium", detail.estimate.confidenceLevel === "high" ? "text-green-600" : detail.estimate.confidenceLevel === "low" ? "text-red-500" : "text-yellow-600")}>{detail.estimate.confidenceLevel}</span>
                    {detail.estimate.confidenceNote && <span>— {detail.estimate.confidenceNote}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Form Answers — smart grouped display */}
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-primary" /> Submission Details</h3>
              {(() => {
                const d = detail.data || {};
                const isCommercial = ["Commercial","Industrial / Warehouse"].includes(d.propertyCategory);
                const groups: { label: string; icon: any; color: string; keys: string[] }[] = [
                  { label: "Property", icon: isCommercial ? Building2 : Home, color: isCommercial ? "text-blue-600" : "text-green-600",
                    keys: ["propertyCategory","serviceAddress","city","province","postalCode"] },
                  { label: "Service", icon: Sparkles, color: "text-purple-600",
                    keys: ["serviceType","cleaningFrequency","preferredTime","preferredDate","availabilityNotes"] },
                  { label: isCommercial ? "Commercial Details" : "Property Details", icon: isCommercial ? BarChart3 : Home, color: "text-orange-600",
                    keys: isCommercial
                      ? ["sqft","floorCount","employeeCount","weeklyVisits","operatingHours","businessType","wasteDisposal","cleaningAreas","lastCleaned"]
                      : ["sqft","bedrooms","bathrooms","halfBaths","floors","pets","hasKids","unfurnished"] },
                  { label: "Add-ons & Notes", icon: Plus, color: "text-pink-600",
                    keys: ["addons","specialRequests","howHeard","referral"] },
                ];
                return (
                  <div className="space-y-3">
                    {groups.map(group => {
                      const entries = group.keys.map(k => [k, d[k]]).filter(([,v]) => v !== "" && v !== null && v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0));
                      if (!entries.length) return null;
                      const Icon = group.icon;
                      return (
                        <div key={group.label}>
                          <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${group.color}`}><Icon className="w-3.5 h-3.5" /> {group.label}</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-5">
                            {entries.map(([k, v]) => (
                              <div key={String(k)} className="flex items-start gap-1.5 text-xs">
                                <span className="text-muted-foreground capitalize flex-shrink-0" style={{minWidth:"80px"}}>
                                  {String(k).replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                                </span>
                                <span className="text-foreground font-medium">
                                  {Array.isArray(v) ? v.join(", ") : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {/* Any ungrouped fields */}
                    {(() => {
                      const allGrouped = groups.flatMap(g => g.keys);
                      const extra = Object.entries(d).filter(([k, v]) => !allGrouped.includes(k) && v !== "" && v !== null && v !== undefined && v !== false && !["firstName","lastName","email","phone","companyName"].includes(k));
                      if (!extra.length) return null;
                      return (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold mb-1.5 text-muted-foreground"><FileText className="w-3.5 h-3.5" /> Other</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-5">
                            {extra.map(([k, v]) => (
                              <div key={k} className="flex items-start gap-1.5 text-xs">
                                <span className="text-muted-foreground capitalize flex-shrink-0" style={{minWidth:"80px"}}>{k.replace(/([A-Z])/g, " $1")}</span>
                                <span className="text-foreground font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>

            {/* Notes / Activity */}
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">Internal Notes</h3>
              <div className="space-y-2 mb-3">
                {(detail.activity || []).filter(a => a.eventType === "note").map(a => {
                  let note = "";
                  try { note = JSON.parse(a.eventData).note; } catch {}
                  return (
                    <div key={a.id} className="text-xs bg-muted/50 rounded-lg px-3 py-2">
                      <p>{note}</p>
                      <p className="text-muted-foreground mt-1">{fmtDate(a.createdAt)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Textarea data-testid="input-note" className="text-xs min-h-[60px] flex-1" placeholder="Add internal note…" value={noteInput} onChange={e => setNoteInput(e.target.value)} />
                <Button size="sm" className="self-end" disabled={!noteInput.trim() || noteMutation.isPending}
                  onClick={() => noteMutation.mutate({ id: detail.id, note: noteInput })}>
                  {noteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                </Button>
              </div>
            </div>

            {/* Client Walkthrough Section */}
            {detail.walkthrough && (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-violet-500" /> Client Walkthrough
                  </h3>
                  <div className="flex items-center gap-2">
                    {detail.walkthrough.aiStatus === "pending" || detail.walkthrough.aiStatus === "failed" ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        disabled={processAiMutation.isPending}
                        onClick={() => processAiMutation.mutate(detail.id)}>
                        {processAiMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {detail.walkthrough.aiStatus === "failed" ? "Retry AI" : "Process AI"}
                      </Button>
                    ) : detail.walkthrough.aiStatus === "processing" ? (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> AI processing…</span>
                    ) : null}
                    <Badge variant="outline" className="text-[11px] bg-violet-50 text-violet-700 border-violet-200">
                      {detail.walkthrough.photoCount} photos
                    </Badge>
                  </div>
                </div>

                {/* AI Summary */}
                {detail.walkthrough.aiSummary && (
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 mb-3">
                    {detail.walkthrough.aiTitle && <p className="text-xs font-semibold text-violet-800 mb-1">{detail.walkthrough.aiTitle}</p>}
                    <p className="text-xs text-violet-700 leading-relaxed">{detail.walkthrough.aiSummary}</p>
                  </div>
                )}

                {/* Transcript */}
                {detail.walkthrough.transcript && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
                    <p className="text-[11px] font-medium text-blue-700 flex items-center gap-1 mb-1"><Mic className="w-3 h-3" /> Voice Notes Transcript</p>
                    <p className="text-xs text-blue-800 leading-relaxed">{detail.walkthrough.transcript}</p>
                  </div>
                )}

                {/* Duration */}
                {detail.walkthrough.durationSeconds != null && detail.walkthrough.durationSeconds > 0 && (
                  <p className="text-[11px] text-muted-foreground mb-3">Duration: {Math.floor(detail.walkthrough.durationSeconds / 60)}:{String(detail.walkthrough.durationSeconds % 60).padStart(2, "0")}</p>
                )}

                {/* Sections */}
                {detail.walkthrough.sections.length > 0 && (
                  <div className="space-y-3 mb-3">
                    {detail.walkthrough.sections.map(section => {
                      const sectionPhotoIds = (() => { try { return JSON.parse(section.photoIds) as string[]; } catch { return []; } })();
                      const sectionPhotos = sectionPhotoIds.map(pid => detail.walkthrough!.photos.find(p => p.id === pid)).filter(Boolean) as WalkthroughPhoto[];
                      const isEditing = editingSection === section.id;
                      return (
                        <div key={section.id} className="rounded-lg border bg-background p-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input data-testid={`input-section-title-${section.id}`} value={editSectionTitle} onChange={e => setEditSectionTitle(e.target.value)} placeholder="Section title" className="text-sm" />
                              <Textarea value={editSectionDesc} onChange={e => setEditSectionDesc(e.target.value)} placeholder="Section description" className="text-sm min-h-[60px]" />
                              <Textarea value={editSectionNotes} onChange={e => setEditSectionNotes(e.target.value)} placeholder="Admin notes (internal)" className="text-sm min-h-[48px]" />
                              <div className="flex gap-2">
                                <Button size="sm" className="h-7 text-xs" disabled={editSectionMutation.isPending}
                                  onClick={() => editSectionMutation.mutate({ submissionId: detail.id, sectionId: section.id, title: editSectionTitle, description: editSectionDesc, adminNotes: editSectionNotes })}>
                                  {editSectionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingSection(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-xs font-semibold text-foreground">{section.title}</p>
                                <button data-testid={`button-edit-section-${section.id}`}
                                  onClick={() => { setEditingSection(section.id); setEditSectionTitle(section.title); setEditSectionDesc(section.description); setEditSectionNotes(section.adminNotes || ""); }}
                                  className="text-muted-foreground hover:text-foreground transition-colors">
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{section.description}</p>
                              {section.adminNotes && <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 mb-2">{section.adminNotes}</p>}
                              {sectionPhotos.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                  {sectionPhotos.map(photo => (
                                    <button key={photo.id} data-testid={`img-walkthrough-section-${photo.id}`}
                                      className="w-14 h-14 rounded-md overflow-hidden border border-gray-200 hover:border-violet-400 transition-colors cursor-pointer"
                                      onClick={() => setPreviewPhoto(photo.fileUrl)}>
                                      <img src={photo.fileUrl} alt={photo.aiLabel || ""} className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* All Photos Grid (for walkthroughs with no sections yet) */}
                {detail.walkthrough.sections.length === 0 && detail.walkthrough.photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {detail.walkthrough.photos.map(photo => (
                      <button key={photo.id} data-testid={`img-walkthrough-photo-${photo.id}`}
                        className="aspect-square rounded-md overflow-hidden border border-gray-200 hover:border-violet-400 transition-colors"
                        onClick={() => setPreviewPhoto(photo.fileUrl)}>
                        <img src={photo.fileUrl} alt={photo.aiLabel || ""} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity Timeline */}
            {(detail.activity || []).length > 0 && (
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3">Activity Timeline</h3>
                <div className="space-y-2">
                  {[...(detail.activity || [])].reverse().map(a => {
                    let text = a.eventType.replace(/_/g, " ");
                    let icon = "●";
                    try {
                      const d = JSON.parse(a.eventData);
                      if (a.eventType === "stage_changed") text = `Moved from "${d.from?.replace(/_/g," ")}" to "${d.to?.replace(/_/g," ")}"`;
                      else if (a.eventType === "estimate_completed") text = `Estimate completed — Recommended: ${fmtCurrency(d.recommended)}`;
                      else if (a.eventType === "note") text = `Note added`;
                      else if (a.eventType === "submitted") text = `Submitted via ${d.formName || "form"}`;
                      else if (a.eventType === "email_sent") { text = `Email sent to ${d.to || "client"}${d.subject ? ` — "${d.subject}"` : ""}${!d.emailSent ? " (delivery failed)" : ""}`; icon = "✉"; }
                    } catch {}
                    return (
                      <div key={a.id} className="flex items-start gap-2 text-xs">
                        <div className={cn("w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] mt-0.5",
                          a.eventType === "email_sent" ? "bg-blue-100 text-blue-600" : "bg-primary/10 text-primary/60")}>
                          {icon}
                        </div>
                        <div><p>{text}</p><p className="text-muted-foreground">{fmtDate(a.createdAt)}</p></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Walkthrough Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewPhoto(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setPreviewPhoto(null)}><X className="w-6 h-6" /></button>
          <img src={previewPhoto} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}

      {/* Respond via Email Dialog */}
      <Dialog open={respondOpen} onOpenChange={v => { setRespondOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Respond via Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-medium mb-1 block">To</Label>
              <Input data-testid="input-respond-to" value={respondTo} onChange={e => setRespondTo(e.target.value)} placeholder="client@email.com" />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Subject</Label>
              <Input data-testid="input-respond-subject" value={respondSubject} onChange={e => setRespondSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Message</Label>
              <Textarea data-testid="input-respond-message" value={respondMessage} onChange={e => setRespondMessage(e.target.value)} className="min-h-[160px] text-sm" />
            </div>
            {/* Walkthrough photo selection */}
            {detail?.walkthrough && detail.walkthrough.photos.length > 0 && (
              <div>
                <Label className="text-xs font-medium mb-2 block flex items-center gap-1"><Images className="w-3 h-3" /> Attach walkthrough photos (optional)</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {detail.walkthrough.photos.map(photo => {
                    const selected = respondSelectedPhotoIds.includes(photo.id);
                    return (
                      <button key={photo.id} data-testid={`button-select-photo-${photo.id}`}
                        className={cn("relative aspect-square rounded-md overflow-hidden border-2 transition-all",
                          selected ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
                        onClick={() => setRespondSelectedPhotoIds(prev => selected ? prev.filter(id => id !== photo.id) : [...prev, photo.id])}>
                        <img src={photo.fileUrl} alt="" className="w-full h-full object-cover" />
                        {selected && <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
                      </button>
                    );
                  })}
                </div>
                {respondSelectedPhotoIds.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">{respondSelectedPhotoIds.length} photo{respondSelectedPhotoIds.length !== 1 ? "s" : ""} will be noted in the email</p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRespondOpen(false)}>Cancel</Button>
            <Button data-testid="button-respond-send" className="flex-1 gap-1.5"
              disabled={!respondTo.trim() || !respondSubject.trim() || !respondMessage.trim() || respondMutation.isPending}
              onClick={() => { if (detail) respondMutation.mutate({ id: detail.id, to: respondTo, subject: respondSubject, message: respondMessage }); }}>
              {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────
function PipelineTab() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: submissions = [], isLoading } = useQuery<Submission[]>({ queryKey: ["/api/admin/submissions"] });

  const stageMutation = useMutation({
    mutationFn: ({ id, pipelineStage }: { id: string; pipelineStage: string }) =>
      apiRequest("PATCH", `/api/admin/submissions/${id}`, { pipelineStage }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/submissions"] }),
  });

  const byStage: Record<string, Submission[]> = {};
  PIPELINE_STAGES.forEach(s => { byStage[s.id] = []; });
  submissions.filter(s => !s.archivedAt).forEach(s => { if (byStage[s.pipelineStage]) byStage[s.pipelineStage].push(s); });

  if (isLoading) return <div className="flex gap-3 overflow-x-auto pb-2">{PIPELINE_STAGES.map(s => <Skeleton key={s.id} className="w-48 h-64 rounded-xl flex-shrink-0" />)}</div>;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
      {PIPELINE_STAGES.map(stage => (
        <div key={stage.id} className="w-52 flex-shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", stage.color)}>{stage.label}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{byStage[stage.id].length}</span>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            {byStage[stage.id].length === 0 && (
              <div className="rounded-xl border border-dashed bg-muted/30 h-20 flex items-center justify-center">
                <p className="text-[11px] text-muted-foreground/50">Empty</p>
              </div>
            )}
            {byStage[stage.id].map(sub => (
              <div key={sub.id} data-testid={`pipeline-card-${sub.id}`}
                className="rounded-xl border bg-card p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
                <p className="font-medium text-xs truncate">{sub.clientName || "Unknown Client"}</p>
                {sub.serviceType && <p className="text-[11px] text-muted-foreground truncate">{sub.serviceType}</p>}
                <p className="text-[11px] text-muted-foreground">{fmtDate(sub.submittedAt)}</p>
                <div className="mt-2 pt-2 border-t flex gap-1 flex-wrap">
                  {PIPELINE_STAGES.filter(s => s.id !== stage.id).slice(0,3).map(s => (
                    <button key={s.id} data-testid={`button-move-stage-${sub.id}-${s.id}`}
                      className="text-[9px] border rounded px-1 py-0.5 hover:bg-primary/5 text-muted-foreground transition-colors"
                      onClick={() => stageMutation.mutate({ id: sub.id, pipelineStage: s.id })}>
                      → {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Estimator Settings Tab ─────────────────────────────────────────────────────
function EstimatorSettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pricingTab, setPricingTab] = useState<"residential" | "commercial">("residential");
  const { data: settings, isLoading } = useQuery<any>({ queryKey: ["/api/admin/estimator-settings"] });

  const defaults = {
    // Residential
    hourlyRate: "25", minimumJobPrice: "80", pricePerSqft: "0.08",
    pricePerBathroom: "15", pricePerRoom: "20", kitchenAddOn: "25",
    basementAddOn: "40", petFee: "15",
    deepCleanMultiplier: "1.5", moveInOutMultiplier: "1.75",
    postConstructionMultiplier: "2.0", afterHoursMultiplier: "1.25",
    supplyFee: "15", travelFee: "0", taxRate: "5", profitMargin: "20",
    currency: "CAD", defaultCrewSize: "2", productivityRate: "300",
    serviceAreas: "", customRules: "",
    // Commercial
    commHourlyRate: "35", commMinimumJobPrice: "150", commPricePerSqft: "0.06",
    commPricePerWashroom: "20", commPricePerOffice: "15", commPricePerFloor: "30",
    commKitchenAddOn: "35", commGarbageAddOn: "25", commRestockAddOn: "20",
    commFloorCareAddOn: "50", commWindowCleanAddOn: "45",
    commAfterHoursMultiplier: "1.35", commDailyServiceMultiplier: "0.85",
    commCommercialMultiplier: "1.2", commSupplyFee: "25", commTravelFee: "0",
    commTaxRate: "5", commProfitMargin: "20",
    commDefaultCrewSize: "3", commProductivityRate: "400", commCustomRules: "",
  };

  const [form, setForm] = useState<Record<string, any>>(defaults);
  useEffect(() => {
    if (settings) setForm({ ...defaults, ...Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v ?? ""])) });
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/admin/estimator-settings", data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/estimator-settings"] }); toast({ title: "Settings saved." }); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const f = (key: string, label: string, type = "number") => (
    <div key={key}>
      <Label className="text-xs font-medium mb-1 block">{label}</Label>
      <Input data-testid={`input-${key}`} type={type} className="h-8 text-sm"
        value={form[key] ?? ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );

  const currencySelect = (key: string) => (
    <div key={key}>
      <Label className="text-xs font-medium mb-1 block">Currency</Label>
      <Select value={form[key] || "CAD"} onValueChange={v => setForm(p => ({ ...p, [key]: v }))}>
        <SelectTrigger className="h-8 text-sm" data-testid={`select-${key}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="CAD">CAD</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const commProfileConfigured = !!(settings?.commHourlyRate);

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-primary" />
        <p className="text-sm text-muted-foreground">Separate pricing rules for residential and commercial jobs. The AI estimator picks the right profile automatically.</p>
      </div>

      {/* Residential / Commercial tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        <button
          data-testid="button-tab-residential"
          className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
            pricingTab === "residential" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          onClick={() => setPricingTab("residential")}>
          <Home className="w-3.5 h-3.5" /> Residential Pricing
        </button>
        <button
          data-testid="button-tab-commercial"
          className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
            pricingTab === "commercial" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          onClick={() => setPricingTab("commercial")}>
          <Building2 className="w-3.5 h-3.5" /> Commercial Pricing
          {!commProfileConfigured && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5" title="Not configured yet" />}
        </button>
      </div>

      {pricingTab === "residential" ? (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Home className="w-3.5 h-3.5 text-green-600" /> Base Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              {f("hourlyRate", "Hourly Rate ($)")}
              {f("minimumJobPrice", "Minimum Job Price ($)")}
              {f("pricePerSqft", "Price Per Sq Ft ($)")}
              {f("pricePerBathroom", "Price Per Bathroom ($)")}
              {f("pricePerRoom", "Price Per Bedroom / Room ($)")}
              {f("supplyFee", "Supply Fee ($)")}
              {f("travelFee", "Travel Fee ($)")}
              {f("taxRate", "Tax Rate (%)")}
              {f("profitMargin", "Profit Margin (%)")}
              {currencySelect("currency")}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Add-ons</h3>
            <div className="grid grid-cols-2 gap-4">
              {f("kitchenAddOn", "Kitchen Add-on ($)")}
              {f("basementAddOn", "Basement Add-on ($)")}
              {f("petFee", "Pet Fee ($)")}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Service Multipliers</h3>
            <div className="grid grid-cols-2 gap-4">
              {f("deepCleanMultiplier", "Deep Clean ×")}
              {f("moveInOutMultiplier", "Move-In/Out ×")}
              {f("postConstructionMultiplier", "Post-Construction ×")}
              {f("afterHoursMultiplier", "After-Hours ×")}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Crew & Productivity</h3>
            <div className="grid grid-cols-2 gap-4">
              {f("defaultCrewSize", "Default Crew Size")}
              {f("productivityRate", "Productivity Rate (sq ft / hr / person)")}
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Service Areas</Label>
              <Input data-testid="input-serviceAreas" className="h-8 text-sm" placeholder="e.g. Winnipeg, St. Vital, Transcona"
                value={form.serviceAreas || ""} onChange={e => setForm(p => ({ ...p, serviceAreas: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Custom Pricing Rules</Label>
              <Textarea data-testid="input-customRules" className="text-sm min-h-[80px]" placeholder="e.g. Minimum 2 hours for all deep cleans."
                value={form.customRules || ""} onChange={e => setForm(p => ({ ...p, customRules: e.target.value }))} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!commProfileConfigured && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Commercial pricing is using default values. Save to activate your commercial profile.</span>
            </div>
          )}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-blue-600" /> Base Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              {f("commHourlyRate", "Hourly Rate ($)")}
              {f("commMinimumJobPrice", "Minimum Job Price ($)")}
              {f("commPricePerSqft", "Price Per Sq Ft ($)")}
              {f("commPricePerWashroom", "Price Per Washroom ($)")}
              {f("commPricePerOffice", "Price Per Office / Room ($)")}
              {f("commPricePerFloor", "Price Per Floor ($)")}
              {f("commSupplyFee", "Supply Fee ($)")}
              {f("commTravelFee", "Travel Fee ($)")}
              {f("commTaxRate", "Tax Rate (%)")}
              {f("commProfitMargin", "Profit Margin (%)")}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Add-ons</h3>
            <div className="grid grid-cols-2 gap-4">
              {f("commKitchenAddOn", "Kitchen / Breakroom ($)")}
              {f("commGarbageAddOn", "Garbage Removal ($)")}
              {f("commRestockAddOn", "Restocking Supplies ($)")}
              {f("commFloorCareAddOn", "Floor Care ($)")}
              {f("commWindowCleanAddOn", "Window Cleaning ($)")}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Service Multipliers</h3>
            <div className="grid grid-cols-2 gap-4">
              {f("commCommercialMultiplier", "Commercial ×")}
              {f("commAfterHoursMultiplier", "After-Hours ×")}
              {f("commDailyServiceMultiplier", "Daily Service ×")}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Crew & Productivity</h3>
            <div className="grid grid-cols-2 gap-4">
              {f("commDefaultCrewSize", "Default Crew Size")}
              {f("commProductivityRate", "Productivity Rate (sq ft / hr / person)")}
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Custom Commercial Pricing Rules</Label>
              <Textarea data-testid="input-commCustomRules" className="text-sm min-h-[80px]" placeholder="e.g. Minimum 3-hour visit for all commercial jobs."
                value={form.commCustomRules || ""} onChange={e => setForm(p => ({ ...p, commCustomRules: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      <Button data-testid="button-save-estimator-settings" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-1.5">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save {pricingTab === "residential" ? "Residential" : "Commercial"} Settings
      </Button>
    </div>
  );
}

// ── Email Settings Tab ─────────────────────────────────────────────────────────
const EMAIL_VARS = "{client_first_name}, {client_full_name}, {company_name}, {service_type}, {service_address}, {estimated_price}, {submission_date}";

function EmailSettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery<any>({ queryKey: ["/api/admin/form-email-settings"] });

  const [form, setForm] = useState<Record<string, any>>({
    confirmationEnabled: true,
    confirmationSubject: "We received your request!",
    confirmationBody: "Hi {client_first_name},\n\nThank you for reaching out to {company_name}! We've received your request and will get back to you shortly with a quote.\n\nBest regards,\n{company_name}",
    estimateEnabled: false,
    estimateSubject: "Your estimate from {company_name}",
    estimateBody: "Hi {client_first_name},\n\nHere is your estimate: {estimated_price}\n\nBest regards,\n{company_name}",
    quoteReadyEnabled: false,
    quoteReadySubject: "Your quote is ready — {company_name}",
    quoteReadyBody: "Hi {client_first_name},\n\nYour quote is ready. Please contact us to review.\n\nBest regards,\n{company_name}",
    replyTo: "", signature: "",
  });

  useEffect(() => { if (settings) setForm(prev => ({ ...prev, ...Object.fromEntries(Object.entries(settings).filter(([,v]) => v !== null)) })); }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/admin/form-email-settings", data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/form-email-settings"] }); toast({ title: "Email settings saved." }); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const emailSection = (title: string, enabledKey: string, subjectKey: string, bodyKey: string, note?: string) => (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{form[enabledKey] ? "Enabled" : "Disabled"}</span>
          <Switch data-testid={`switch-${enabledKey}`} checked={!!form[enabledKey]} onCheckedChange={v => set(enabledKey, v)} className="scale-75" />
        </div>
      </div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      {form[enabledKey] && (
        <>
          <div>
            <Label className="text-xs font-medium mb-1 block">Subject</Label>
            <Input data-testid={`input-${subjectKey}`} className="h-8 text-sm" value={form[subjectKey] || ""} onChange={e => set(subjectKey, e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1 block">Body</Label>
            <Textarea data-testid={`input-${bodyKey}`} className="text-sm min-h-[120px]" value={form[bodyKey] || ""} onChange={e => set(bodyKey, e.target.value)} />
          </div>
        </>
      )}
    </div>
  );

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="w-4 h-4 text-primary" />
        <span>Available variables: <code className="text-[11px] bg-muted px-1 rounded">{EMAIL_VARS}</code></span>
      </div>
      {emailSection("Confirmation Email", "confirmationEnabled", "confirmationSubject", "confirmationBody",
        "Sent immediately when a form is submitted.")}
      {emailSection("Estimate Summary Email", "estimateEnabled", "estimateSubject", "estimateBody",
        "Sent after an AI estimate is completed (manual trigger).")}
      {emailSection("Quote Ready Email", "quoteReadyEnabled", "quoteReadySubject", "quoteReadyBody",
        "Sent when a quote is marked as ready for the client.")}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Reply-To & Signature</h3>
        <div>
          <Label className="text-xs font-medium mb-1 block">Reply-To Email</Label>
          <Input data-testid="input-replyTo" className="h-8 text-sm" type="email" placeholder="your@email.com" value={form.replyTo || ""} onChange={e => set("replyTo", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Email Signature</Label>
          <Textarea data-testid="input-signature" className="text-sm min-h-[60px]" placeholder="Best regards,&#10;Your Team" value={form.signature || ""} onChange={e => set("signature", e.target.value)} />
        </div>
      </div>
      <Button data-testid="button-save-email-settings" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-1.5">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Email Settings
      </Button>
    </div>
  );
}

// ── Embed Tab ─────────────────────────────────────────────────────────────────
function EmbedTab() {
  const { toast } = useToast();
  const { data: forms = [] } = useQuery<QuoteForm[]>({ queryKey: ["/api/admin/quote-forms"] });
  const [selectedForm, setSelectedForm] = useState("");
  const form = forms.find(f => f.id === selectedForm);

  useEffect(() => { if (forms.length > 0 && !selectedForm) setSelectedForm(forms[0].id); }, [forms]);

  const publicUrl = form ? `${window.location.origin}/form/${form.companyId}/${form.slug}` : "";
  const embedUrl = form ? `${publicUrl}?embed=true` : "";
  const embedCode = form ? `<iframe src="${embedUrl}" width="100%" height="900" frameborder="0" style="border:none; width:100%; max-width:100%;"></iframe>` : "";

  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast({ title: `${label} copied!` }); };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Select Form</Label>
        <Select value={selectedForm} onValueChange={setSelectedForm}>
          <SelectTrigger className="w-72" data-testid="select-embed-form"><SelectValue placeholder="Choose a form…" /></SelectTrigger>
          <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {form && (
        <>
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><ExternalLink className="w-4 h-4" /> Public Link</h3>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted rounded px-3 py-2 flex-1 overflow-x-auto">{publicUrl}</code>
              <Button size="sm" variant="outline" className="gap-1 h-8 flex-shrink-0" onClick={() => copy(publicUrl, "Link")}>
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1 h-8"><Eye className="w-3.5 h-3.5" /> Preview</Button>
              </a>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Code2 className="w-4 h-4" /> Embed Code</h3>
            <p className="text-xs text-muted-foreground">Paste this code into any website to embed the form.</p>
            <div className="relative">
              <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{embedCode}</pre>
              <Button size="sm" variant="outline" className="absolute top-2 right-2 gap-1 h-7 text-xs" onClick={() => copy(embedCode, "Embed code")}>
                <Copy className="w-3 h-3" /> Copy
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>The form is responsive and mobile-friendly. Adjust the <code>height</code> attribute as needed.</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Hub Page ─────────────────────────────────────────────────────────────
export default function AdminQuoteForms() {
  const { data: submissions = [] } = useQuery<Submission[]>({ queryKey: ["/api/admin/submissions"] });
  const newCount = submissions.filter(s => s.pipelineStage === "new_request" && !s.archivedAt).length;
  const [activeTab, setActiveTab] = useState("forms");

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-4 md:px-6 py-3.5 flex items-center gap-3">
        <ClipboardList className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-base font-semibold leading-none">Forms / Quote Requests</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Build forms, manage leads, estimate pricing</p>
        </div>
        {newCount > 0 && (
          <Badge className="ml-auto bg-blue-600 text-white text-xs">{newCount} New</Badge>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b bg-background px-4 md:px-6">
            <TabsList className="h-9 bg-transparent border-0 p-0 gap-1">
              {[
                { value: "forms",     label: "Forms",             icon: FileText },
                { value: "submissions",label: "Submissions",       icon: Inbox,   badge: newCount },
                { value: "pipeline",  label: "Pipeline",          icon: GitBranch },
                { value: "estimator", label: "Estimator Settings", icon: Zap },
                { value: "email",     label: "Email Settings",     icon: Mail },
                { value: "embed",     label: "Embed",              icon: Code2 },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}
                  className="flex items-center gap-1.5 text-xs h-9 px-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent">
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.badge ? <span className="ml-0.5 bg-blue-600 text-white rounded-full text-[9px] px-1.5 py-0.5 leading-none">{t.badge}</span> : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
            <TabsContent value="forms" className="mt-0"><FormsTab /></TabsContent>
            <TabsContent value="submissions" className="mt-0 h-full"><SubmissionsTab onGoToEstimator={() => setActiveTab("estimator")} /></TabsContent>
            <TabsContent value="pipeline" className="mt-0"><PipelineTab /></TabsContent>
            <TabsContent value="estimator" className="mt-0"><EstimatorSettingsTab /></TabsContent>
            <TabsContent value="email" className="mt-0"><EmailSettingsTab /></TabsContent>
            <TabsContent value="embed" className="mt-0"><EmbedTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
