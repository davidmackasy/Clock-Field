import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ReportSignaturePad, type SigCapture } from "@/components/report-signature-pad";
import {
  FileText, Plus, Search, Filter, Eye, Send, CheckCircle2, Archive,
  RotateCcw, Printer, Download, ChevronRight, AlertTriangle, Clock,
  Inbox, FolderOpen, PenLine, X, User, Building2, MapPin, Calendar,
  ClipboardList, Shield, ChevronDown, ChevronUp, Sparkles, Loader2,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const INCIDENT_CATEGORIES = [
  { value: "broke_client_property", label: "Broke client property", title: "Damage to client property" },
  { value: "damaged_equipment", label: "Damaged equipment", title: "Company equipment damage" },
  { value: "water_overflow", label: "Water overflow / flooding", title: "Water overflow incident" },
  { value: "chemical_spill", label: "Chemical spill", title: "Chemical spill incident" },
  { value: "missed_area", label: "Missed area caused issue", title: "Missed area — service issue" },
  { value: "removed_item", label: "Removed item from site", title: "Item removal from client site" },
  { value: "lost_item", label: "Lost item", title: "Lost item report" },
  { value: "safety_concern", label: "Safety concern", title: "Safety concern identified" },
  { value: "slip_trip", label: "Slip / trip / near miss", title: "Slip, trip, or near-miss incident" },
  { value: "client_complaint", label: "Client complaint", title: "Client complaint related incident" },
  { value: "other", label: "Other", title: "" },
];

const INCIDENT_AREAS = [
  "Washroom", "Kitchen", "Office", "Hallway", "Lobby",
  "Storage room", "Mechanical room", "Loading area", "Stairwell", "Other",
];

const IMMEDIATE_ACTION_OPTIONS = [
  "Area secured", "Client notified", "Supervisor notified",
  "Item removed from service", "Work paused", "Photos taken",
  "Cleanup completed", "Awaiting review",
];

const REPORT_TYPES = [
  { value: "incident", label: "Incident Report", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "issue", label: "Issue Report", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "damage", label: "Damage Report", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "statement", label: "Employee Statement", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "complaint", label: "Client Complaint", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "general", label: "General Report", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

const STATUSES = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-600" },
  { value: "submitted", label: "Submitted", color: "bg-blue-100 text-blue-700" },
  { value: "sent", label: "Sent", color: "bg-indigo-100 text-indigo-700" },
  { value: "viewed", label: "Viewed", color: "bg-cyan-100 text-cyan-700" },
  { value: "awaiting_employee", label: "Awaiting Employee", color: "bg-yellow-100 text-yellow-700" },
  { value: "awaiting_client", label: "Awaiting Client", color: "bg-orange-100 text-orange-700" },
  { value: "awaiting_signature", label: "Awaiting Signature", color: "bg-amber-100 text-amber-700" },
  { value: "in_review", label: "In Review", color: "bg-purple-100 text-purple-700" },
  { value: "finalized", label: "Finalized", color: "bg-green-100 text-green-700" },
  { value: "closed", label: "Closed", color: "bg-emerald-100 text-emerald-700" },
  { value: "archived", label: "Archived", color: "bg-slate-100 text-slate-600" },
  { value: "reopened", label: "Reopened", color: "bg-rose-100 text-rose-700" },
];

const SEVERITIES = [
  { value: "low", label: "Low", color: "text-green-600" },
  { value: "medium", label: "Medium", color: "text-yellow-600" },
  { value: "high", label: "High", color: "text-orange-600" },
  { value: "critical", label: "Critical", color: "text-red-600" },
];

function getTypeInfo(type: string) {
  return REPORT_TYPES.find(t => t.value === type) || REPORT_TYPES[5];
}
function getStatusInfo(status: string) {
  return STATUSES.find(s => s.value === status) || STATUSES[0];
}
function getSeverityInfo(sev: string) {
  return SEVERITIES.find(s => s.value === sev) || SEVERITIES[0];
}

function reportId(id: string) {
  return `RPT-${id.slice(0, 8).toUpperCase()}`;
}

// ─── Chip Button ─────────────────────────────────────────────────────────────
function ChipButton({ active, onClick, children, testId }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs border transition-all",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  );
}

// ─── Create Report Dialog ─────────────────────────────────────────────────────
function CreateReportDialog({ open, onClose, employees, clients, locations }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    reportType: "incident", title: "", summary: "",
    incidentDate: "", incidentTime: "", severity: "medium", riskLevel: "medium",
    incidentCategory: "", areaAffected: "", witnesses: "",
    clientPropertyAffected: false, companyEquipmentAffected: false,
    workStopped: false, customerInformed: false,
    assignedClientId: "", assignedLocationId: "", assignedEmployeeId: "",
    requiresEmployeeSignature: false, requiresClientSignature: false, requiresAdminSignature: false,
    immediateAction: "", internalNotes: "", nextSteps: "", correctiveAction: "",
    status: "draft",
  });

  // Structured incident writing fields
  const [whatHappened, setWhatHappened] = useState("");
  const [whatCaused, setWhatCaused] = useState("");
  const [immediateActionText, setImmediateActionText] = useState("");
  const [whoInvolved, setWhoInvolved] = useState("");
  const [whatAffected, setWhatAffected] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  // AI refinement state
  const [aiRefining, setAiRefining] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  const handleCategorySelect = (catValue: string) => {
    set("incidentCategory", catValue);
    const cat = INCIDENT_CATEGORIES.find(c => c.value === catValue);
    if (cat?.title && !form.title) set("title", cat.title);
  };

  const toggleAction = (action: string) => {
    setSelectedActions(prev => {
      const next = prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action];
      const combined = next.join("; ");
      setImmediateActionText(combined);
      set("immediateAction", combined);
      return next;
    });
  };

  const refineWithAI = async () => {
    if (!whatHappened || whatHappened.trim().length < 10) {
      toast({ title: "Please describe what happened first (at least a sentence).", variant: "destructive" });
      return;
    }
    setAiRefining(true);
    setAiResult(null);
    try {
      const res = await apiRequest("POST", "/api/reports/refine-incident", {
        whatHappened,
        whatCaused,
        immediateAction: immediateActionText,
        whoInvolved,
        whatAffected,
        incidentCategory: form.incidentCategory,
        areaAffected: form.areaAffected,
      });
      if (!res.ok) {
        const userMessage = res.status === 503 || res.status === 500
          ? "AI writing assistance is not available right now. You can continue and edit the report manually."
          : "AI refinement could not be completed. Please try again.";
        toast({ title: "AI unavailable", description: userMessage, variant: "destructive" });
        return;
      }
      const result = await res.json();
      setAiResult(result);
      if (result.title) set("title", result.title);
      if (result.refinedDescription) set("summary", result.refinedDescription);
      if (result.immediateAction) {
        setImmediateActionText(result.immediateAction);
        set("immediateAction", result.immediateAction);
      }
      if (result.followUpRecommendations) set("nextSteps", result.followUpRecommendations);
    } catch {
      toast({ title: "AI unavailable", description: "AI writing assistance is not available right now. You can continue and edit the report manually.", variant: "destructive" });
    } finally {
      setAiRefining(false);
    }
  };

  const buildSubmitData = (status: string) => {
    const isIncident = form.reportType === "incident";
    const summary = form.summary || (isIncident
      ? [whatHappened, whatCaused ? `Cause: ${whatCaused}` : ""].filter(Boolean).join("\n\n")
      : "");
    const immediateAction = form.immediateAction || immediateActionText;
    const witnesses = form.witnesses || whoInvolved;
    return { ...form, summary, immediateAction, witnesses, status };
  };

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/reports", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isIncident = form.reportType === "incident";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Create New Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Report Type */}
          <div className="space-y-1.5">
            <Label>Report Type *</Label>
            <Select value={form.reportType} onValueChange={v => set("reportType", v)}>
              <SelectTrigger data-testid="select-report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* ── INCIDENT-SPECIFIC ENHANCED FORM ── */}
          {isIncident && (
            <>
              {/* Incident Category chips */}
              <div className="space-y-2">
                <Label>Incident Category</Label>
                <div className="flex flex-wrap gap-1.5">
                  {INCIDENT_CATEGORIES.map(cat => (
                    <ChipButton
                      key={cat.value}
                      active={form.incidentCategory === cat.value}
                      onClick={() => handleCategorySelect(cat.value)}
                      testId={`chip-cat-${cat.value}`}
                    >
                      {cat.label}
                    </ChipButton>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label>Report Title *</Label>
                <Input
                  data-testid="input-report-title"
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder="Brief title describing the incident..."
                />
              </div>

              {/* Date / Time / Severity */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />Incident Date</Label>
                  <Input type="date" data-testid="input-incident-date" value={form.incidentDate} onChange={e => set("incidentDate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Incident Time</Label>
                  <Input type="time" data-testid="input-incident-time" value={form.incidentTime} onChange={e => set("incidentTime", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" />Severity</Label>
                  <div className="flex gap-1.5">
                    {[{v:"low",l:"Low"},{v:"medium",l:"Med"},{v:"high",l:"High"}].map(s => (
                      <ChipButton key={s.v} active={form.severity === s.v} onClick={() => set("severity", s.v)} testId={`chip-sev-${s.v}`}>{s.l}</ChipButton>
                    ))}
                  </div>
                </div>
              </div>

              {/* Area affected */}
              <div className="space-y-2">
                <Label>Area Affected</Label>
                <div className="flex flex-wrap gap-1.5">
                  {INCIDENT_AREAS.map(area => (
                    <ChipButton
                      key={area}
                      active={form.areaAffected === area}
                      onClick={() => set("areaAffected", form.areaAffected === area ? "" : area)}
                      testId={`chip-area-${area.replace(/\s/g, "-").toLowerCase()}`}
                    >
                      {area}
                    </ChipButton>
                  ))}
                </div>
              </div>

              {/* Assignment */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><User className="w-3 h-3" />Employee</Label>
                  <Select value={form.assignedEmployeeId || "none"} onValueChange={v => set("assignedEmployeeId", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />Client</Label>
                  <Select value={form.assignedClientId || "none"} onValueChange={v => set("assignedClientId", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-client"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />Location</Label>
                  <Select value={form.assignedLocationId || "none"} onValueChange={v => set("assignedLocationId", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-location"><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-2">
                <p className="text-sm font-semibold text-foreground mb-3">What Happened?</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">1. What happened?</Label>
                    <Textarea
                      data-testid="input-what-happened"
                      value={whatHappened}
                      onChange={e => setWhatHappened(e.target.value)}
                      placeholder="Describe the incident in your own words..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">2. What caused it, if known?</Label>
                    <Textarea
                      data-testid="input-what-caused"
                      value={whatCaused}
                      onChange={e => setWhatCaused(e.target.value)}
                      placeholder="Contributing factors or known cause..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">3. Who was involved or present?</Label>
                    <Input
                      data-testid="input-who-involved"
                      value={whoInvolved}
                      onChange={e => setWhoInvolved(e.target.value)}
                      placeholder="Employee name, client contact, witnesses..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">4. What item or property was affected?</Label>
                    <Input
                      data-testid="input-what-affected"
                      value={whatAffected}
                      onChange={e => setWhatAffected(e.target.value)}
                      placeholder="Specific item, equipment, or area..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">5. Immediate action taken</Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {IMMEDIATE_ACTION_OPTIONS.map(opt => (
                        <ChipButton
                          key={opt}
                          active={selectedActions.includes(opt)}
                          onClick={() => toggleAction(opt)}
                          testId={`chip-action-${opt.replace(/\s/g, "-").toLowerCase()}`}
                        >
                          {opt}
                        </ChipButton>
                      ))}
                    </div>
                    <Textarea
                      data-testid="input-immediate-action"
                      value={immediateActionText}
                      onChange={e => { setImmediateActionText(e.target.value); set("immediateAction", e.target.value); }}
                      placeholder="Or describe in your own words..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* AI Refinement */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Refine with AI</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={refineWithAI}
                    disabled={aiRefining}
                    data-testid="button-refine-ai"
                    className="border-primary/30"
                  >
                    {aiRefining ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                    {aiRefining ? "Refining…" : "Refine with AI"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">AI will rewrite your rough notes into a professional, factual incident description. You can review and edit everything before saving.</p>

                {aiResult && (
                  <div className="space-y-3 pt-1 border-t border-primary/10">
                    {aiResult.confidenceNote && aiResult.confidenceNote !== "Report details appear sufficient." && (
                      <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{aiResult.confidenceNote}</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Refined Title (editable)</Label>
                      <Input value={form.title} onChange={e => set("title", e.target.value)} data-testid="input-refined-title" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Professional Description (editable)</Label>
                      <Textarea value={form.summary} onChange={e => set("summary", e.target.value)} rows={4} data-testid="input-refined-description" />
                    </div>
                    {aiResult.probableCauses && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Probable Causes</p>
                        <p className="text-xs text-foreground">{aiResult.probableCauses}</p>
                      </div>
                    )}
                    {aiResult.followUpRecommendations && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Follow-Up Recommendations (editable)</Label>
                        <Textarea value={form.nextSteps} onChange={e => set("nextSteps", e.target.value)} rows={2} data-testid="input-refined-followup" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Impact checkboxes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Impact</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { field: "clientPropertyAffected", label: "Client property affected" },
                    { field: "companyEquipmentAffected", label: "Company equipment affected" },
                    { field: "workStopped", label: "Work was stopped" },
                    { field: "customerInformed", label: "Customer was informed" },
                  ].map(item => (
                    <label key={item.field} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={(form as any)[item.field]} onCheckedChange={v => set(item.field, !!v)} data-testid={`check-${item.field}`} />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="border-t pt-3 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Signature Requirements</Label>
                  <div className="flex gap-4 flex-wrap">
                    {[
                      { field: "requiresEmployeeSignature", label: "Employee signature" },
                      { field: "requiresClientSignature", label: "Client signature" },
                    ].map(item => (
                      <label key={item.field} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={(form as any)[item.field]} onCheckedChange={v => set(item.field, !!v)} data-testid={`check-sig-${item.field}`} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Shield className="w-3 h-3" />
                    Internal Notes (not visible to employee or client)
                  </Label>
                  <Textarea
                    data-testid="input-internal-notes"
                    value={form.internalNotes}
                    onChange={e => set("internalNotes", e.target.value)}
                    placeholder="Internal admin notes..."
                    rows={2}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── STANDARD FORM (non-incident) ── */}
          {!isIncident && (
            <>
              <div className="space-y-1.5">
                <Label>Report Title *</Label>
                <Input data-testid="input-report-title" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Brief title describing the report..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><User className="w-3 h-3" />Employee</Label>
                  <Select value={form.assignedEmployeeId || "none"} onValueChange={v => set("assignedEmployeeId", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />Client</Label>
                  <Select value={form.assignedClientId || "none"} onValueChange={v => set("assignedClientId", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-client"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />Location</Label>
                  <Select value={form.assignedLocationId || "none"} onValueChange={v => set("assignedLocationId", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-location"><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />Date</Label>
                  <Input type="date" data-testid="input-incident-date" value={form.incidentDate} onChange={e => set("incidentDate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Time</Label>
                  <Input type="time" data-testid="input-incident-time" value={form.incidentTime} onChange={e => set("incidentTime", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Severity</Label>
                  <Select value={form.severity} onValueChange={v => set("severity", v)}>
                    <SelectTrigger data-testid="select-severity"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Summary / Description</Label>
                <Textarea data-testid="input-summary" value={form.summary} onChange={e => set("summary", e.target.value)} placeholder="Describe what happened..." rows={4} />
              </div>
              <div className="space-y-1.5">
                <Label>Immediate Action Taken</Label>
                <Textarea data-testid="input-immediate-action" value={form.immediateAction} onChange={e => set("immediateAction", e.target.value)} placeholder="What action was taken immediately..." rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: "clientPropertyAffected", label: "Client property affected" },
                  { field: "companyEquipmentAffected", label: "Company equipment affected" },
                  { field: "workStopped", label: "Work was stopped" },
                  { field: "customerInformed", label: "Customer was informed" },
                ].map(item => (
                  <label key={item.field} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={(form as any)[item.field]} onCheckedChange={v => set(item.field, !!v)} data-testid={`check-${item.field}`} />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Shield className="w-3 h-3" />
                  Internal Notes (Admin-only)
                </Label>
                <Textarea data-testid="input-internal-notes" value={form.internalNotes} onChange={e => set("internalNotes", e.target.value)} placeholder="Internal admin notes..." rows={2} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Signature Requirements</Label>
                <div className="flex gap-4 flex-wrap">
                  {[
                    { field: "requiresEmployeeSignature", label: "Employee signature" },
                    { field: "requiresClientSignature", label: "Client signature" },
                    { field: "requiresAdminSignature", label: "Management signature" },
                  ].map(item => (
                    <label key={item.field} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={(form as any)[item.field]} onCheckedChange={v => set(item.field, !!v)} data-testid={`check-sig-${item.field}`} />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-report">Cancel</Button>
          <Button
            variant="outline"
            onClick={() => createMut.mutate(buildSubmitData("draft"))}
            disabled={!form.title || createMut.isPending}
            data-testid="button-save-draft"
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => createMut.mutate(buildSubmitData("submitted"))}
            disabled={!form.title || createMut.isPending}
            data-testid="button-create-report"
          >
            {createMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Create Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Send Report Dialog ───────────────────────────────────────────────────────
function SendReportDialog({ report, open, onClose, employees, clients }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Resolve assigned employee and client records
  const assignedEmployee = report?.assignedEmployeeId
    ? (employees || []).find((e: any) => e.id === report.assignedEmployeeId) : null;
  const assignedClient = report?.assignedClientId
    ? (clients || []).find((c: any) => c.id === report.assignedClientId) : null;

  const empEmail = assignedEmployee?.email || null;
  const clientEmail = assignedClient?.contactEmail || null;

  const [sendToEmployee, setSendToEmployee] = useState(!!report?.assignedEmployeeId);
  const [sendToEmployeeEmail, setSendToEmployeeEmail] = useState(false);
  const [sendToClient, setSendToClient] = useState(!!report?.assignedClientId);
  const [sendToClientEmail, setSendToClientEmail] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<null | { emailResults: any[] }>(null);

  const anySelected = sendToEmployee || sendToClient || sendToEmployeeEmail || sendToClientEmail;

  const sendMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/reports/${report.id}/send`, {
        sendToEmployee, sendToClient, sendToEmployeeEmail, sendToClientEmail,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      const emailResults: any[] = data?.emailResults || [];
      const failedEmails = emailResults.filter((r: any) => !r.ok);
      if (failedEmails.length > 0 && (sendToEmployeeEmail || sendToClientEmail)) {
        setDeliveryResult({ emailResults });
      } else {
        toast({ title: "Report sent successfully" });
        onClose();
      }
    },
    onError: (e: any) => toast({ title: "Error", description: "Could not send report. Please try again.", variant: "destructive" }),
  });

  if (deliveryResult) {
    const results = deliveryResult.emailResults;
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Report Sent</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Delivery summary:</p>
            {results.map((r: any, i: number) => (
              <div key={i} className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${r.ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {r.ok
                  ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                  : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />}
                <span>
                  {r.ok
                    ? `Email sent to ${r.recipient}`
                    : `${r.recipient} email: ${r.error || "could not be delivered"}`}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={sendMut.isPending ? undefined : onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">Select who should receive this report and how.</p>

          {/* ── Employee recipient block ── */}
          {report?.assignedEmployeeId && assignedEmployee && (
            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned Employee</span>
              </div>
              <p className="text-sm font-medium">{assignedEmployee.firstName} {assignedEmployee.lastName}</p>
              {empEmail && <p className="text-xs text-muted-foreground">{empEmail}</p>}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <Checkbox checked={sendToEmployee} onCheckedChange={v => setSendToEmployee(!!v)} data-testid="check-send-employee" />
                  <span>Send to account (in-app)</span>
                </label>
                <label className={`flex items-center gap-2.5 text-sm ${empEmail ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
                  <Checkbox
                    checked={sendToEmployeeEmail}
                    onCheckedChange={v => empEmail && setSendToEmployeeEmail(!!v)}
                    disabled={!empEmail}
                    data-testid="check-send-employee-email"
                  />
                  <span>Send to email</span>
                  {!empEmail && <span className="text-xs text-muted-foreground ml-1">— no email on file</span>}
                </label>
              </div>
            </div>
          )}

          {/* ── Client recipient block ── */}
          {report?.assignedClientId && assignedClient && (
            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned Client</span>
              </div>
              <p className="text-sm font-medium">{assignedClient.name}</p>
              {clientEmail && <p className="text-xs text-muted-foreground">{clientEmail}</p>}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <Checkbox checked={sendToClient} onCheckedChange={v => setSendToClient(!!v)} data-testid="check-send-client" />
                  <span>Send to account (in-app)</span>
                </label>
                <label className={`flex items-center gap-2.5 text-sm ${clientEmail ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
                  <Checkbox
                    checked={sendToClientEmail}
                    onCheckedChange={v => clientEmail && setSendToClientEmail(!!v)}
                    disabled={!clientEmail}
                    data-testid="check-send-client-email"
                  />
                  <span>Send to email</span>
                  {!clientEmail && <span className="text-xs text-muted-foreground ml-1">— no email on file</span>}
                </label>
              </div>
            </div>
          )}

          {!report?.assignedEmployeeId && !report?.assignedClientId && (
            <p className="text-sm text-amber-600">No employee or client assigned to this report.</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sendMut.isPending}>Cancel</Button>
          <Button
            onClick={() => sendMut.mutate()}
            disabled={sendMut.isPending || !anySelected}
            data-testid="button-send-report"
          >
            {sendMut.isPending
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending…</>
              : <><Send className="w-4 h-4 mr-1.5" />Send</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Detail Dialog ──────────────────────────────────────────────────────
function ReportDetailDialog({ reportId: rptId, open, onClose, employees, clients, locations, company }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [sendOpen, setSendOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    details: true, people: true, summary_section: true, property: false, evidence: false, signatures: true, admin: true, activity: false,
  });
  const [sigForm, setSigForm] = useState({ name: "", ack: false });
  const [sigCapture, setSigCapture] = useState<SigCapture>({ signatureType: "typed", signatureDataUrl: null });
  const [adminEdits, setAdminEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const toggleSection = (k: string) => setExpandedSections(s => ({ ...s, [k]: !s[k] }));

  const { data: report, isLoading } = useQuery<any>({
    queryKey: ["/api/reports", rptId],
    queryFn: () => fetch(`/api/reports/${rptId}`).then(r => r.json()),
    enabled: !!rptId && open,
  });

  const finalizeMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/reports/${rptId}/finalize`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reports"] }); queryClient.invalidateQueries({ queryKey: ["/api/reports", rptId] }); toast({ title: "Report finalized" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const archiveMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/reports/${rptId}/archive`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reports"] }); queryClient.invalidateQueries({ queryKey: ["/api/reports", rptId] }); toast({ title: "Report archived" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reopenMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/reports/${rptId}/reopen`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reports"] }); queryClient.invalidateQueries({ queryKey: ["/api/reports", rptId] }); toast({ title: "Report reopened" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const signMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/reports/${rptId}/sign`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reports", rptId] }); toast({ title: "Report signed" }); setSigForm({ name: "", ack: false }); setSigCapture({ signatureType: "typed", signatureDataUrl: null }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/reports/${rptId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reports", rptId] }); toast({ title: "Saved" }); setAdminEdits({}); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePrint = () => window.print();

  if (!open) return null;

  const rpt = report;
  const typeInfo = rpt ? getTypeInfo(rpt.reportType) : null;
  const statusInfo = rpt ? getStatusInfo(rpt.status) : null;
  const assignedEmployee = rpt?.assignedEmployeeId ? employees.find((e: any) => e.id === rpt.assignedEmployeeId) : null;
  const assignedClient = rpt?.assignedClientId ? clients.find((c: any) => c.id === rpt.assignedClientId) : null;
  const assignedLocation = rpt?.assignedLocationId ? locations.find((l: any) => l.id === rpt.assignedLocationId) : null;
  const mySignature = rpt?.signatures?.find((s: any) => s.signerUserId === user?.id);
  const canSign = rpt && !mySignature && (
    (user?.role === "admin" && rpt.requiresAdminSignature) ||
    (user?.role === "employee" && rpt.requiresEmployeeSignature) ||
    (user?.role === "client" && rpt.requiresClientSignature)
  );

  function SectionHeader({ label, sectionKey, icon: Icon }: any) {
    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        className="flex items-center justify-between w-full py-2 px-3 bg-muted/40 rounded-md hover:bg-muted/70 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-foreground">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          {label}
        </span>
        {expandedSections[sectionKey] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
    );
  }

  function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
    if (!value && value !== false && value !== 0) return null;
    return (
      <div className="space-y-0.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("text-sm text-foreground", mono && "font-mono")}>{typeof value === "boolean" ? (value ? "Yes" : "No") : value}</p>
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto print:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rpt ? (
            <>
              <DialogHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", typeInfo?.color)}>{typeInfo?.label}</span>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", statusInfo?.color)}>{statusInfo?.label}</span>
                      {rpt.severity && <span className={cn("text-[10px] font-semibold", getSeverityInfo(rpt.severity).color)}>⬤ {rpt.severity.toUpperCase()}</span>}
                    </div>
                    <DialogTitle className="text-base leading-tight">{rpt.title}</DialogTitle>
                    <p className="text-xs text-muted-foreground">{reportId(rpt.id)} · Created {rpt.createdAt ? format(new Date(rpt.createdAt), "MMM d, yyyy") : "—"}</p>
                  </div>
                </div>

                {/* Action bar */}
                {user?.role === "admin" && (
                  <div className="flex gap-2 flex-wrap">
                    {rpt.status !== "finalized" && rpt.status !== "archived" && (
                      <Button size="sm" variant="outline" onClick={() => setSendOpen(true)} data-testid="button-open-send">
                        <Send className="w-3.5 h-3.5 mr-1.5" />Send
                      </Button>
                    )}
                    {rpt.status !== "finalized" && rpt.status !== "archived" && (
                      <Button size="sm" variant="outline" onClick={() => finalizeMut.mutate(adminEdits)} data-testid="button-finalize">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Finalize
                      </Button>
                    )}
                    {rpt.status !== "archived" && (
                      <Button size="sm" variant="outline" onClick={() => archiveMut.mutate()} data-testid="button-archive">
                        <Archive className="w-3.5 h-3.5 mr-1.5" />Archive
                      </Button>
                    )}
                    {rpt.status === "archived" && (
                      <Button size="sm" variant="outline" onClick={() => reopenMut.mutate()} data-testid="button-reopen">
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reopen
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print">
                      <Printer className="w-3.5 h-3.5 mr-1.5" />Print / PDF
                    </Button>
                  </div>
                )}
              </DialogHeader>

              <div className="space-y-3 pt-2">
                {/* Incident Details */}
                <SectionHeader label="Incident Details" sectionKey="details" icon={AlertTriangle} />
                {expandedSections.details && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-1 pb-2">
                    <Field label="Incident Date" value={rpt.incidentDate} />
                    <Field label="Incident Time" value={rpt.incidentTime} />
                    <Field label="Category" value={rpt.incidentCategory ? (INCIDENT_CATEGORIES.find(c => c.value === rpt.incidentCategory)?.label || rpt.incidentCategory) : null} />
                    <Field label="Area Affected" value={rpt.areaAffected} />
                    <Field label="Risk Level" value={rpt.riskLevel} />
                    <Field label="Client Property Affected" value={rpt.clientPropertyAffected} />
                    <Field label="Company Equipment Affected" value={rpt.companyEquipmentAffected} />
                    <Field label="Work Stopped" value={rpt.workStopped} />
                    <Field label="Customer Informed" value={rpt.customerInformed} />
                  </div>
                )}

                {/* People Involved */}
                <SectionHeader label="People Involved" sectionKey="people" icon={User} />
                {expandedSections.people && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-1 pb-2">
                    {assignedEmployee && (
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Employee</p>
                        <p className="text-sm">{assignedEmployee.firstName} {assignedEmployee.lastName}</p>
                      </div>
                    )}
                    {assignedClient && (
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Client</p>
                        <p className="text-sm">{assignedClient.name}</p>
                      </div>
                    )}
                    {assignedLocation && (
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Location</p>
                        <p className="text-sm">{assignedLocation.name}</p>
                      </div>
                    )}
                    <Field label="Witnesses" value={rpt.witnesses} />
                  </div>
                )}

                {/* Summary */}
                <SectionHeader label="Incident Summary" sectionKey="summary_section" icon={ClipboardList} />
                {expandedSections.summary_section && (
                  <div className="space-y-3 px-1 pb-2">
                    <Field label="Summary" value={rpt.summary} />
                    <Field label="Immediate Action Taken" value={rpt.immediateAction} />
                    {rpt.employeeStatement && <Field label="Employee Statement" value={rpt.employeeStatement} />}
                    {rpt.clientComments && <Field label="Client Comments" value={rpt.clientComments} />}
                  </div>
                )}

                {/* Property */}
                {(rpt.itemAffected || rpt.damageType) && (
                  <>
                    <SectionHeader label="Property / Equipment" sectionKey="property" icon={FolderOpen} />
                    {expandedSections.property && (
                      <div className="grid grid-cols-2 gap-3 px-1 pb-2">
                        <Field label="Item Affected" value={rpt.itemAffected} />
                        <Field label="Description" value={rpt.itemDescription} />
                        <Field label="Damage Type" value={rpt.damageType} />
                        <Field label="Estimated Cost" value={rpt.estimatedCost ? `$${rpt.estimatedCost}` : null} />
                        <Field label="Item Removed" value={rpt.itemRemoved} />
                        <Field label="Removed By" value={rpt.removedBy} />
                        <Field label="Removal Reason" value={rpt.removalReason} />
                        <Field label="Removal Approved" value={rpt.removalApproved} />
                      </div>
                    )}
                  </>
                )}

                {/* Evidence / Attachments */}
                {(rpt.attachments && JSON.parse(rpt.attachments || "[]").length > 0) && (
                  <>
                    <SectionHeader label="Supporting Evidence" sectionKey="evidence" icon={FileText} />
                    {expandedSections.evidence && (
                      <div className="flex flex-wrap gap-2 px-1 pb-2">
                        {JSON.parse(rpt.attachments || "[]").map((att: any, i: number) => (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 px-2 py-1 rounded hover:bg-primary/5">
                            <FileText className="w-3 h-3" />{att.name || `Attachment ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Admin section (admin-only) */}
                {user?.role === "admin" && (
                  <>
                    <SectionHeader label="Admin Review & Notes" sectionKey="admin" icon={Shield} />
                    {expandedSections.admin && (
                      <div className="space-y-3 px-1 pb-2">
                        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 font-medium">
                          Internal fields — not visible to employee or client
                        </div>
                        <div className="space-y-3">
                          {[
                            { key: "internalNotes", label: "Internal Notes" },
                            { key: "adminFindings", label: "Admin Findings" },
                            { key: "correctiveAction", label: "Corrective Action" },
                            { key: "finalDecision", label: "Final Decision" },
                            { key: "nextSteps", label: "Next Steps" },
                          ].map(f => (
                            <div key={f.key} className="space-y-1">
                              <Label className="text-xs">{f.label}</Label>
                              <Textarea
                                rows={2}
                                data-testid={`input-admin-${f.key}`}
                                defaultValue={rpt[f.key] || ""}
                                onChange={e => setAdminEdits(prev => ({ ...prev, [f.key]: e.target.value }))}
                                placeholder={`${f.label}...`}
                              />
                            </div>
                          ))}
                          {Object.keys(adminEdits).length > 0 && (
                            <Button size="sm" onClick={() => updateMut.mutate(adminEdits)} disabled={updateMut.isPending} data-testid="button-save-admin">
                              Save Admin Notes
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Signatures */}
                <SectionHeader label="Signatures" sectionKey="signatures" icon={PenLine} />
                {expandedSections.signatures && (
                  <div className="space-y-3 px-1 pb-2">
                    {rpt.signatures?.length > 0 && (
                      <div className="space-y-2">
                        {rpt.signatures.map((sig: any) => (
                          <div key={sig.id} className="rounded-md bg-green-50 border border-green-200 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              <p className="text-sm font-medium">{sig.signerName}</p>
                              <span className="text-xs text-muted-foreground capitalize ml-auto">{sig.signerRole} · {sig.signedAt ? format(new Date(sig.signedAt), "MMM d, yyyy") : ""}</span>
                            </div>
                            {/* Signature graphic */}
                            {sig.signatureType === "drawn" && sig.signatureDataUrl ? (
                              <div className="mx-3 mb-2 rounded bg-white border border-green-100 p-2">
                                <img src={sig.signatureDataUrl} alt="Signature" className="h-12 w-auto max-w-full object-contain" />
                              </div>
                            ) : sig.signatureType === "typed" || (!sig.signatureDataUrl) ? (
                              <div className="mx-3 mb-2 rounded bg-white border border-green-100 px-3 py-1">
                                <p className="text-2xl text-foreground leading-tight" style={{ fontFamily: "'Dancing Script', cursive", fontWeight: 600 }}>
                                  {sig.signerName}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                    {canSign && (
                      <div className="rounded-md border p-4 space-y-3">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <PenLine className="w-4 h-4 text-primary" />Sign this report
                        </p>
                        <ReportSignaturePad
                          name={sigForm.name}
                          onChangeName={n => setSigForm(f => ({ ...f, name: n }))}
                          onChange={v => setSigCapture(prev => ({ ...prev, ...v }))}
                        />
                        <label className="flex items-start gap-2 text-sm cursor-pointer">
                          <Checkbox checked={sigForm.ack} onCheckedChange={v => setSigForm(f => ({ ...f, ack: !!v }))} data-testid="check-acknowledge" />
                          <span>I acknowledge that the information in this report is accurate to the best of my knowledge.</span>
                        </label>
                        <Button
                          size="sm"
                          disabled={
                            !sigForm.name ||
                            !sigForm.ack ||
                            signMut.isPending ||
                            (sigCapture.signatureType === "drawn" && !sigCapture.signatureDataUrl)
                          }
                          onClick={() => signMut.mutate({
                            signerName: sigForm.name,
                            signatureType: sigCapture.signatureType,
                            signatureDataUrl: sigCapture.signatureDataUrl,
                            acknowledgementText: "I acknowledge this report is accurate.",
                          })}
                          data-testid="button-sign-report"
                        >
                          <PenLine className="w-3.5 h-3.5 mr-1.5" />Sign Report
                        </Button>
                      </div>
                    )}
                    {rpt.signatures?.length === 0 && !canSign && (
                      <p className="text-sm text-muted-foreground">No signatures yet.</p>
                    )}
                  </div>
                )}

                {/* Activity log */}
                <SectionHeader label="Audit Trail" sectionKey="activity" icon={Clock} />
                {expandedSections.activity && (
                  <div className="space-y-1.5 px-1 pb-2">
                    {rpt.activity?.length > 0 ? rpt.activity.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                        <span className="font-medium capitalize text-foreground">{a.action.replace(/_/g, " ")}</span>
                        <span>by {a.actionByRole}</span>
                        <span>{a.createdAt ? format(new Date(a.createdAt), "MMM d, h:mm a") : ""}</span>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No activity yet.</p>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">Report not found.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Print / PDF layout - full page */}
      {rpt && <PrintLayout report={rpt} employees={employees} clients={clients} locations={locations} company={company} />}

      {sendOpen && <SendReportDialog report={rpt} open={sendOpen} onClose={() => setSendOpen(false)} employees={employees} clients={clients} />}
    </>
  );
}

// ─── Print Layout ─────────────────────────────────────────────────────────────
function PrintLayout({ report: rpt, employees, clients, locations, company }: any) {
  if (!rpt) return null;
  const assignedEmployee = rpt.assignedEmployeeId ? employees.find((e: any) => e.id === rpt.assignedEmployeeId) : null;
  const assignedClient = rpt.assignedClientId ? clients.find((c: any) => c.id === rpt.assignedClientId) : null;
  const assignedLocation = rpt.assignedLocationId ? locations.find((l: any) => l.id === rpt.assignedLocationId) : null;
  const typeInfo = getTypeInfo(rpt.reportType);
  const preparedDate = rpt.createdAt ? format(new Date(rpt.createdAt), "MMMM d, yyyy") : format(new Date(), "MMMM d, yyyy");

  // For incident category, find the human-readable label
  const incidentCatLabel = rpt.incidentCategory
    ? INCIDENT_CATEGORIES.find(c => c.value === rpt.incidentCategory)?.label || rpt.incidentCategory
    : null;

  function PrintField({ label, value }: { label: string; value: any }) {
    if (!value && value !== false && value !== 0) return null;
    return (
      <div>
        <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: "2px" }}>{label}</p>
        <p style={{ fontSize: "12px", color: "#111827" }}>{typeof value === "boolean" ? (value ? "Yes" : "No") : value}</p>
      </div>
    );
  }

  return (
    <div className="print-report-container bg-white text-black" style={{ display: "none", fontFamily: "Georgia, serif", width: "100%" }}>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; visibility: hidden !important; }
          @page { margin: 0; size: letter; }
          .print-report-container {
            display: block !important;
            visibility: visible !important;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 0.62in 0.68in 0.80in 0.68in;
            box-sizing: border-box;
          }
          .print-report-container * { visibility: visible !important; }
          .print-section { break-inside: avoid; page-break-inside: avoid; }
          .print-section-heading { break-after: avoid; page-break-after: avoid; }
          .print-sig-section {
            break-inside: avoid;
            page-break-inside: avoid;
            padding-top: 0.62in;
          }
          .print-footer { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* ── Document Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1f2937", paddingBottom: "20px", marginBottom: "24px" }}>
        {/* Company identity */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
          {company?.companyLogoUrl && (
            <img
              src={company.companyLogoUrl}
              alt="Company logo"
              style={{ height: "60px", width: "auto", maxWidth: "160px", objectFit: "contain", flexShrink: 0 }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <p style={{ fontSize: "17px", fontWeight: 700, color: "#111827", margin: 0 }}>{company?.name || "Company"}</p>
            {company?.address && <p style={{ fontSize: "10px", color: "#6b7280" }}>{company.address}</p>}
            {company?.companyPhone && <p style={{ fontSize: "10px", color: "#6b7280" }}>{company.companyPhone}</p>}
            {company?.companyEmail && <p style={{ fontSize: "10px", color: "#6b7280" }}>{company.companyEmail}</p>}
          </div>
        </div>
        {/* Document identity */}
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: 0 }}>{typeInfo?.label || "Report"}</p>
          <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px", fontStyle: "italic" }}>Confidential Business Record</p>
          <p style={{ fontSize: "10px", color: "#6b7280", marginTop: "6px" }}>Ref: {reportId(rpt.id)}</p>
          <p style={{ fontSize: "10px", color: "#6b7280" }}>Prepared: {preparedDate}</p>
        </div>
      </div>

      {/* ── Report Title ── */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#111827", margin: "0 0 5px 0" }}>{rpt.title}</h1>
        {incidentCatLabel && <p style={{ fontSize: "12px", color: "#4b5563", fontStyle: "italic" }}>{incidentCatLabel}</p>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ── Incident Overview ── */}
        <section>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "12px" }}>
            Incident Overview
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 24px" }}>
            <PrintField label="Incident Date" value={rpt.incidentDate} />
            <PrintField label="Incident Time" value={rpt.incidentTime} />
            <PrintField label="Severity" value={rpt.severity ? rpt.severity.charAt(0).toUpperCase() + rpt.severity.slice(1) : null} />
            <PrintField label="Area Affected" value={rpt.areaAffected} />
            {assignedClient && <PrintField label="Client" value={assignedClient.name} />}
            {assignedLocation && <PrintField label="Service Location" value={assignedLocation.name} />}
            {assignedEmployee && <PrintField label="Employee Involved" value={`${assignedEmployee.firstName} ${assignedEmployee.lastName}`} />}
            {rpt.witnesses && <PrintField label="Witnesses / Others Present" value={rpt.witnesses} />}
          </div>
        </section>

        {/* ── Incident Description ── */}
        {(rpt.summary || rpt.employeeStatement || rpt.immediateAction) && (
          <section>
            <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "12px" }}>
              Incident Description
            </h2>
            {rpt.summary && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563", marginBottom: "4px" }}>Summary of Events</p>
                <p style={{ fontSize: "12px", color: "#111827", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{rpt.summary}</p>
              </div>
            )}
            {rpt.employeeStatement && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563", marginBottom: "4px" }}>Employee Statement</p>
                <p style={{ fontSize: "12px", color: "#111827", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>{rpt.employeeStatement}</p>
              </div>
            )}
            {rpt.immediateAction && (
              <div>
                <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563", marginBottom: "4px" }}>Immediate Action Taken</p>
                <p style={{ fontSize: "12px", color: "#111827", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{rpt.immediateAction}</p>
              </div>
            )}
          </section>
        )}

        {/* ── Impact / Property ── */}
        {(rpt.clientPropertyAffected || rpt.companyEquipmentAffected || rpt.workStopped || rpt.customerInformed || rpt.itemAffected) && (
          <section>
            <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "12px" }}>
              Impact &amp; Property
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 24px" }}>
              {rpt.clientPropertyAffected && <PrintField label="Client Property Affected" value="Yes" />}
              {rpt.companyEquipmentAffected && <PrintField label="Company Equipment Affected" value="Yes" />}
              {rpt.workStopped && <PrintField label="Work Stopped" value="Yes" />}
              {rpt.customerInformed && <PrintField label="Customer Informed" value="Yes" />}
              <PrintField label="Item Affected" value={rpt.itemAffected} />
              <PrintField label="Damage Type" value={rpt.damageType} />
              <PrintField label="Estimated Cost" value={rpt.estimatedCost ? `$${rpt.estimatedCost}` : null} />
            </div>
          </section>
        )}

        {/* ── Client Comments ── */}
        {rpt.clientComments && (
          <section>
            <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "12px" }}>
              Client Comments
            </h2>
            <p style={{ fontSize: "12px", color: "#111827", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>{rpt.clientComments}</p>
          </section>
        )}

        {/* ── Corrective Action / Follow-Up ── */}
        {(rpt.correctiveAction || rpt.nextSteps || rpt.finalDecision) && (
          <section>
            <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "12px" }}>
              Corrective Action &amp; Follow-Up
            </h2>
            {rpt.correctiveAction && (
              <div style={{ marginBottom: "10px" }}>
                <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563", marginBottom: "4px" }}>Corrective Action</p>
                <p style={{ fontSize: "12px", color: "#111827", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{rpt.correctiveAction}</p>
              </div>
            )}
            {rpt.nextSteps && (
              <div style={{ marginBottom: "10px" }}>
                <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563", marginBottom: "4px" }}>Follow-Up Recommendations</p>
                <p style={{ fontSize: "12px", color: "#111827", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{rpt.nextSteps}</p>
              </div>
            )}
            {rpt.finalDecision && (
              <div>
                <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563", marginBottom: "4px" }}>Management Comments</p>
                <p style={{ fontSize: "12px", color: "#111827", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{rpt.finalDecision}</p>
              </div>
            )}
          </section>
        )}

        {/* ── Acknowledgement & Signatures ── */}
        {(() => {
          const sigs: any[] = rpt.signatures || [];
          const signedRoles = new Set(sigs.map((s: any) => s.signerRole));

          const roleLabel = (role: string) =>
            role === "admin" ? "Prepared By"
            : role === "employee" ? "Employee"
            : role === "client" ? "Client"
            : role;

          const pendingBlocks = [
            { role: "admin-prepared", label: "Prepared By", sub: "Company Representative" },
            { role: "employee", label: "Employee", sub: "Acknowledging accuracy of report" },
            { role: "client", label: "Client", sub: "Acknowledging receipt of report" },
          ].filter(b => b.role === "admin-prepared" || !signedRoles.has(b.role));

          const allCards = [
            ...sigs.map((sig: any) => ({ type: "signed" as const, sig })),
            ...pendingBlocks.map(b => ({ type: "pending" as const, block: b })),
          ];

          if (allCards.length === 0) return null;

          return (
            <section className="print-sig-section" style={{ marginTop: "8px" }}>
              <h2 className="print-section-heading" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "16px" }}>
                Acknowledgement &amp; Signatures
              </h2>
              <div className="print-sig-section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                {allCards.map((card, i) => {
                  if (card.type === "signed") {
                    const sig = card.sig;
                    const hasDrawn = sig.signatureType === "drawn" && sig.signatureDataUrl;
                    const hasTyped = sig.signatureType === "typed";
                    return (
                      <div key={sig.id} className="print-section" style={{ border: "1px solid #d1d5db", borderRadius: "5px", padding: "10px 12px", background: "#f9fafb" }}>
                        {/* Title */}
                        <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#374151", margin: "0 0 8px 0" }}>{roleLabel(sig.signerRole)}</p>
                        {/* Signature graphic area */}
                        <div style={{ minHeight: "46px", display: "flex", alignItems: "center", borderBottom: "1px solid #e5e7eb", marginBottom: "7px", paddingBottom: "6px" }}>
                          {hasDrawn ? (
                            <img
                              src={sig.signatureDataUrl}
                              alt="Signature"
                              style={{ maxHeight: "44px", maxWidth: "100%", objectFit: "contain", objectPosition: "left center" }}
                            />
                          ) : hasTyped ? (
                            <p style={{ fontSize: "22px", fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600, color: "#1e293b", margin: 0, lineHeight: 1.2 }}>
                              {sig.signerName}
                            </p>
                          ) : (
                            <p style={{ fontSize: "11px", color: "#374151", margin: 0, fontStyle: "italic" }}>{sig.signerName}</p>
                          )}
                        </div>
                        {/* Metadata */}
                        <p style={{ fontSize: "9px", color: "#374151", margin: "0 0 1px 0" }}><span style={{ color: "#4b5563" }}>Name: </span>{sig.signerName}</p>
                        <p style={{ fontSize: "9px", color: "#374151", margin: "0 0 1px 0" }}><span style={{ color: "#4b5563" }}>Date: </span>{sig.signedAt ? format(new Date(sig.signedAt), "MMMM d, yyyy") : "—"}</p>
                        <p style={{ fontSize: "9px", color: "#374151", margin: "0 0 6px 0" }}><span style={{ color: "#4b5563" }}>Status: </span>Acknowledged</p>
                        <p style={{ fontSize: "8px", color: "#6b7280" }}>Signed electronically via Clockfield</p>
                      </div>
                    );
                  }
                  const block = card.block;
                  return (
                    <div key={block.label} className="print-section" style={{ border: "1px solid #d1d5db", borderRadius: "5px", padding: "10px 12px", minHeight: "80px" }}>
                      <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#374151", margin: "0 0 2px 0" }}>{block.label}</p>
                      <p style={{ fontSize: "8px", color: "#4b5563", marginBottom: "14px" }}>{block.sub}</p>
                      <div style={{ borderBottom: "1px solid #9ca3af", marginTop: "20px" }} />
                      <p style={{ fontSize: "8px", color: "#6b7280", marginTop: "4px" }}>Name, Signature &amp; Date</p>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* ── Footer ── */}
        <div className="print-footer" style={{ borderTop: "1px solid #e5e7eb", marginTop: "8px", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#6b7280" }}>
          <span>{company?.name || "Company"} · Confidential</span>
          <span>Prepared using Clockfield</span>
          <span>Generated {format(new Date(), "MMMM d, yyyy")} · {reportId(rpt.id)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Reports Page ──────────────────────────────────────────────────
export default function AdminReports() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: reports = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/reports"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });
  const { data: company } = useQuery<any>({ queryKey: ["/api/company"] });

  // Tab counts
  const counts = {
    all: reports.length,
    incoming: reports.filter(r => ["submitted"].includes(r.status) && r.createdByRole !== "admin").length,
    sent: reports.filter(r => r.sentToEmployee || r.sentToClient).length,
    drafts: reports.filter(r => r.status === "draft").length,
    needs_signature: reports.filter(r => r.requiresAdminSignature || r.requiresEmployeeSignature || r.requiresClientSignature).filter(r => r.status !== "finalized" && r.status !== "archived").length,
    completed: reports.filter(r => ["finalized", "closed"].includes(r.status)).length,
    archived: reports.filter(r => r.status === "archived").length,
  };

  const filtered = reports.filter(r => {
    if (tab === "incoming") return ["submitted"].includes(r.status) && r.createdByRole !== "admin";
    if (tab === "sent") return r.sentToEmployee || r.sentToClient;
    if (tab === "drafts") return r.status === "draft";
    if (tab === "needs_signature") return (r.requiresAdminSignature || r.requiresEmployeeSignature || r.requiresClientSignature) && !["finalized", "archived"].includes(r.status);
    if (tab === "completed") return ["finalized", "closed"].includes(r.status);
    if (tab === "archived") return r.status === "archived";
    return true;
  }).filter(r => {
    if (typeFilter !== "all" && r.reportType !== typeFilter) return false;
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create, manage, and track reports across your team</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-report">
          <Plus className="w-4 h-4 mr-2" />New Report
        </Button>
      </div>

      {/* Section nav */}
      <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg w-fit">
        <Link href="/admin/reports">
          <button data-testid="nav-section-reports" className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${location === "/admin/reports" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Reports
          </button>
        </Link>
        <Link href="/admin/requests">
          <button data-testid="nav-section-requests" className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${location.startsWith("/admin/requests") ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Requests
          </button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.all, icon: FileText, color: "text-primary" },
          { label: "Incoming", value: counts.incoming, icon: Inbox, color: "text-blue-600" },
          { label: "Drafts", value: counts.drafts, icon: PenLine, color: "text-amber-600" },
          { label: "Needs Signature", value: counts.needs_signature, icon: PenLine, color: "text-orange-600" },
        ].map(card => (
          <div key={card.label} className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-md bg-muted/50", card.color)}>
              <card.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <TabsList className="h-auto flex-wrap gap-1 bg-muted p-1">
            {[
              { key: "all", label: "All", count: counts.all },
              { key: "incoming", label: "Incoming", count: counts.incoming },
              { key: "sent", label: "Sent", count: counts.sent },
              { key: "drafts", label: "Drafts", count: counts.drafts },
              { key: "needs_signature", label: "Needs Signature", count: counts.needs_signature },
              { key: "completed", label: "Completed", count: counts.completed },
              { key: "archived", label: "Archived", count: counts.archived },
            ].map(t => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs gap-1.5" data-testid={`tab-${t.key}`}>
                {t.label}
                {t.count > 0 && <span className="bg-primary/15 text-primary text-[10px] px-1.5 rounded-full">{t.count}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm w-44"
              placeholder="Search reports..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search-reports"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-40 text-sm" data-testid="select-type-filter">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <FileText className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">No reports found</p>
            <p className="text-xs mt-1">Create a report to get started</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Report</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Assigned</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const typeInfo = getTypeInfo(r.reportType);
                const statusInfo = getStatusInfo(r.status);
                const emp = r.assignedEmployeeId ? employees.find((e: any) => e.id === r.assignedEmployeeId) : null;
                const cli = r.assignedClientId ? clients.find((c: any) => c.id === r.assignedClientId) : null;
                return (
                  <tr
                    key={r.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedId(r.id)}
                    data-testid={`row-report-${r.id}`}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium leading-snug">{r.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{reportId(r.id)}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", typeInfo.color)}>{typeInfo.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", statusInfo.color)}>{statusInfo.label}</span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {emp && <p className="text-xs flex items-center gap-1"><User className="w-3 h-3" />{emp.firstName} {emp.lastName}</p>}
                        {cli && <p className="text-xs flex items-center gap-1"><Building2 className="w-3 h-3" />{cli.name}</p>}
                        {!emp && !cli && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground hidden lg:table-cell">
                      {r.createdAt ? format(new Date(r.createdAt), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialogs */}
      {createOpen && (
        <CreateReportDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          employees={employees}
          clients={clients}
          locations={locations}
        />
      )}
      {selectedId && (
        <ReportDetailDialog
          reportId={selectedId}
          open={!!selectedId}
          onClose={() => setSelectedId(null)}
          employees={employees}
          clients={clients}
          locations={locations}
          company={company}
        />
      )}
    </div>
  );
}
