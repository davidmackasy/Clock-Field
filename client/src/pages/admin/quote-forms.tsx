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
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type QuoteForm = { id: string; name: string; slug: string; companyId: string; isActive: boolean; createdAt: string; config: any };
type Submission = {
  id: string; formId: string; formName: string; companyId: string;
  data: Record<string, any>; status: string; submittedAt: string;
  clientName?: string; clientEmail?: string; clientPhone?: string;
  serviceType?: string; serviceAddress?: string;
  pipelineStage: string; estimateStatus: string; adminNotes?: string; archivedAt?: string;
  estimate?: any; quote?: any; activity?: any[];
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
  const [deleteTarget, setDeleteTarget] = useState<QuoteForm | null>(null);

  const { data: forms = [], isLoading } = useQuery<QuoteForm[]>({ queryKey: ["/api/admin/quote-forms"] });

  const createMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/admin/quote-forms", { name }).then(r => r.json()),
    onSuccess: (form) => { qc.invalidateQueries({ queryKey: ["/api/admin/quote-forms"] }); setCreateOpen(false); setNewName(""); navigate(`/admin/quote-forms/${form.id}`); },
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
                      <p className="font-semibold text-sm truncate leading-tight">{form.name}</p>
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

      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setNewName(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary" /> New Form</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Form Name</Label>
              <Input data-testid="input-new-form-name" placeholder="e.g. Residential Cleaning Request" value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate(newName.trim()); }} autoFocus />
              <p className="text-[11px] text-muted-foreground mt-1">URL: /form/…/{newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "form"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button data-testid="button-create-form-confirm" className="flex-1" disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newName.trim())}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null} Create & Edit
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
function SubmissionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("all");
  const [noteInput, setNoteInput] = useState("");

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({ queryKey: ["/api/admin/submissions"] });
  const { data: detail } = useQuery<Submission>({
    queryKey: ["/api/admin/submissions", selectedId],
    queryFn: async () => { if (!selectedId) throw new Error(); const r = await fetch(`/api/admin/submissions/${selectedId}`, { credentials: "include" }); return r.json(); },
    enabled: !!selectedId,
  });

  const estimateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/submissions/${id}/estimate`, {}).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/submissions"] }); qc.invalidateQueries({ queryKey: ["/api/admin/submissions", selectedId] }); },
    onError: (e: any) => toast({ title: "Estimate failed", description: e.message, variant: "destructive" }),
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
                <p className="text-[11px] text-muted-foreground">{fmtDate(sub.submittedAt)}</p>
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
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base">{detail.clientName || "Unknown Client"}</h2>
                <div className="flex items-center gap-3 flex-wrap mt-0.5">
                  {detail.clientEmail && <span className="text-xs text-muted-foreground">{detail.clientEmail}</span>}
                  {detail.clientPhone && <span className="text-xs text-muted-foreground">{detail.clientPhone}</span>}
                </div>
              </div>
              {stageBadge(detail.pipelineStage)}
            </div>

            {/* Info row */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {detail.serviceType && <div className="flex items-center gap-1.5 text-muted-foreground"><FileText className="w-3.5 h-3.5" /> {detail.serviceType}</div>}
              {detail.serviceAddress && <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> {detail.serviceAddress}</div>}
              <div className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="w-3.5 h-3.5" /> {fmtDate(detail.submittedAt)}</div>
              <div className="flex items-center gap-1.5 text-muted-foreground"><ClipboardList className="w-3.5 h-3.5" /> {detail.formName}</div>
            </div>

            {/* Pipeline stage */}
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

            {/* AI Estimate */}
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Zap className="w-4 h-4 text-purple-500" /> AI Estimate</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  data-testid="button-run-estimate"
                  disabled={estimateMutation.isPending}
                  onClick={() => estimateMutation.mutate(detail.id)}>
                  {estimateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                  {detail.estimate ? "Re-run" : "Run Estimate"}
                </Button>
              </div>
              {!detail.estimate ? (
                <p className="text-xs text-muted-foreground">No estimate yet. Click "Run Estimate" to use AI pricing.</p>
              ) : detail.estimate.status === "failed" ? (
                <p className="text-xs text-red-500 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> {detail.estimate.errorMessage || "Estimate failed"}</p>
              ) : detail.estimate.status === "running" ? (
                <p className="text-xs text-blue-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running AI estimate…</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Range:</span>
                    <span className="font-semibold">{fmtCurrency(detail.estimate.priceMin)} – {fmtCurrency(detail.estimate.priceMax)}</span>
                    <span className="text-muted-foreground">Recommended:</span>
                    <span className="font-bold text-green-700">{fmtCurrency(detail.estimate.recommendedPrice)}</span>
                  </div>
                  {detail.estimate.laborHours && <p className="text-xs text-muted-foreground">Labor: {detail.estimate.laborHours}h, Crew: {detail.estimate.crewSize || "—"}</p>}
                  {detail.estimate.suggestedServices && <p className="text-xs"><span className="font-medium">Suggested: </span>{detail.estimate.suggestedServices}</p>}
                  {detail.estimate.riskNotes && <p className="text-xs text-yellow-700 bg-yellow-50 rounded p-2"><AlertCircle className="inline w-3.5 h-3.5 mr-1" />{detail.estimate.riskNotes}</p>}
                  {detail.estimate.followUpQuestions && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2">{detail.estimate.followUpQuestions}</p>}
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    Confidence: <span className={cn("font-medium", detail.estimate.confidenceLevel === "high" ? "text-green-600" : detail.estimate.confidenceLevel === "low" ? "text-red-500" : "text-yellow-600")}>{detail.estimate.confidenceLevel}</span>
                    {detail.estimate.confidenceNote && <span>— {detail.estimate.confidenceNote}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Form Answers */}
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-primary" /> Form Answers</h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(detail.data || {}).filter(([,v]) => v !== "" && v !== null && v !== undefined && v !== false).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground capitalize w-28 flex-shrink-0">{k.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</span>
                    <span className="text-foreground">{String(v)}</span>
                  </div>
                ))}
              </div>
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

            {/* Activity Timeline */}
            {(detail.activity || []).length > 0 && (
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3">Activity Timeline</h3>
                <div className="space-y-2">
                  {[...(detail.activity || [])].reverse().map(a => {
                    let text = a.eventType.replace(/_/g, " ");
                    try {
                      const d = JSON.parse(a.eventData);
                      if (a.eventType === "stage_changed") text = `Moved from "${d.from?.replace(/_/g," ")}" to "${d.to?.replace(/_/g," ")}"`;
                      else if (a.eventType === "estimate_completed") text = `Estimate completed — Recommended: ${fmtCurrency(d.recommended)}`;
                      else if (a.eventType === "note") text = `Note added`;
                      else if (a.eventType === "submitted") text = `Submitted via ${d.formName || "form"}`;
                    } catch {}
                    return (
                      <div key={a.id} className="flex items-start gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 flex-shrink-0" />
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
  const { data: settings, isLoading } = useQuery<any>({ queryKey: ["/api/admin/estimator-settings"] });

  const defaults = {
    hourlyRate: "25", minimumJobPrice: "80", pricePerSqft: "0.08",
    pricePerBathroom: "15", pricePerRoom: "20",
    deepCleanMultiplier: "1.5", moveInOutMultiplier: "1.75",
    postConstructionMultiplier: "2.0", commercialMultiplier: "1.2",
    afterHoursMultiplier: "1.25", supplyFee: "15", travelFee: "0",
    taxRate: "5", profitMargin: "20", currency: "CAD",
    defaultCrewSize: "2", productivityRate: "300",
    serviceAreas: "", customRules: "",
  };

  const [form, setForm] = useState<Record<string, any>>(defaults);
  useEffect(() => { if (settings) setForm({ ...defaults, ...Object.fromEntries(Object.entries(settings).map(([k,v]) => [k, v ?? ""])) }); }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/admin/estimator-settings", data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/estimator-settings"] }); toast({ title: "Settings saved." }); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const field = (key: string, label: string, type = "number", placeholder = "") => (
    <div key={key}>
      <Label className="text-xs font-medium mb-1 block">{label}</Label>
      <Input data-testid={`input-${key}`} type={type} className="h-8 text-sm" placeholder={placeholder}
        value={form[key] ?? ""}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );

  if (isLoading) return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-primary" />
        <p className="text-sm text-muted-foreground">Set your pricing rules. The AI estimator uses these values when generating quotes.</p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold">Base Pricing</h3>
        <div className="grid grid-cols-2 gap-4">
          {field("hourlyRate", "Hourly Rate ($)")}
          {field("minimumJobPrice", "Minimum Job Price ($)")}
          {field("pricePerSqft", "Price Per Sq Ft ($)")}
          {field("pricePerBathroom", "Price Per Bathroom ($)")}
          {field("pricePerRoom", "Price Per Room ($)")}
          {field("supplyFee", "Supply Fee ($)")}
          {field("travelFee", "Travel Fee ($)")}
          {field("taxRate", "Tax Rate (%)")}
          {field("profitMargin", "Profit Margin (%)")}
          <div>
            <Label className="text-xs font-medium mb-1 block">Currency</Label>
            <Select value={form.currency || "CAD"} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold">Service Multipliers</h3>
        <div className="grid grid-cols-2 gap-4">
          {field("deepCleanMultiplier", "Deep Clean ×")}
          {field("moveInOutMultiplier", "Move-In/Out ×")}
          {field("postConstructionMultiplier", "Post-Construction ×")}
          {field("commercialMultiplier", "Commercial ×")}
          {field("afterHoursMultiplier", "After-Hours ×")}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold">Crew & Productivity</h3>
        <div className="grid grid-cols-2 gap-4">
          {field("defaultCrewSize", "Default Crew Size")}
          {field("productivityRate", "Productivity Rate (sq ft / hr / person)")}
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Service Areas</Label>
          <Input data-testid="input-serviceAreas" className="h-8 text-sm" placeholder="e.g. Winnipeg, St. Vital, Transcona"
            value={form.serviceAreas || ""} onChange={e => setForm(p => ({ ...p, serviceAreas: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Custom Pricing Rules</Label>
          <Textarea data-testid="input-customRules" className="text-sm min-h-[80px]" placeholder="e.g. Add $25 for homes with pets. Minimum 2 hours for all deep cleans."
            value={form.customRules || ""} onChange={e => setForm(p => ({ ...p, customRules: e.target.value }))} />
        </div>
      </div>

      <Button data-testid="button-save-estimator-settings" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-1.5">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
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
        <Tabs defaultValue="forms" className="h-full flex flex-col">
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
            <TabsContent value="submissions" className="mt-0 h-full"><SubmissionsTab /></TabsContent>
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
