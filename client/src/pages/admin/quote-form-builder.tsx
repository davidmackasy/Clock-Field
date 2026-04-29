import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Copy, ExternalLink, Eye, EyeOff,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, ClipboardList,
  Mail, Phone, User, MapPin, Wrench, FileText, Star,
  MoreVertical, Inbox, Home, Building2, Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { FormConfig, FormStep, FormField } from "@shared/schema";

type QuoteForm = {
  id: string; name: string; slug: string; companyId: string;
  isActive: boolean; createdAt: string; config: FormConfig;
};

type Submission = {
  id: string; data: Record<string, any>; status: string; submittedAt: string;
};

const STEP_ICONS: Record<string, React.ElementType> = {
  contact: User, address: MapPin, service: Wrench, details: Home, extras: FileText,
};

const STATUS_CONFIG = {
  new: { label: "New", class: "bg-blue-100 text-blue-700 border-blue-200" },
  contacted: { label: "Contacted", class: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  converted: { label: "Converted", class: "bg-green-100 text-green-700 border-green-200" },
};

const VISIBILITY_COLORS: Record<string, string> = {
  always: "bg-gray-300",
  residential_only: "bg-green-400",
  commercial_only: "bg-blue-400",
};
const VISIBILITY_LABELS: Record<string, string> = {
  always: "Shared",
  residential_only: "Residential",
  commercial_only: "Commercial",
};

// Determine if a field should be visible given the current preview modes
function isFieldVisibleInPreview(
  field: FormField,
  previewMode: "all" | "residential" | "commercial",
  previewFrequency: string,
): boolean {
  // 1. Residential / Commercial rule
  if (previewMode !== "all") {
    const rule = field.visibilityRule ?? "always";
    if (rule === "residential_only" && previewMode !== "residential") return false;
    if (rule === "commercial_only" && previewMode !== "commercial") return false;
  }
  // 2. Frequency show-when rule
  if (field.showWhenField === "frequencyType" && field.showWhenValues) {
    if (previewFrequency === "all") return true; // show all in "all frequency" mode
    return field.showWhenValues.includes(previewFrequency);
  }
  // 3. Other showWhenField — just show when in "all" mode
  if (field.showWhenField) return previewFrequency === "all";
  return true;
}

function FieldRow({ field, onChange }: {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
}) {
  const rule = field.visibilityRule ?? "always";
  const dotColor = VISIBILITY_COLORS[rule] ?? "bg-gray-300";

  return (
    <div className={cn("flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm", !field.enabled && "opacity-40")}>
      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", dotColor)} title={VISIBILITY_LABELS[rule] ?? "Shared"} />
      <Switch
        data-testid={`switch-field-enabled-${field.id}`}
        checked={field.enabled}
        onCheckedChange={v => onChange({ enabled: v })}
        className="scale-75 flex-shrink-0"
      />
      <span className="flex-1 text-xs text-foreground truncate">{field.label}</span>
      {field.enabled && (
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={field.required}
            onChange={e => onChange({ required: e.target.checked })}
            className="w-3 h-3"
          />
          Req
        </label>
      )}
    </div>
  );
}

function PreviewField({ field }: { field: FormField }) {
  const base = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-500 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50";
  return (
    <div className={cn("flex flex-col gap-1", field.column === "half" ? "w-full" : "w-full")}>
      <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </label>
      {field.type === "select" ? (
        <select className={base} disabled>
          <option value="">Select…</option>
          {(field.options ?? []).map(o => <option key={o}>{o}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea className={cn(base, "min-h-[60px] resize-none")} disabled placeholder={field.placeholder} />
      ) : field.type === "checkbox" ? (
        <label className="flex items-center gap-2 cursor-default">
          <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
          <span className="text-xs text-gray-500">{field.label}</span>
        </label>
      ) : (
        <input type="text" className={base} disabled placeholder={field.placeholder ?? field.label} />
      )}
    </div>
  );
}

const FREQ_OPTIONS = ["all", "One-time", "Weekly", "Bi-weekly", "Monthly", "Custom schedule"] as const;
type FreqOption = typeof FREQ_OPTIONS[number];

function FormPreview({ config, brandColor }: { config: FormConfig; brandColor?: string }) {
  const [activeStep, setActiveStep] = useState(0);
  const [previewMode, setPreviewMode] = useState<"all" | "residential" | "commercial">("all");
  const [previewFrequency, setPreviewFrequency] = useState<FreqOption>("all");
  const enabledSteps = config.steps.filter(s => s.enabled);
  const step = enabledSteps[activeStep];
  const color = brandColor || "#6366f1";

  const isSmartForm = config.smartMode === "cleaning";
  const hasFrequencyFields = config.steps.some(s => s.fields.some(f => f.showWhenField === "frequencyType"));

  if (!step) return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      No enabled steps
    </div>
  );

  const visibleFields = step.fields.filter(f => f.enabled && isFieldVisibleInPreview(f, previewMode, previewFrequency));
  const rows: FormField[][] = [];
  let i = 0;
  while (i < visibleFields.length) {
    const f = visibleFields[i];
    if (f.column === "half" && visibleFields[i + 1]?.column === "half") {
      rows.push([f, visibleFields[i + 1]]);
      i += 2;
    } else {
      rows.push([f]);
      i++;
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 h-full overflow-y-auto">
      {/* Res/Com preview mode selector */}
      {isSmartForm && (
        <div className="flex items-center gap-1 mb-2 bg-white rounded-lg border p-1">
          {(["all", "residential", "commercial"] as const).map(m => (
            <button key={m}
              className={cn("flex-1 text-[10px] py-1 px-1.5 rounded-md font-medium capitalize transition-all",
                previewMode === m ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setPreviewMode(m)}>
              {m === "all" ? "All" : m === "residential" ? <><Home className="w-2.5 h-2.5 inline mr-0.5" />Residential</> : <><Building2 className="w-2.5 h-2.5 inline mr-0.5" />Commercial</>}
            </button>
          ))}
        </div>
      )}
      {/* Frequency preview selector */}
      {hasFrequencyFields && (
        <div className="flex items-center gap-1 mb-3 bg-white rounded-lg border p-1 flex-wrap">
          {FREQ_OPTIONS.map(f => (
            <button key={f}
              className={cn("text-[9px] py-0.5 px-1.5 rounded-md font-medium whitespace-nowrap transition-all",
                previewFrequency === f ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setPreviewFrequency(f)}>
              {f === "all" ? "All Freq." : f}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-sm mx-auto">
        <div className="text-center mb-4">
          <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ background: color }}>
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs text-gray-500">Your Company</p>
        </div>

        <div className="flex gap-1 mb-4">
          {enabledSteps.map((s, idx) => (
            <button key={s.id}
              className="flex-1 h-1.5 rounded-full transition-all"
              style={{ background: idx <= activeStep ? color : "#e5e7eb" }}
              onClick={() => setActiveStep(idx)}
            />
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Step {activeStep + 1} of {enabledSteps.length}</p>
            <h3 className="font-semibold text-gray-900 text-sm">{step.title}</h3>
          </div>
          <div className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No visible fields for this preview mode</p>
            ) : rows.map((row, ri) => (
              <div key={ri} className={cn("flex gap-2", row.length === 2 ? "flex-row" : "flex-col")}>
                {row.map(f => <PreviewField key={f.id} field={f} />)}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            {activeStep > 0 && (
              <button className="flex-1 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => setActiveStep(p => p - 1)}>← Back</button>
            )}
            <button
              className="flex-1 py-2 rounded-lg text-sm text-white font-medium"
              style={{ background: color }}
              onClick={() => activeStep < enabledSteps.length - 1 && setActiveStep(p => p + 1)}>
              {activeStep === enabledSteps.length - 1 ? "Submit Request →" : "Next →"}
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-3">Powered by Clockfield</p>
      </div>
    </div>
  );
}

function SubmissionRow({ sub, onStatusChange }: { sub: Submission; onStatusChange: (status: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[sub.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
  const d = sub.data;

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {[d.firstName, d.lastName].filter(Boolean).join(" ") || d.email || "Anonymous"}
          </p>
          <p className="text-[11px] text-muted-foreground">{d.email} · {format(parseISO(sub.submittedAt), "MMM d, yyyy h:mm a")}</p>
        </div>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", cfg.class)}>{cfg.label}</Badge>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 bg-muted/10 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {Object.entries(d).filter(([, v]) => v !== undefined && v !== "" && v !== false).map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                <p className="text-xs font-medium truncate">{String(v)}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">Update status:</span>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <button key={key}
                className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                  sub.status === key ? val.class : "text-muted-foreground border-border hover:bg-muted")}
                onClick={() => onStatusChange(key)}>
                {val.label}
              </button>
            ))}
            {d.email && (
              <a href={`mailto:${d.email}`} className="ml-auto flex items-center gap-1 text-[11px] text-primary hover:underline">
                <Mail className="w-3 h-3" /> Reply
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Groups fields by visibilityRule for grouped display in the builder panel
function StepFieldGroups({ step, stepIndex, updateField }: {
  step: FormStep; stepIndex: number;
  updateField: (si: number, fi: number, updates: Partial<FormField>) => void;
}) {
  const hasConditional = step.fields.some(f => f.visibilityRule && f.visibilityRule !== "always");

  if (!hasConditional) {
    return (
      <div className="mx-2 mt-0.5 pl-2 border-l-2 border-muted ml-4">
        {step.fields.map((field, fi) => (
          <FieldRow key={field.id} field={field} onChange={updates => updateField(stepIndex, fi, updates)} />
        ))}
      </div>
    );
  }

  // Group into shared / residential / commercial
  const groups: { rule: string; label: string; icon: React.ElementType; color: string; fields: { field: FormField; fi: number }[] }[] = [
    { rule: "always", label: "Shared", icon: FileText, color: "text-gray-500", fields: [] },
    { rule: "residential_only", label: "Residential", icon: Home, color: "text-green-600", fields: [] },
    { rule: "commercial_only", label: "Commercial", icon: Building2, color: "text-blue-600", fields: [] },
  ];
  step.fields.forEach((field, fi) => {
    const rule = field.visibilityRule ?? "always";
    const g = groups.find(g => g.rule === rule) ?? groups[0];
    g.fields.push({ field, fi });
  });

  return (
    <div className="mx-2 mt-0.5 ml-4 space-y-1">
      {groups.filter(g => g.fields.length > 0).map(group => {
        const Icon = group.icon;
        return (
          <div key={group.rule}>
            <div className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${group.color}`}>
              <Icon className="w-2.5 h-2.5" /> {group.label}
            </div>
            <div className="pl-2 border-l-2 border-muted">
              {group.fields.map(({ field, fi }) => (
                <FieldRow key={field.id} field={field} onChange={updates => updateField(stepIndex, fi, updates)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminQuoteFormBuilder() {
  const [, params] = useRoute("/admin/quote-forms/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const id = params?.id ?? "";
  const [tab, setTab] = useState<"builder" | "submissions">("builder");
  const [localConfig, setLocalConfig] = useState<FormConfig | null>(null);
  const [localName, setLocalName] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data: form, isLoading } = useQuery<QuoteForm>({
    queryKey: ["/api/admin/quote-forms", id],
    queryFn: () => apiRequest("GET", `/api/admin/quote-forms/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: submissions = [], isLoading: subsLoading } = useQuery<Submission[]>({
    queryKey: ["/api/admin/quote-forms", id, "submissions"],
    queryFn: () => apiRequest("GET", `/api/admin/quote-forms/${id}/submissions`).then(r => r.json()),
    enabled: !!id && tab === "submissions",
  });

  useEffect(() => {
    if (form && !localConfig) {
      setLocalConfig(form.config);
      setLocalName(form.name);
    }
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/quote-forms/${id}`, {
      name: localName, config: localConfig,
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quote-forms"] });
      setDirty(false);
      toast({ title: "Form saved." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ subId, status }: { subId: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/quote-forms/${id}/submissions/${subId}`, { status }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/quote-forms", id, "submissions"] }),
  });

  const updateStep = (stepIndex: number, updates: Partial<FormStep>) => {
    if (!localConfig) return;
    const steps = [...localConfig.steps];
    steps[stepIndex] = { ...steps[stepIndex], ...updates };
    setLocalConfig({ ...localConfig, steps });
    setDirty(true);
  };

  const updateField = (stepIndex: number, fieldIndex: number, updates: Partial<FormField>) => {
    if (!localConfig) return;
    const steps = [...localConfig.steps];
    const fields = [...steps[stepIndex].fields];
    fields[fieldIndex] = { ...fields[fieldIndex], ...updates };
    steps[stepIndex] = { ...steps[stepIndex], fields };
    setLocalConfig({ ...localConfig, steps });
    setDirty(true);
  };

  const publicUrl = form ? `${window.location.origin}/form/${form.companyId}/${form.slug}` : "";
  const isSmartForm = localConfig?.smartMode === "cleaning";

  if (isLoading || !localConfig) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-4 md:px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0"
          onClick={() => navigate("/admin/quote-forms")} data-testid="button-back-to-forms">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            data-testid="input-form-name"
            value={localName}
            onChange={e => { setLocalName(e.target.value); setDirty(true); }}
            className="h-7 text-sm font-semibold border-0 shadow-none focus-visible:ring-0 px-0 max-w-xs"
          />
          {isSmartForm && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 flex-shrink-0">
              <Sparkles className="w-2.5 h-2.5" /> Smart
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary px-2 py-1 rounded transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Preview
          </a>
          <Button data-testid="button-copy-form-link" variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
            onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: "Link copied!" }); }}>
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>
          <Button data-testid="button-save-form" size="sm" className="gap-1.5 h-7 text-xs"
            disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {dirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-4 md:px-6 flex gap-4">
        {(["builder", "submissions"] as const).map(t => (
          <button key={t} data-testid={`tab-${t}`}
            className={cn("py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            onClick={() => setTab(t)}>
            {t === "submissions" ? `Submissions (${submissions.length})` : "Builder"}
          </button>
        ))}
      </div>

      {tab === "builder" ? (
        <div className="flex-1 flex min-h-0 gap-0">
          {/* Left panel */}
          <div className="w-72 border-r flex flex-col overflow-hidden flex-shrink-0">
            <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center gap-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex-1">Form Steps & Fields</p>
              {isSmartForm && (
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Shared</span>
                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Res</span>
                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Com</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {localConfig.steps.map((step, si) => {
                const Icon = STEP_ICONS[step.id] ?? FileText;
                return (
                  <div key={step.id} className="mb-1">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 mx-2 rounded-lg">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium truncate">{step.title}</span>
                      <Switch data-testid={`switch-step-enabled-${step.id}`} checked={step.enabled}
                        onCheckedChange={v => updateStep(si, { enabled: v })} className="scale-75" />
                    </div>
                    {step.enabled && (
                      <StepFieldGroups step={step} stepIndex={si} updateField={updateField} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel — Live Preview */}
          <div className="flex-1 p-4 min-h-0 overflow-hidden">
            <div className="h-full">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Live Preview
                </p>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Click segments to preview steps
                </span>
              </div>
              <div className="h-[calc(100%-32px)]">
                <FormPreview config={localConfig} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {subsLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No submissions yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Share your form link to start receiving requests.</p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5"
                onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: "Link copied!" }); }}>
                <Copy className="w-3.5 h-3.5" /> Copy Form Link
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {submissions.map(sub => (
                <SubmissionRow key={sub.id} sub={sub}
                  onStatusChange={status => statusMutation.mutate({ subId: sub.id, status })} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
