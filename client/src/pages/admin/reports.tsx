import { useState } from "react";
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
import {
  FileText, Plus, Search, Filter, Eye, Send, CheckCircle2, Archive,
  RotateCcw, Printer, Download, ChevronRight, AlertTriangle, Clock,
  Inbox, FolderOpen, PenLine, X, User, Building2, MapPin, Calendar,
  ClipboardList, Shield, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
    immediateAction: "", internalNotes: "",
    status: "draft",
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/reports", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Create New Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label>Initial Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Report Title *</Label>
            <Input
              data-testid="input-report-title"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Brief title describing the report..."
            />
          </div>

          {/* Linked entities */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><User className="w-3 h-3" />Employee</Label>
              <Select value={form.assignedEmployeeId || "none"} onValueChange={v => set("assignedEmployeeId", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />Client</Label>
              <Select value={form.assignedClientId || "none"} onValueChange={v => set("assignedClientId", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />Location</Label>
              <Select value={form.assignedLocationId || "none"} onValueChange={v => set("assignedLocationId", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-location">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date/time + severity */}
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
              <Select value={form.severity} onValueChange={v => set("severity", v)}>
                <SelectTrigger data-testid="select-severity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label>Summary / Description</Label>
            <Textarea
              data-testid="input-summary"
              value={form.summary}
              onChange={e => set("summary", e.target.value)}
              placeholder="Describe what happened..."
              rows={4}
            />
          </div>

          {/* Immediate action */}
          <div className="space-y-1.5">
            <Label>Immediate Action Taken</Label>
            <Textarea
              data-testid="input-immediate-action"
              value={form.immediateAction}
              onChange={e => set("immediateAction", e.target.value)}
              placeholder="What action was taken immediately..."
              rows={2}
            />
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { field: "clientPropertyAffected", label: "Client property affected" },
              { field: "companyEquipmentAffected", label: "Company equipment affected" },
              { field: "workStopped", label: "Work was stopped" },
              { field: "customerInformed", label: "Customer was informed" },
            ].map(item => (
              <label key={item.field} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={(form as any)[item.field]}
                  onCheckedChange={v => set(item.field, !!v)}
                  data-testid={`check-${item.field}`}
                />
                {item.label}
              </label>
            ))}
          </div>

          {/* Internal notes */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-muted-foreground">
              <Shield className="w-3 h-3" />
              Internal Notes (Admin-only, not visible to employee/client)
            </Label>
            <Textarea
              data-testid="input-internal-notes"
              value={form.internalNotes}
              onChange={e => set("internalNotes", e.target.value)}
              placeholder="Internal admin notes..."
              rows={2}
            />
          </div>

          {/* Signature requirements */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Signature Requirements</Label>
            <div className="flex gap-4 flex-wrap">
              {[
                { field: "requiresEmployeeSignature", label: "Employee signature" },
                { field: "requiresClientSignature", label: "Client signature" },
                { field: "requiresAdminSignature", label: "Admin signature" },
              ].map(item => (
                <label key={item.field} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={(form as any)[item.field]}
                    onCheckedChange={v => set(item.field, !!v)}
                    data-testid={`check-sig-${item.field}`}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-report">Cancel</Button>
          <Button
            variant="outline"
            onClick={() => createMut.mutate({ ...form, status: "draft" })}
            disabled={!form.title || createMut.isPending}
            data-testid="button-save-draft"
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => createMut.mutate({ ...form, status: "submitted" })}
            disabled={!form.title || createMut.isPending}
            data-testid="button-create-report"
          >
            Create Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Send Report Dialog ───────────────────────────────────────────────────────
function SendReportDialog({ report, open, onClose }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sendToEmployee, setSendToEmployee] = useState(!!report?.assignedEmployeeId);
  const [sendToClient, setSendToClient] = useState(!!report?.assignedClientId);

  const sendMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/reports/${report.id}/send`, { sendToEmployee, sendToClient }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report sent" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Send Report</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Select who should receive this report:</p>
          {report?.assignedEmployeeId && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={sendToEmployee} onCheckedChange={v => setSendToEmployee(!!v)} data-testid="check-send-employee" />
              Send to assigned employee
            </label>
          )}
          {report?.assignedClientId && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={sendToClient} onCheckedChange={v => setSendToClient(!!v)} data-testid="check-send-client" />
              Send to assigned client
            </label>
          )}
          {!report?.assignedEmployeeId && !report?.assignedClientId && (
            <p className="text-sm text-amber-600">No employee or client assigned to this report.</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || (!sendToEmployee && !sendToClient)} data-testid="button-send-report">
            <Send className="w-4 h-4 mr-1.5" />Send
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reports", rptId] }); toast({ title: "Report signed" }); setSigForm({ name: "", ack: false }); },
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
                    <Field label="Category" value={rpt.incidentCategory} />
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
                          <div key={sig.id} className="flex items-center gap-3 p-3 rounded-md bg-green-50 border border-green-200">
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{sig.signerName}</p>
                              <p className="text-xs text-muted-foreground capitalize">{sig.signerRole} · {sig.signedAt ? format(new Date(sig.signedAt), "MMM d, yyyy h:mm a") : ""}</p>
                              {sig.acknowledgementText && <p className="text-xs text-green-700 mt-0.5">"{sig.acknowledgementText}"</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {canSign && (
                      <div className="rounded-md border p-4 space-y-3">
                        <p className="text-sm font-medium">Sign this report</p>
                        <div className="space-y-2">
                          <Label className="text-xs">Your full name</Label>
                          <Input
                            data-testid="input-signer-name"
                            value={sigForm.name}
                            onChange={e => setSigForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Type your full name to sign..."
                          />
                        </div>
                        <label className="flex items-start gap-2 text-sm cursor-pointer">
                          <Checkbox checked={sigForm.ack} onCheckedChange={v => setSigForm(f => ({ ...f, ack: !!v }))} data-testid="check-acknowledge" />
                          <span>I acknowledge that the information in this report is accurate to the best of my knowledge.</span>
                        </label>
                        <Button
                          size="sm"
                          disabled={!sigForm.name || !sigForm.ack || signMut.isPending}
                          onClick={() => signMut.mutate({ signerName: sigForm.name, acknowledgementText: sigForm.ack ? "I acknowledge this report is accurate." : undefined })}
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

      {sendOpen && <SendReportDialog report={rpt} open={sendOpen} onClose={() => setSendOpen(false)} />}
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

  return (
    <div className="hidden print:block fixed inset-0 bg-white p-8 z-[9999] overflow-auto text-black">
      <style>{`@media print { body { -webkit-print-color-adjust: exact; } }`}</style>
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4 mb-6">
        <div className="flex items-center gap-4">
          {company?.companyLogoUrl && (
            <img src={company.companyLogoUrl} alt="Logo" className="h-16 w-auto object-contain" />
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{company?.name || "Company"}</h1>
            {company?.companyEmail && <p className="text-sm text-gray-600">{company.companyEmail}</p>}
            {company?.companyPhone && <p className="text-sm text-gray-600">{company.companyPhone}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-gray-900">{typeInfo?.label}</h2>
          <p className="text-sm text-gray-500">ID: {reportId(rpt.id)}</p>
          <p className="text-sm text-gray-500">Status: {rpt.status?.replace(/_/g, " ").toUpperCase()}</p>
          <p className="text-sm text-gray-500">Date: {rpt.createdAt ? format(new Date(rpt.createdAt), "MMMM d, yyyy") : "—"}</p>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-gray-900 mb-6">{rpt.title}</h3>

      {/* Grid sections */}
      <div className="space-y-6">
        {/* Incident Details */}
        <section>
          <h4 className="font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">Incident Details</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              ["Date", rpt.incidentDate], ["Time", rpt.incidentTime], ["Severity", rpt.severity],
              ["Risk Level", rpt.riskLevel], ["Category", rpt.incidentCategory], ["Area Affected", rpt.areaAffected],
              ["Client Property", rpt.clientPropertyAffected ? "Yes" : "No"], ["Company Equipment", rpt.companyEquipmentAffected ? "Yes" : "No"],
              ["Work Stopped", rpt.workStopped ? "Yes" : "No"], ["Customer Informed", rpt.customerInformed ? "Yes" : "No"],
            ].filter(([, v]) => v !== null && v !== undefined && v !== "").map(([l, v]) => (
              <div key={l as string}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{l as string}</p>
                <p className="text-gray-900">{String(v)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* People */}
        <section>
          <h4 className="font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">People Involved</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {assignedEmployee && <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Employee</p><p>{assignedEmployee.firstName} {assignedEmployee.lastName}</p></div>}
            {assignedClient && <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Client</p><p>{assignedClient.name}</p></div>}
            {assignedLocation && <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Location</p><p>{assignedLocation.name}</p></div>}
            {rpt.witnesses && <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Witnesses</p><p>{rpt.witnesses}</p></div>}
          </div>
        </section>

        {/* Summary */}
        <section>
          <h4 className="font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">Incident Summary</h4>
          {rpt.summary && <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Summary</p><p className="text-sm text-gray-900 whitespace-pre-wrap">{rpt.summary}</p></div>}
          {rpt.immediateAction && <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Immediate Action</p><p className="text-sm text-gray-900 whitespace-pre-wrap">{rpt.immediateAction}</p></div>}
          {rpt.employeeStatement && <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Employee Statement</p><p className="text-sm text-gray-900 whitespace-pre-wrap">{rpt.employeeStatement}</p></div>}
          {rpt.clientComments && <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Client Comments</p><p className="text-sm text-gray-900 whitespace-pre-wrap">{rpt.clientComments}</p></div>}
        </section>

        {/* Signatures */}
        {rpt.signatures?.length > 0 && (
          <section>
            <h4 className="font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">Signatures</h4>
            <div className="grid grid-cols-3 gap-6">
              {rpt.signatures.map((sig: any) => (
                <div key={sig.id} className="border border-gray-300 rounded p-3">
                  <p className="font-semibold text-sm">{sig.signerName}</p>
                  <p className="text-xs text-gray-500 capitalize">{sig.signerRole}</p>
                  <p className="text-xs text-gray-500">{sig.signedAt ? format(new Date(sig.signedAt), "MMM d, yyyy") : ""}</p>
                  <div className="mt-3 pt-2 border-t border-gray-300">
                    <p className="text-[10px] text-gray-400">Digital Signature (Typed)</p>
                    <p className="text-sm font-serif italic text-gray-700">{sig.signerName}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Signature blocks if not signed */}
        <section>
          <h4 className="font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">Sign-Off</h4>
          <div className="grid grid-cols-3 gap-6">
            {["Prepared By (Admin)", "Employee Acknowledgement", "Client Acknowledgement"].map(label => (
              <div key={label} className="border border-gray-300 rounded p-3 min-h-[80px]">
                <p className="text-xs text-gray-500 mb-2">{label}</p>
                <div className="border-b border-gray-400 mt-8" />
                <p className="text-[10px] text-gray-400 mt-1">Signature &amp; Date</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-3 text-[10px] text-gray-400 flex justify-between">
          <span>{company?.name} — Confidential</span>
          <span>Generated {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</span>
          <span>Report ID: {reportId(rpt.id)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Reports Page ──────────────────────────────────────────────────
export default function AdminReports() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: reports = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/reports"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });
  const { data: companyRaw } = useQuery<any>({ queryKey: ["/api/auth/company"] });

  const company = companyRaw;

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
