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
  MoreVertical, Inbox,
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
  contact: User, address: MapPin, service: Wrench, extras: FileText,
};

const STATUS_CONFIG = {
  new: { label: "New", class: "bg-blue-100 text-blue-700 border-blue-200" },
  contacted: { label: "Contacted", class: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  converted: { label: "Converted", class: "bg-green-100 text-green-700 border-green-200" },
};

function FieldRow({ field, onChange }: {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
}) {
  return (
    <div className={cn("flex items-center gap-2 py-2 px-2 rounded-lg text-sm", !field.enabled && "opacity-50")}>
      <Switch
        data-testid={`switch-field-enabled-${field.id}`}
        checked={field.enabled}
        onCheckedChange={v => onChange({ enabled: v })}
        className="scale-75 flex-shrink-0"
      />
      <span className="flex-1 text-sm text-foreground truncate">{field.label}</span>
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
        <textarea className={cn(base, "resize-none h-20")} placeholder={field.placeholder} disabled />
      ) : field.type === "checkbox" ? (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-not-allowed">
          <input type="checkbox" className="w-4 h-4" disabled />
          {field.label}
        </label>
      ) : (
        <input type={field.type} className={base} placeholder={field.placeholder} disabled />
      )}
    </div>
  );
}

function FormPreview({ config, brandColor }: { config: FormConfig; brandColor?: string }) {
  const [activeStep, setActiveStep] = useState(0);
  const enabledSteps = config.steps.filter(s => s.enabled);
  const step = enabledSteps[activeStep];
  const color = brandColor || "#6366f1";

  if (!step) return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      No enabled steps
    </div>
  );

  const enabledFields = step.fields.filter(f => f.enabled);
  const halfFields: FormField[][] = [];
  const rows: FormField[][] = [];
  let i = 0;
  while (i < enabledFields.length) {
    const f = enabledFields[i];
    if (f.column === "half" && enabledFields[i + 1]?.column === "half") {
      rows.push([f, enabledFields[i + 1]]);
      i += 2;
    } else {
      rows.push([f]);
      i++;
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 h-full overflow-y-auto">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-4">
          <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ background: color }}>
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs text-gray-500">Your Company</p>
        </div>

        <div className="flex gap-1 mb-4">
          {enabledSteps.map((s, idx) => (
            <button
              key={s.id}
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
            {rows.map((row, ri) => (
              <div key={ri} className={cn("flex gap-2", row.length === 2 ? "flex-row" : "flex-col")}>
                {row.map(f => <PreviewField key={f.id} field={f} />)}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            {activeStep > 0 && (
              <button
                className="flex-1 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => setActiveStep(p => p - 1)}
              >← Back</button>
            )}
            <button
              className="flex-1 py-2 rounded-lg text-sm text-white font-medium"
              style={{ background: color }}
              onClick={() => activeStep < enabledSteps.length - 1 && setActiveStep(p => p + 1)}
            >
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
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {[d.firstName, d.lastName].filter(Boolean).join(" ") || d.email || "Anonymous"}
          </p>
          <p className="text-[11px] text-muted-foreground">{d.email} · {format(parseISO(sub.submittedAt), "MMM d, yyyy h:mm a")}</p>
        </div>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", cfg.class)}>
          {cfg.label}
        </Badge>
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
              <button
                key={key}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                  sub.status === key ? val.class : "text-muted-foreground border-border hover:bg-muted"
                )}
                onClick={() => onStatusChange(key)}
              >
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
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 flex-shrink-0"
          onClick={() => navigate("/admin/quote-forms")}
          data-testid="button-back-to-forms"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Input
          data-testid="input-form-name"
          value={localName}
          onChange={e => { setLocalName(e.target.value); setDirty(true); }}
          className="h-7 text-sm font-semibold border-0 shadow-none focus-visible:ring-0 px-0 max-w-xs"
        />
        <div className="flex items-center gap-1.5 ml-auto">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary px-2 py-1 rounded transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Preview
          </a>
          <Button
            data-testid="button-copy-form-link"
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: "Link copied!" }); }}
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>
          <Button
            data-testid="button-save-form"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {dirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-4 md:px-6 flex gap-4">
        {(["builder", "submissions"] as const).map(t => (
          <button
            key={t}
            data-testid={`tab-${t}`}
            className={cn(
              "py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab(t)}
          >
            {t === "submissions" ? `Submissions (${submissions.length})` : "Builder"}
          </button>
        ))}
      </div>

      {tab === "builder" ? (
        <div className="flex-1 flex min-h-0 gap-0">
          {/* Left panel - Step & field manager */}
          <div className="w-72 border-r flex flex-col overflow-hidden flex-shrink-0">
            <div className="px-4 py-3 border-b bg-muted/20">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Form Steps & Fields</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {localConfig.steps.map((step, si) => {
                const Icon = STEP_ICONS[step.id] ?? FileText;
                return (
                  <div key={step.id} className="mb-1">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 mx-2 rounded-lg">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium truncate">{step.title}</span>
                      <Switch
                        data-testid={`switch-step-enabled-${step.id}`}
                        checked={step.enabled}
                        onCheckedChange={v => updateStep(si, { enabled: v })}
                        className="scale-75"
                      />
                    </div>
                    {step.enabled && (
                      <div className="mx-2 mt-0.5 pl-2 border-l-2 border-muted ml-4">
                        {step.fields.map((field, fi) => (
                          <FieldRow
                            key={field.id}
                            field={field}
                            onChange={updates => updateField(si, fi, updates)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel - Live preview */}
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
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No submissions yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Share your form link to start receiving requests.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: "Link copied!" }); }}
              >
                <Copy className="w-3.5 h-3.5" /> Copy Form Link
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {submissions.map(sub => (
                <SubmissionRow
                  key={sub.id}
                  sub={sub}
                  onStatusChange={status => statusMutation.mutate({ subId: sub.id, status })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
