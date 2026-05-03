import { useState, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  X, ChevronLeft, ChevronRight, Check, Sparkles, Loader2, Plus, Trash2,
  User, AlertTriangle, FileText, Camera, Wrench, Zap, Target,
  ClipboardList, Bell, PenLine, Paperclip, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PersonEntry { name: string; role: string; contact: string; injured: boolean }
interface WitnessEntry { name: string; contact: string; statementAttached: boolean }
interface EquipmentEntry { item: string; damageType: string; estimatedValue: string; reportedBy: string }
interface CorrectiveActionEntry { action: string; responsible: string; deadline: string; completed: boolean }
interface AttachmentEntry { url: string; type: string; name: string }

interface WizardState {
  // Step 1
  position: string; supervisorNotified: boolean; supervisorName: string;
  // Step 2
  incidentDate: string; incidentTime: string; assignedLocationId: string;
  areaAffected: string; incidentTypes: string[]; severity: string;
  // Step 3
  peopleInvolved: PersonEntry[]; assignedEmployeeId: string; assignedClientId: string;
  // Step 4
  whatHappened: string; whereStarted: string; whatCaused: string;
  narrativeSummary: string; summary: string;
  // Step 5
  witnessList: WitnessEntry[];
  // Step 6
  attachments: AttachmentEntry[];
  // Step 7
  equipmentInvolved: EquipmentEntry[];
  // Step 8
  immediateAction: string; areaSecured: boolean; selectedActions: string[];
  // Step 9
  rootCause: string; contributingFactors: string[];
  // Step 10
  correctiveActionsStructured: CorrectiveActionEntry[];
  // Step 11
  clientNotified: boolean; notifiedBy: string; notificationDateTime: string; clientResponse: string;
  customerInformed: boolean;
  // Step 12
  requiresEmployeeSignature: boolean; requiresClientSignature: boolean; requiresAdminSignature: boolean;
  // Step 13
  attachmentsChecklist: { photos: boolean; witnessStatements: boolean; clientFeedback: boolean; equipmentChecklist: boolean; insuranceReport: boolean };
}

const INCIDENT_TYPE_OPTIONS = [
  "Injury to Worker", "Injury to Others", "Damage to Client Property",
  "Damage to Building", "Equipment Malfunction", "Near Miss", "Chemical Spill",
  "Water/Flooding", "Slip/Trip/Fall", "Other",
];

const INCIDENT_AREAS = [
  "Washroom", "Kitchen", "Office", "Hallway", "Lobby",
  "Storage Room", "Mechanical Room", "Loading Area", "Stairwell", "Mezzanine", "Boardroom", "Other",
];

const CONTRIBUTING_FACTOR_OPTIONS = [
  "Human error", "Equipment issue", "Environmental hazard",
  "Inadequate training", "Communication failure", "Fatigue", "Time pressure",
];

const IMMEDIATE_ACTION_OPTIONS = [
  "Area secured", "Client notified", "Supervisor notified",
  "Item removed from service", "Work paused", "Photos taken",
  "Cleanup completed", "First aid applied", "Emergency services called",
];

const PERSON_ROLES = ["Cleaner", "Supervisor", "Client", "Visitor", "Contractor", "Other"];
const DAMAGE_TYPES = ["Scratch", "Crack/Break", "Stain", "Flood/Water damage", "Electrical", "Structural", "Other"];

// ─── Photo Compression ────────────────────────────────────────────────────────
const MAX_DIM = 1400;
function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) { height = Math.round((height / width) * MAX_DIM); width = MAX_DIM; }
          else { width = Math.round((width / height) * MAX_DIM); height = MAX_DIM; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Chip Button ──────────────────────────────────────────────────────────────
function Chip({ active, onClick, children, small }: any) {
  return (
    <button type="button" onClick={onClick}
      className={cn("px-2.5 py-1 rounded-full text-xs border transition-all",
        small && "px-2 py-0.5",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50"
      )}>
      {children}
    </button>
  );
}

// ─── Dynamic List Row ─────────────────────────────────────────────────────────
function ListRow({ onRemove, children }: any) {
  return (
    <div className="relative border rounded-lg p-3 space-y-2 bg-muted/20">
      <button type="button" onClick={onRemove}
        className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {children}
    </div>
  );
}

// ─── Step Headers ─────────────────────────────────────────────────────────────
function StepHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-base">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────
function SL({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs text-muted-foreground font-medium">{children}</Label>;
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
const TOTAL_STEPS = 13;

const STEP_TITLES = [
  "Report Info", "Overview", "People", "Description",
  "Witnesses", "Evidence", "Equipment", "Actions",
  "Root Cause", "Corrections", "Notification", "Sign-off", "Review",
];

export default function IncidentReportWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [reportId, setReportId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiRefining, setAiRefining] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const timeStr = format(now, "HH:mm");

  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const [state, setState] = useState<WizardState>({
    position: "", supervisorNotified: false, supervisorName: "",
    incidentDate: todayStr, incidentTime: timeStr, assignedLocationId: "", areaAffected: "",
    incidentTypes: [], severity: "medium",
    peopleInvolved: [], assignedEmployeeId: "", assignedClientId: "",
    whatHappened: "", whereStarted: "", whatCaused: "", narrativeSummary: "", summary: "",
    witnessList: [],
    attachments: [],
    equipmentInvolved: [],
    immediateAction: "", areaSecured: false, selectedActions: [],
    rootCause: "", contributingFactors: [],
    correctiveActionsStructured: [],
    clientNotified: false, notifiedBy: "", notificationDateTime: "", clientResponse: "", customerInformed: false,
    requiresEmployeeSignature: false, requiresClientSignature: false, requiresAdminSignature: false,
    attachmentsChecklist: { photos: false, witnessStatements: false, clientFeedback: false, equipmentChecklist: false, insuranceReport: false },
  });

  const set = <K extends keyof WizardState>(key: K, val: WizardState[K]) =>
    setState(prev => ({ ...prev, [key]: val }));

  // Build payload for saving
  function buildPayload() {
    const incidentTypes = JSON.stringify(state.incidentTypes);
    const peopleInvolved = JSON.stringify(state.peopleInvolved);
    const witnessList = JSON.stringify(state.witnessList);
    const equipmentInvolved = JSON.stringify(state.equipmentInvolved);
    const contributingFactors = JSON.stringify(state.contributingFactors);
    const correctiveActionsStructured = JSON.stringify(state.correctiveActionsStructured);
    const clientNotificationDetail = JSON.stringify({
      notified: state.clientNotified, notifiedBy: state.notifiedBy,
      dateTime: state.notificationDateTime, clientResponse: state.clientResponse,
    });
    const attachmentsChecklist = JSON.stringify(state.attachmentsChecklist);
    const attachments = JSON.stringify(state.attachments);
    const title = state.whatHappened
      ? (state.whatHappened.slice(0, 50) + (state.whatHappened.length > 50 ? "…" : ""))
      : "Incident Report";

    return {
      reportType: "incident",
      title,
      summary: state.summary || state.narrativeSummary || state.whatHappened,
      narrativeSummary: state.narrativeSummary,
      incidentDate: state.incidentDate,
      incidentTime: state.incidentTime,
      severity: state.severity,
      areaAffected: state.areaAffected,
      assignedLocationId: state.assignedLocationId || undefined,
      assignedEmployeeId: state.assignedEmployeeId || undefined,
      assignedClientId: state.assignedClientId || undefined,
      supervisorNotified: state.supervisorNotified,
      supervisorName: state.supervisorName,
      incidentTypes,
      peopleInvolved,
      witnessList,
      equipmentInvolved,
      immediateAction: state.immediateAction,
      areaSecured: state.areaSecured,
      rootCause: state.rootCause,
      contributingFactors,
      correctiveActionsStructured,
      clientNotificationDetail,
      customerInformed: state.clientNotified,
      requiresEmployeeSignature: state.requiresEmployeeSignature,
      requiresClientSignature: state.requiresClientSignature,
      requiresAdminSignature: state.requiresAdminSignature,
      attachments,
      attachmentsChecklist,
    };
  }

  // Save current state to API
  async function save(newStatus?: string) {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (newStatus) (payload as any).status = newStatus;

      if (!reportId) {
        const res = await apiRequest("POST", "/api/reports", { ...payload, status: "draft" });
        const data = await res.json();
        setReportId(data.id);
        qc.invalidateQueries({ queryKey: ["/api/reports"] });
        return data.id;
      } else {
        await apiRequest("PATCH", `/api/reports/${reportId}`, payload);
        qc.invalidateQueries({ queryKey: ["/api/reports"] });
        return reportId;
      }
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    await save();
    setStep(s => Math.min(TOTAL_STEPS, s + 1));
    window.scrollTo(0, 0);
  }

  function goPrev() {
    setStep(s => Math.max(1, s - 1));
    window.scrollTo(0, 0);
  }

  async function handleFinalSubmit(status: string) {
    const id = await save(status);
    if (id) {
      toast({ title: status === "submitted" ? "Report submitted" : "Draft saved", description: "Incident report has been saved." });
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      onClose();
    }
  }

  // AI narrative refinement
  async function refineWithAI() {
    if (!state.whatHappened.trim()) {
      toast({ title: "Describe what happened first", variant: "destructive" }); return;
    }
    setAiRefining(true);
    try {
      const res = await apiRequest("POST", "/api/reports/refine-incident", {
        whatHappened: state.whatHappened,
        whatCaused: state.whatCaused,
        immediateAction: state.immediateAction,
        whoInvolved: state.peopleInvolved.map(p => p.name).join(", "),
        whatAffected: state.equipmentInvolved.map(e => e.item).join(", "),
        incidentCategory: state.incidentTypes[0] || "",
        areaAffected: state.areaAffected,
      });
      if (!res.ok) { toast({ title: "AI unavailable", description: "Please write the narrative manually.", variant: "destructive" }); return; }
      const result = await res.json();
      if (result.refinedDescription) set("narrativeSummary", result.refinedDescription);
      if (result.refinedDescription && !state.summary) set("summary", result.refinedDescription);
    } catch {
      toast({ title: "AI unavailable", description: "Please write the narrative manually.", variant: "destructive" });
    } finally {
      setAiRefining(false);
    }
  }

  // Photo upload
  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCompressing(true);
    try {
      const dataUrls = await Promise.all(files.map(f => compressPhoto(f)));
      const newAttachments: AttachmentEntry[] = dataUrls.map((url, i) => ({
        url, type: "image/jpeg", name: files[i].name,
      }));
      set("attachments", [...state.attachments, ...newAttachments]);
      set("attachmentsChecklist", { ...state.attachmentsChecklist, photos: true });
    } finally {
      setCompressing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Toggle contributor factor
  function toggleFactor(f: string) {
    const next = state.contributingFactors.includes(f)
      ? state.contributingFactors.filter(x => x !== f)
      : [...state.contributingFactors, f];
    set("contributingFactors", next);
  }

  // Toggle incident type
  function toggleType(t: string) {
    const next = state.incidentTypes.includes(t)
      ? state.incidentTypes.filter(x => x !== t)
      : [...state.incidentTypes, t];
    set("incidentTypes", next);
  }

  // Toggle immediate action
  function toggleAction(a: string) {
    const next = state.selectedActions.includes(a)
      ? state.selectedActions.filter(x => x !== a)
      : [...state.selectedActions, a];
    set("selectedActions", next);
    set("immediateAction", next.join("; "));
  }

  if (!open) return null;

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden" data-testid="incident-wizard">
      {/* ── Header ── */}
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-background shrink-0">
        <button type="button" onClick={onClose} className="p-1.5 hover:bg-muted rounded-md transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Incident Report</p>
          <p className="text-sm font-medium truncate">Step {step} of {TOTAL_STEPS}: {STEP_TITLES[step - 1]}</p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        <Badge variant="outline" className="text-xs">{Math.round(progressPct)}%</Badge>
      </div>

      {/* ── Progress Bar ── */}
      <div className="h-1 bg-muted shrink-0">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Step Pills ── */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto scrollbar-none shrink-0 border-b">
        {STEP_TITLES.map((title, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { if (reportId || i === 0) setStep(i + 1); }}
            data-testid={`wizard-step-${i + 1}`}
            className={cn(
              "flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
              step === i + 1 ? "bg-primary text-primary-foreground" :
              step > i + 1 ? "bg-green-100 text-green-700" :
              "text-muted-foreground hover:text-foreground"
            )}
          >
            {step > i + 1 ? <span className="flex items-center gap-1"><Check className="w-2.5 h-2.5" />{title}</span> : title}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full">

        {/* STEP 1: Report Information */}
        {step === 1 && (
          <div className="space-y-4">
            <StepHeader icon={FileText} title="Report Information" desc="Auto-filled details about this report and who prepared it." />
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4">
              <div><SL>Date of Report</SL><p className="text-sm font-medium mt-1">{format(now, "MMMM d, yyyy")}</p></div>
              <div><SL>Time of Report</SL><p className="text-sm font-medium mt-1">{format(now, "h:mm a")}</p></div>
              <div><SL>Prepared By</SL><p className="text-sm font-medium mt-1">{user?.firstName} {user?.lastName}</p></div>
              <div><SL>Role</SL><p className="text-sm font-medium mt-1 capitalize">{user?.role}</p></div>
            </div>
            <div className="space-y-1.5">
              <SL>Position / Title (optional)</SL>
              <Input value={state.position} onChange={e => set("position", e.target.value)} placeholder="e.g. Lead Cleaner, Site Supervisor…" data-testid="input-position" />
            </div>
            <div className="space-y-2">
              <SL>Was a supervisor notified?</SL>
              <div className="flex gap-2">
                <Chip active={state.supervisorNotified} onClick={() => set("supervisorNotified", true)}>Yes</Chip>
                <Chip active={!state.supervisorNotified} onClick={() => set("supervisorNotified", false)}>No</Chip>
              </div>
            </div>
            {state.supervisorNotified && (
              <div className="space-y-1.5">
                <SL>Supervisor Name</SL>
                <Input value={state.supervisorName} onChange={e => set("supervisorName", e.target.value)} placeholder="Supervisor's full name" data-testid="input-supervisor-name" />
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Incident Overview */}
        {step === 2 && (
          <div className="space-y-4">
            <StepHeader icon={AlertTriangle} title="Incident Overview" desc="When, where, and what type of incident occurred." />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <SL>Date of Incident *</SL>
                <Input type="date" value={state.incidentDate} onChange={e => set("incidentDate", e.target.value)} data-testid="input-incident-date" />
              </div>
              <div className="space-y-1.5">
                <SL>Time of Incident</SL>
                <Input type="time" value={state.incidentTime} onChange={e => set("incidentTime", e.target.value)} data-testid="input-incident-time" />
              </div>
            </div>
            <div className="space-y-1.5">
              <SL>Location / Site</SL>
              <Select value={state.assignedLocationId || "none"} onValueChange={v => set("assignedLocationId", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-location"><SelectValue placeholder="Select site…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(locations as any[]).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <SL>Area / Zone</SL>
              <div className="flex flex-wrap gap-1.5">
                {INCIDENT_AREAS.map(a => (
                  <Chip key={a} active={state.areaAffected === a} onClick={() => set("areaAffected", state.areaAffected === a ? "" : a)}>{a}</Chip>
                ))}
              </div>
              <Input value={state.areaAffected} onChange={e => set("areaAffected", e.target.value)} placeholder="Or type the area name…" className="mt-1" data-testid="input-area" />
            </div>
            <div className="space-y-2">
              <SL>Incident Type (select all that apply)</SL>
              <div className="flex flex-wrap gap-1.5">
                {INCIDENT_TYPE_OPTIONS.map(t => (
                  <Chip key={t} active={state.incidentTypes.includes(t)} onClick={() => toggleType(t)}>{t}</Chip>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <SL>Severity</SL>
              <div className="flex gap-2">
                {[{v:"low",l:"Low"},{v:"medium",l:"Medium"},{v:"high",l:"High"},{v:"critical",l:"Critical"}].map(s => (
                  <Chip key={s.v} active={state.severity === s.v} onClick={() => set("severity", s.v)}>{s.l}</Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: People Involved */}
        {step === 3 && (
          <div className="space-y-4">
            <StepHeader icon={User} title="People Involved" desc="Everyone present or involved in the incident." />
            {/* Quick-add from employee list */}
            <div className="space-y-1.5">
              <SL>Quick-add from Employee List</SL>
              <Select value="" onValueChange={v => {
                const emp = (employees as any[]).find((e: any) => e.id === v);
                if (!emp) return;
                const already = state.peopleInvolved.find(p => p.name === `${emp.firstName} ${emp.lastName}`);
                if (already) return;
                set("peopleInvolved", [...state.peopleInvolved, { name: `${emp.firstName} ${emp.lastName}`, role: "Cleaner", contact: emp.email || "", injured: false }]);
              }}>
                <SelectTrigger data-testid="select-quick-add-employee"><SelectValue placeholder="Select employee to add…" /></SelectTrigger>
                <SelectContent>
                  {(employees as any[]).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {state.peopleInvolved.map((person, i) => (
                <ListRow key={i} onRemove={() => set("peopleInvolved", state.peopleInvolved.filter((_, j) => j !== i))}>
                  <div className="grid grid-cols-2 gap-2 pr-6">
                    <div className="space-y-1">
                      <SL>Full Name</SL>
                      <Input value={person.name} onChange={e => {
                        const arr = [...state.peopleInvolved]; arr[i] = { ...arr[i], name: e.target.value };
                        set("peopleInvolved", arr);
                      }} placeholder="Full name" data-testid={`input-person-name-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <SL>Role</SL>
                      <Select value={person.role} onValueChange={v => {
                        const arr = [...state.peopleInvolved]; arr[i] = { ...arr[i], role: v };
                        set("peopleInvolved", arr);
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PERSON_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <SL>Contact Info</SL>
                      <Input value={person.contact} onChange={e => {
                        const arr = [...state.peopleInvolved]; arr[i] = { ...arr[i], contact: e.target.value };
                        set("peopleInvolved", arr);
                      }} placeholder="Phone or email" />
                    </div>
                    <div className="space-y-1">
                      <SL>Injured?</SL>
                      <div className="flex gap-2 mt-1">
                        <Chip active={person.injured} onClick={() => { const arr = [...state.peopleInvolved]; arr[i] = { ...arr[i], injured: true }; set("peopleInvolved", arr); }}>Yes</Chip>
                        <Chip active={!person.injured} onClick={() => { const arr = [...state.peopleInvolved]; arr[i] = { ...arr[i], injured: false }; set("peopleInvolved", arr); }}>No</Chip>
                      </div>
                    </div>
                  </div>
                </ListRow>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => set("peopleInvolved", [...state.peopleInvolved, { name: "", role: "Cleaner", contact: "", injured: false }])} data-testid="button-add-person">
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Person
            </Button>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <SL>Assigned Employee (for routing)</SL>
                <Select value={state.assignedEmployeeId || "none"} onValueChange={v => set("assignedEmployeeId", v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-assigned-employee"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(employees as any[]).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <SL>Assigned Client (for routing)</SL>
                <Select value={state.assignedClientId || "none"} onValueChange={v => set("assignedClientId", v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-assigned-client"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(clients as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Description */}
        {step === 4 && (
          <div className="space-y-4">
            <StepHeader icon={ClipboardList} title="Description of Incident" desc="Describe the incident in detail. AI will generate a professional narrative." />
            <div className="space-y-1.5">
              <SL>What happened? *</SL>
              <Textarea value={state.whatHappened} onChange={e => set("whatHappened", e.target.value)} placeholder="Describe the incident in your own words…" rows={3} data-testid="input-what-happened" />
            </div>
            <div className="space-y-1.5">
              <SL>Where did it start / originate?</SL>
              <Input value={state.whereStarted} onChange={e => set("whereStarted", e.target.value)} placeholder="Specific location or starting point…" data-testid="input-where-started" />
            </div>
            <div className="space-y-1.5">
              <SL>What caused it (if known)?</SL>
              <Textarea value={state.whatCaused} onChange={e => set("whatCaused", e.target.value)} placeholder="Known or suspected cause…" rows={2} data-testid="input-what-caused" />
            </div>
            {/* AI Refinement */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">AI Narrative Generator</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={refineWithAI} disabled={aiRefining || !state.whatHappened.trim()} data-testid="button-refine-ai" className="border-primary/30">
                  {aiRefining ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  {aiRefining ? "Generating…" : "Generate Narrative"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">AI converts your notes into a clean, professional paragraph (like a real incident report narrative).</p>
            </div>
            <div className="space-y-1.5">
              <SL>Narrative Summary (editable)</SL>
              <Textarea value={state.narrativeSummary || state.summary} onChange={e => { set("narrativeSummary", e.target.value); set("summary", e.target.value); }} placeholder="AI-generated narrative will appear here. You can also write it manually…" rows={5} data-testid="input-narrative" />
              <p className="text-xs text-muted-foreground">This becomes the main description of the report.</p>
            </div>
          </div>
        )}

        {/* STEP 5: Witnesses */}
        {step === 5 && (
          <div className="space-y-4">
            <StepHeader icon={User} title="Witnesses" desc="Anyone who witnessed the incident." />
            <div className="space-y-2">
              {state.witnessList.map((w, i) => (
                <ListRow key={i} onRemove={() => set("witnessList", state.witnessList.filter((_, j) => j !== i))}>
                  <div className="grid grid-cols-2 gap-2 pr-6">
                    <div className="space-y-1">
                      <SL>Witness Name</SL>
                      <Input value={w.name} onChange={e => { const arr = [...state.witnessList]; arr[i] = { ...arr[i], name: e.target.value }; set("witnessList", arr); }} placeholder="Full name" data-testid={`input-witness-name-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <SL>Contact Info</SL>
                      <Input value={w.contact} onChange={e => { const arr = [...state.witnessList]; arr[i] = { ...arr[i], contact: e.target.value }; set("witnessList", arr); }} placeholder="Phone or email" />
                    </div>
                    <div className="space-y-1">
                      <SL>Statement Attached?</SL>
                      <div className="flex gap-2 mt-1">
                        <Chip active={w.statementAttached} onClick={() => { const arr = [...state.witnessList]; arr[i] = { ...arr[i], statementAttached: true }; set("witnessList", arr); set("attachmentsChecklist", { ...state.attachmentsChecklist, witnessStatements: true }); }}>Yes</Chip>
                        <Chip active={!w.statementAttached} onClick={() => { const arr = [...state.witnessList]; arr[i] = { ...arr[i], statementAttached: false }; set("witnessList", arr); }}>No</Chip>
                      </div>
                    </div>
                  </div>
                </ListRow>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => set("witnessList", [...state.witnessList, { name: "", contact: "", statementAttached: false }])} data-testid="button-add-witness">
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Witness
            </Button>
            {state.witnessList.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No witnesses? That's fine — continue to next step.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 6: Evidence */}
        {step === 6 && (
          <div className="space-y-4">
            <StepHeader icon={Camera} title="Evidence" desc="Upload photos from the incident scene." />
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} data-testid="input-photos" />
            <Button type="button" variant="outline" className="w-full h-24 border-dashed flex-col gap-2" onClick={() => fileRef.current?.click()} disabled={compressing} data-testid="button-upload-photos">
              {compressing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground">{compressing ? "Compressing…" : "Tap to upload photos"}</span>
            </Button>
            {state.attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {state.attachments.map((att, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border aspect-square bg-muted">
                    <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => set("attachments", state.attachments.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-photo-${i}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <p className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] px-1.5 py-0.5 truncate">{att.name}</p>
                  </div>
                ))}
              </div>
            )}
            {state.attachments.length === 0 && !compressing && (
              <p className="text-center text-xs text-muted-foreground py-4">No photos uploaded yet. You can continue without photos.</p>
            )}
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground"><span className="font-medium">Tip:</span> Photos are automatically compressed for storage. Include wide shots of the area and close-ups of any damage.</p>
            </div>
          </div>
        )}

        {/* STEP 7: Equipment / Property */}
        {step === 7 && (
          <div className="space-y-4">
            <StepHeader icon={Wrench} title="Equipment & Property Involved" desc="Any equipment or property affected by the incident." />
            <div className="space-y-2">
              {state.equipmentInvolved.map((eq, i) => (
                <ListRow key={i} onRemove={() => set("equipmentInvolved", state.equipmentInvolved.filter((_, j) => j !== i))}>
                  <div className="grid grid-cols-2 gap-2 pr-6">
                    <div className="space-y-1">
                      <SL>Item / Area</SL>
                      <Input value={eq.item} onChange={e => { const arr = [...state.equipmentInvolved]; arr[i] = { ...arr[i], item: e.target.value }; set("equipmentInvolved", arr); }} placeholder="e.g. Washroom tiles, vacuum" data-testid={`input-eq-item-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <SL>Type of Damage</SL>
                      <Select value={eq.damageType || "none"} onValueChange={v => { const arr = [...state.equipmentInvolved]; arr[i] = { ...arr[i], damageType: v === "none" ? "" : v }; set("equipmentInvolved", arr); }}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select type</SelectItem>
                          {DAMAGE_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <SL>Estimated Value ($)</SL>
                      <Input type="number" value={eq.estimatedValue} onChange={e => { const arr = [...state.equipmentInvolved]; arr[i] = { ...arr[i], estimatedValue: e.target.value }; set("equipmentInvolved", arr); }} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <SL>Reported By</SL>
                      <Input value={eq.reportedBy} onChange={e => { const arr = [...state.equipmentInvolved]; arr[i] = { ...arr[i], reportedBy: e.target.value }; set("equipmentInvolved", arr); }} placeholder="Who identified this" />
                    </div>
                  </div>
                </ListRow>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => set("equipmentInvolved", [...state.equipmentInvolved, { item: "", damageType: "", estimatedValue: "", reportedBy: "" }])} data-testid="button-add-equipment">
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Item / Property
            </Button>
            {state.equipmentInvolved.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">No equipment or property affected? Continue to the next step.</p>
            )}
          </div>
        )}

        {/* STEP 8: Immediate Actions */}
        {step === 8 && (
          <div className="space-y-4">
            <StepHeader icon={Zap} title="Immediate Actions Taken" desc="What was done right after the incident occurred." />
            <div className="space-y-2">
              <SL>Quick-select actions taken</SL>
              <div className="flex flex-wrap gap-1.5">
                {IMMEDIATE_ACTION_OPTIONS.map(opt => (
                  <Chip key={opt} active={state.selectedActions.includes(opt)} onClick={() => toggleAction(opt)}>{opt}</Chip>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <SL>Describe actions in detail (or confirm the selections above)</SL>
              <Textarea value={state.immediateAction} onChange={e => set("immediateAction", e.target.value)} placeholder="Describe immediate actions taken…" rows={3} data-testid="input-immediate-action" />
            </div>
            <div className="space-y-2">
              <SL>Was the area secured / made safe?</SL>
              <div className="flex gap-2">
                <Chip active={state.areaSecured} onClick={() => set("areaSecured", true)}>Yes</Chip>
                <Chip active={!state.areaSecured} onClick={() => set("areaSecured", false)}>No</Chip>
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-700">Cleaning-specific checklist</p>
              {[
                "Vacuum/suction used", "Water extraction performed", "Chemical applied",
                "Area cordoned off", "Wet floor signs placed",
              ].map(item => (
                <label key={item} className="flex items-center gap-2 mt-2 text-xs text-amber-800 cursor-pointer">
                  <Checkbox checked={state.selectedActions.includes(item)} onCheckedChange={v => {
                    const next = v ? [...state.selectedActions, item] : state.selectedActions.filter(a => a !== item);
                    set("selectedActions", next);
                    set("immediateAction", next.join("; "));
                  }} />
                  {item}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* STEP 9: Root Cause */}
        {step === 9 && (
          <div className="space-y-4">
            <StepHeader icon={Target} title="Root Cause Analysis" desc="Identify the root cause and contributing factors." />
            <div className="space-y-1.5">
              <SL>Root Cause</SL>
              <Textarea value={state.rootCause} onChange={e => set("rootCause", e.target.value)} placeholder="What was the primary root cause of this incident?" rows={3} data-testid="input-root-cause" />
            </div>
            <div className="space-y-2">
              <SL>Contributing Factors (select all that apply)</SL>
              <div className="flex flex-wrap gap-1.5">
                {CONTRIBUTING_FACTOR_OPTIONS.map(f => (
                  <Chip key={f} active={state.contributingFactors.includes(f)} onClick={() => toggleFactor(f)}>{f}</Chip>
                ))}
              </div>
              {state.contributingFactors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {state.contributingFactors.map(f => (
                    <Badge key={f} variant="secondary" className="text-xs gap-1">
                      {f}
                      <button type="button" onClick={() => toggleFactor(f)}><X className="w-2.5 h-2.5" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 10: Corrective Actions */}
        {step === 10 && (
          <div className="space-y-4">
            <StepHeader icon={ClipboardList} title="Corrective Actions" desc="Steps to prevent this from happening again." />
            <div className="space-y-2">
              {state.correctiveActionsStructured.map((ca, i) => (
                <ListRow key={i} onRemove={() => set("correctiveActionsStructured", state.correctiveActionsStructured.filter((_, j) => j !== i))}>
                  <div className="grid grid-cols-2 gap-2 pr-6">
                    <div className="col-span-2 space-y-1">
                      <SL>Action Item</SL>
                      <Input value={ca.action} onChange={e => { const arr = [...state.correctiveActionsStructured]; arr[i] = { ...arr[i], action: e.target.value }; set("correctiveActionsStructured", arr); }} placeholder="e.g. Use closed container when carrying water" data-testid={`input-ca-action-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <SL>Responsible Person</SL>
                      <Input value={ca.responsible} onChange={e => { const arr = [...state.correctiveActionsStructured]; arr[i] = { ...arr[i], responsible: e.target.value }; set("correctiveActionsStructured", arr); }} placeholder="Name or role" />
                    </div>
                    <div className="space-y-1">
                      <SL>Deadline</SL>
                      <Input type="date" value={ca.deadline} onChange={e => { const arr = [...state.correctiveActionsStructured]; arr[i] = { ...arr[i], deadline: e.target.value }; set("correctiveActionsStructured", arr); }} />
                    </div>
                    <div className="space-y-1">
                      <SL>Completed?</SL>
                      <div className="flex gap-2 mt-1">
                        <Chip active={ca.completed} onClick={() => { const arr = [...state.correctiveActionsStructured]; arr[i] = { ...arr[i], completed: true }; set("correctiveActionsStructured", arr); }}>Yes</Chip>
                        <Chip active={!ca.completed} onClick={() => { const arr = [...state.correctiveActionsStructured]; arr[i] = { ...arr[i], completed: false }; set("correctiveActionsStructured", arr); }}>No</Chip>
                      </div>
                    </div>
                  </div>
                </ListRow>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => set("correctiveActionsStructured", [...state.correctiveActionsStructured, { action: "", responsible: "", deadline: "", completed: false }])} data-testid="button-add-corrective-action">
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Corrective Action
            </Button>
          </div>
        )}

        {/* STEP 11: Client Notification */}
        {step === 11 && (
          <div className="space-y-4">
            <StepHeader icon={Bell} title="Client Notification" desc="Was the client notified about this incident?" />
            <div className="space-y-2">
              <SL>Was the client notified?</SL>
              <div className="flex gap-2">
                <Chip active={state.clientNotified} onClick={() => { set("clientNotified", true); set("customerInformed", true); }}>Yes</Chip>
                <Chip active={!state.clientNotified} onClick={() => { set("clientNotified", false); set("customerInformed", false); }}>No</Chip>
              </div>
            </div>
            {state.clientNotified && (
              <>
                <div className="space-y-1.5">
                  <SL>Notified By</SL>
                  <Input value={state.notifiedBy} onChange={e => set("notifiedBy", e.target.value)} placeholder="Who notified the client?" data-testid="input-notified-by" />
                </div>
                <div className="space-y-1.5">
                  <SL>Date & Time of Notification</SL>
                  <Input type="datetime-local" value={state.notificationDateTime} onChange={e => set("notificationDateTime", e.target.value)} data-testid="input-notification-datetime" />
                </div>
                <div className="space-y-1.5">
                  <SL>Client's Response</SL>
                  <Textarea value={state.clientResponse} onChange={e => set("clientResponse", e.target.value)} placeholder="What was the client's response or reaction?" rows={3} data-testid="input-client-response" />
                </div>
              </>
            )}
            {!state.clientNotified && (
              <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
                The client was not notified. You can send the report to the client later from the Reports page.
              </div>
            )}
          </div>
        )}

        {/* STEP 12: Final Sign-off */}
        {step === 12 && (
          <div className="space-y-4">
            <StepHeader icon={PenLine} title="Final Sign-off" desc="Configure who needs to sign this report." />
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Signature Requirements</p>
              {[
                { key: "requiresEmployeeSignature", label: "Employee signature required", desc: "The assigned employee must sign." },
                { key: "requiresClientSignature", label: "Client signature required", desc: "The client must acknowledge and sign." },
                { key: "requiresAdminSignature", label: "Admin / manager signature required", desc: "An admin must sign off." },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={(state as any)[key]}
                    onCheckedChange={v => set(key as keyof WizardState, !!v as any)}
                    data-testid={`check-${key}`}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-2">
              <p className="text-xs font-medium text-blue-700 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Public Link System</p>
              <p className="text-xs text-blue-600">After saving, you can send this report to employees and clients via a secure link. They can sign digitally without needing a login account.</p>
            </div>
          </div>
        )}

        {/* STEP 13: Attachments Checklist & Submit */}
        {step === 13 && (
          <div className="space-y-4">
            <StepHeader icon={Paperclip} title="Attachments & Submit" desc="Review the attachments checklist and submit your incident report." />

            {/* Summary */}
            <div className="rounded-lg bg-muted/30 p-4 space-y-2 text-sm">
              <p className="font-semibold text-base mb-2">Report Summary</p>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                <div><span className="text-muted-foreground">Incident Date:</span> <span className="font-medium">{state.incidentDate || "—"}</span></div>
                <div><span className="text-muted-foreground">Severity:</span> <span className="font-medium capitalize">{state.severity}</span></div>
                <div><span className="text-muted-foreground">Area:</span> <span className="font-medium">{state.areaAffected || "—"}</span></div>
                <div><span className="text-muted-foreground">Types:</span> <span className="font-medium">{state.incidentTypes.length > 0 ? state.incidentTypes.slice(0, 2).join(", ") + (state.incidentTypes.length > 2 ? `+${state.incidentTypes.length - 2}` : "") : "—"}</span></div>
                <div><span className="text-muted-foreground">People:</span> <span className="font-medium">{state.peopleInvolved.length}</span></div>
                <div><span className="text-muted-foreground">Witnesses:</span> <span className="font-medium">{state.witnessList.length}</span></div>
                <div><span className="text-muted-foreground">Photos:</span> <span className="font-medium">{state.attachments.length}</span></div>
                <div><span className="text-muted-foreground">Actions:</span> <span className="font-medium">{state.correctiveActionsStructured.length}</span></div>
              </div>
            </div>

            {/* Attachments Checklist */}
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-semibold">Attachments Checklist</p>
              {(Object.keys(state.attachmentsChecklist) as Array<keyof typeof state.attachmentsChecklist>).map(key => {
                const labels: Record<string, string> = {
                  photos: "Photos / Images",
                  witnessStatements: "Witness Statements",
                  clientFeedback: "Client Feedback",
                  equipmentChecklist: "Equipment Checklist",
                  insuranceReport: "Insurance Report",
                };
                return (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={state.attachmentsChecklist[key]}
                      onCheckedChange={v => set("attachmentsChecklist", { ...state.attachmentsChecklist, [key]: !!v })}
                      data-testid={`check-attach-${key}`}
                    />
                    <span className="text-sm">{labels[key]}</span>
                    {key === "photos" && state.attachments.length > 0 && (
                      <Badge variant="secondary" className="text-xs ml-auto">{state.attachments.length} photo{state.attachments.length !== 1 ? "s" : ""}</Badge>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground font-medium">How do you want to save this report?</p>
              <div className="flex flex-col gap-2">
                <Button type="button" className="w-full" onClick={() => handleFinalSubmit("submitted")} data-testid="button-submit-report">
                  <Check className="w-4 h-4 mr-2" />Submit Incident Report
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => handleFinalSubmit("draft")} data-testid="button-save-draft">
                  Save as Draft
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Submitting will notify your admin team. Save as Draft to review before submitting.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer Navigation ── */}
      <div className="border-t px-4 py-3 flex items-center justify-between bg-background shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={step === 1} data-testid="button-wizard-prev">
          <ChevronLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <span className="text-xs text-muted-foreground">{step} / {TOTAL_STEPS}</span>
        {step < TOTAL_STEPS ? (
          <Button type="button" size="sm" onClick={goNext} disabled={saving} data-testid="button-wizard-next">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Next<ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => {}} disabled className="invisible">
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}
