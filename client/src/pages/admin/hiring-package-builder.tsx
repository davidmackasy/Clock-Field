import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Save, Send, Copy, Printer, ChevronDown, ChevronRight,
  Pencil, Check, X, User, FileText, ClipboardCheck, Loader2, ExternalLink,
  CheckCircle2, Clock, Eye, AlertCircle, RotateCcw,
} from "lucide-react";

// ── Default policy sections ───────────────────────────────────────────────────
export const DEFAULT_HIRING_SECTIONS = [
  {
    id: "conduct",
    title: "Rules of Conduct / Conditions of Employment",
    type: "policy",
    enabled: true,
    content: `As an employee, you are expected to maintain professional conduct at all times.

1. Attendance & Punctuality: Report to work on time as scheduled. Notify your supervisor at least 2 hours before your shift if you cannot attend.

2. Professional Behavior: Treat all clients, colleagues, and supervisors with respect. Harassment, discrimination, or threatening behavior will not be tolerated and may result in immediate termination.

3. Confidentiality: Do not disclose client addresses, access codes, security information, or any business information to third parties.

4. Honesty: Any theft, fraud, or misrepresentation will result in immediate termination and may be reported to authorities.

5. Damage Reporting: Report any accidental damage to client property immediately to your supervisor before leaving the premises.

6. Use of Client Property: Do not use client appliances, phones, computers, or personal belongings without explicit permission.

7. Social Media: Do not photograph or record client properties, and do not post any client information on social media.`,
  },
  {
    id: "ethics",
    title: "Code of Ethics",
    type: "policy",
    enabled: true,
    content: `We conduct business with integrity and professionalism. As a member of our team, you agree to:

• Act with honesty and integrity in all dealings with clients and colleagues.

• Maintain the trust placed in us by clients who provide access to their homes and businesses.

• Protect client privacy and never share personal information about clients, including their schedules, home layouts, or security details.

• Report any suspected fraud, theft, or violations of this Code to management immediately.

• Treat all individuals with dignity and respect regardless of race, gender, religion, age, disability, or background.

• Represent the company positively at all times when on client premises or in the community.`,
  },
  {
    id: "dress_code",
    title: "Dress Code and Personal Hygiene Policy",
    type: "policy",
    enabled: true,
    content: `All employees must maintain a clean, professional appearance at all times when on duty.

Uniform Requirements:
• Wear the company-issued uniform or approved clothing at all times during work hours.
• Uniforms must be clean, pressed, and in good condition.
• Company-branded shirts or polo shirts must be worn and visible to clients.
• Closed-toe, non-slip footwear is required at all job sites.

Personal Hygiene:
• Maintain good personal hygiene including regular bathing and clean hair.
• Avoid wearing strong perfumes, colognes, or scented products that may affect clients or colleagues with sensitivities.
• Fingernails should be clean, trimmed, and well-maintained.
• Hair should be clean and tied back when required for safety or hygiene.

Non-compliance with the dress code may result in being sent home to change, without pay for that time.`,
  },
  {
    id: "safety_boots",
    title: "Safety Boots Reimbursement Policy",
    type: "policy",
    enabled: true,
    content: `The company requires employees to wear appropriate safety footwear on designated job sites.

Reimbursement Details:
• Eligible employees may receive a one-time reimbursement for approved safety footwear.
• The maximum reimbursement amount is as determined by management at time of hire.
• Safety boots must meet CSA (Canadian Standards Association) standards or equivalent.
• Original receipts must be submitted within 30 days of purchase.
• Reimbursement will be processed through payroll on the next pay cycle after approval.

Eligibility:
• Employees must complete their probationary period before claiming reimbursement.
• Boots must be purchased from an approved retailer or meet specifications set by management.
• Reimbursement is a one-time benefit per employment period.`,
  },
  {
    id: "substance_abuse",
    title: "Substance Abuse Policy",
    type: "policy",
    enabled: true,
    content: `The company is committed to maintaining a safe and productive work environment free from the effects of drugs and alcohol.

Policy:
• Employees are prohibited from reporting to work under the influence of alcohol or illegal substances.
• The use, possession, distribution, or sale of alcohol or illegal drugs on company property or client premises is strictly prohibited.
• Prescription medications that may impair performance or safety must be disclosed to a supervisor.

Reasonable Suspicion:
• Supervisors may remove an employee from a job site if there is reasonable suspicion of impairment.
• Signs of impairment include slurred speech, unsteady movement, odor of alcohol, or erratic behavior.
• An employee suspected of impairment will be sent home and may not return until cleared by management.

Consequences:
• First violation: Written warning and mandatory assessment.
• Second violation: Immediate termination.
• Any violation resulting in injury or property damage may result in immediate termination and legal action.`,
  },
];

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; Icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", Icon: FileText },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700", Icon: Send },
  viewed: { label: "Viewed", color: "bg-amber-100 text-amber-700", Icon: Eye },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

// ── PDF Print ─────────────────────────────────────────────────────────────────
function printHiringPackage(pkg: any, sections: any[], companyName: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const sectionHtml = sections
    .filter(s => s.enabled)
    .map(s => `
      <div style="margin-bottom:32px;page-break-inside:avoid;">
        <h2 style="font-size:16px;font-weight:700;color:#1a1a1a;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:16px;">${s.title}</h2>
        <p style="white-space:pre-line;font-size:13px;line-height:1.8;color:#374151;">${s.content}</p>
      </div>`)
    .join("");

  const signatureHtml = pkg.signatureData
    ? `<div style="margin-top:24px;"><p style="font-size:12px;color:#6b7280;">Employee Signature:</p><img src="${pkg.signatureData}" style="max-width:240px;border:1px solid #e5e7eb;border-radius:4px;margin-top:4px;" /></div>`
    : `<div style="margin-top:40px;border-top:1px solid #1a1a1a;width:280px;"><p style="font-size:11px;color:#6b7280;margin-top:4px;">Employee Signature</p></div>`;

  const respHtml = pkg.employeeResponse ? (() => {
    const r = pkg.employeeResponse as any;
    return `<div style="margin-bottom:32px;">
      <h2 style="font-size:16px;font-weight:700;color:#1a1a1a;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:16px;">Employee Information</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Full Name</td><td style="padding:6px 0;">${r.fullName || ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;">${r.phone || ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;">${r.address || ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Job Title</td><td style="padding:6px 0;">${r.jobTitle || ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Start Date</td><td style="padding:6px 0;">${r.startDate || ""}</td></tr>
      </table>
      ${r.emergencyContact1?.name ? `
      <h3 style="font-size:14px;font-weight:600;margin-top:20px;margin-bottom:10px;">Emergency Contact 1</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Name</td><td style="padding:6px 0;">${r.emergencyContact1.name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Relationship</td><td style="padding:6px 0;">${r.emergencyContact1.relationship || ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;">${r.emergencyContact1.phone || ""}</td></tr>
      </table>` : ""}
      ${r.emergencyContact2?.name ? `
      <h3 style="font-size:14px;font-weight:600;margin-top:20px;margin-bottom:10px;">Emergency Contact 2</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Name</td><td style="padding:6px 0;">${r.emergencyContact2.name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Relationship</td><td style="padding:6px 0;">${r.emergencyContact2.relationship || ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;">${r.emergencyContact2.phone || ""}</td></tr>
      </table>` : ""}
      ${r.allergies || r.medicalNotes ? `
      <h3 style="font-size:14px;font-weight:600;margin-top:20px;margin-bottom:10px;">Medical Information</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${r.allergies ? `<tr><td style="padding:6px 0;color:#6b7280;width:140px;">Allergies</td><td style="padding:6px 0;">${r.allergies}</td></tr>` : ""}
        ${r.medicalNotes ? `<tr><td style="padding:6px 0;color:#6b7280;">Medical Notes</td><td style="padding:6px 0;">${r.medicalNotes}</td></tr>` : ""}
      </table>` : ""}
    </div>`;
  })() : "";

  win.document.write(`<!DOCTYPE html><html><head><title>Hiring Package — ${pkg.employeeName}</title>
<style>
  @page { margin: 16mm 20mm 20mm 20mm; }
  @page :first { margin-top: 0; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
  .cover { background: #1e3a5f; color: white; padding: 48px 40px; margin: -0px -0px 40px; }
  .cover h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px; }
  .cover p { font-size: 14px; opacity: 0.85; margin: 4px 0; }
  .content { padding: 0 0; }
</style>
</head><body>
<div class="cover">
  <h1>${companyName}</h1>
  <p style="font-size:18px;font-weight:600;margin-top:16px;">Employee Hiring Package</p>
  <p>${pkg.employeeName || "Employee"}</p>
  ${pkg.jobTitle ? `<p>${pkg.jobTitle}</p>` : ""}
  ${pkg.startDate ? `<p>Start Date: ${pkg.startDate}</p>` : ""}
</div>
<div class="content">
  ${respHtml}
  ${sectionHtml}
  <div style="margin-top:48px;">
    <h2 style="font-size:16px;font-weight:700;color:#1a1a1a;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:16px;">Acknowledgement</h2>
    <p style="font-size:13px;line-height:1.8;color:#374151;">By signing below, I acknowledge that I have read, understand, and agree to comply with all policies and conditions outlined in this hiring package.</p>
    <div style="margin-top:32px;display:flex;gap:48px;flex-wrap:wrap;">
      ${signatureHtml}
      <div style="margin-top:40px;border-top:1px solid #1a1a1a;width:200px;"><p style="font-size:11px;color:#6b7280;margin-top:4px;">Date</p></div>
    </div>
    ${pkg.completedAt ? `<p style="font-size:12px;color:#6b7280;margin-top:16px;">Completed on: ${fmtDate(pkg.completedAt)}</p>` : ""}
  </div>
</div>
</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}

// ── Section Editor ────────────────────────────────────────────────────────────
function SectionEditor({ section, onChange }: { section: any; onChange: (s: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);

  return (
    <div className={`rounded-xl border transition-colors ${section.enabled ? "bg-white" : "bg-gray-50 opacity-60"}`}>
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <button
          className="shrink-0"
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
        >
          {expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
        <span className="flex-1 text-sm font-medium text-gray-800">{section.title}</span>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${section.enabled ? "text-gray-400 hover:text-gray-700" : "text-gray-300"}`}
            onClick={() => onChange({ ...section, enabled: !section.enabled })}
            title={section.enabled ? "Disable section" : "Enable section"}
            data-testid={`button-toggle-section-${section.id}`}
          >
            {section.enabled ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
            onClick={() => { setExpanded(true); setEditing(true); setDraft(section.content); }}
            title="Edit content"
            data-testid={`button-edit-section-${section.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t">
          {editing ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="min-h-[200px] text-sm font-mono resize-y"
                data-testid={`textarea-section-${section.id}`}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setDraft(section.content); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => { onChange({ ...section, content: draft }); setEditing(false); }}>
                  <Check className="w-3.5 h-3.5 mr-1" /> Apply
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-700 whitespace-pre-line leading-relaxed">{section.content}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Send Email Dialog ─────────────────────────────────────────────────────────
function SendEmailDialog({
  open, onClose, defaultEmail, defaultName, pkgId, onSent,
}: {
  open: boolean; onClose: () => void; defaultEmail: string; defaultName: string;
  pkgId: string; onSent: (result: any) => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail);

  const mutation = useMutation({
    mutationFn: (e: string) => apiRequest("POST", `/api/admin/hiring-packages/${pkgId}/send-email`, { email: e }),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Email sent!", description: `Hiring package sent to ${email}` });
      } else {
        toast({ title: "Email failed", description: data.emailError || "Could not send email", variant: "destructive" });
      }
      onSent(data);
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Hiring Package</DialogTitle>
          <DialogDescription>Send the hiring package link to the employee via email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Employee Name</Label>
            <p className="text-sm text-gray-600 mt-1">{defaultName || "—"}</p>
          </div>
          <div>
            <Label htmlFor="send-email-input">Email Address</Label>
            <Input
              id="send-email-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="employee@example.com"
              className="mt-1"
              data-testid="input-send-email"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate(email)}
            disabled={!email || mutation.isPending}
            data-testid="button-confirm-send-email"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Builder ──────────────────────────────────────────────────────────────
export default function AdminHiringPackageBuilder() {
  const [, params] = useRoute("/admin/hiring-packages/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const id = params?.id || "";

  const { data: pkg, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/hiring-packages", id],
    enabled: !!id,
  });

  const [empInfo, setEmpInfo] = useState({
    employeeName: "", employeeEmail: "", employeePhone: "",
    employeeAddress: "", jobTitle: "", startDate: "",
  });
  const [sections, setSections] = useState<any[]>([]);
  const [internalNotes, setInternalNotes] = useState("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (pkg) {
      setEmpInfo({
        employeeName: pkg.employeeName || "",
        employeeEmail: pkg.employeeEmail || "",
        employeePhone: pkg.employeePhone || "",
        employeeAddress: pkg.employeeAddress || "",
        jobTitle: pkg.jobTitle || "",
        startDate: pkg.startDate || "",
      });
      const td = pkg.templateData as any[];
      setSections(Array.isArray(td) && td.length > 0 ? td : DEFAULT_HIRING_SECTIONS.map(s => ({ ...s })));
      setInternalNotes(pkg.internalNotes || "");
    }
  }, [pkg]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/hiring-packages/${id}`, {
      ...empInfo,
      templateData: sections,
      internalNotes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/hiring-packages", id] });
      qc.invalidateQueries({ queryKey: ["/api/admin/hiring-packages"] });
      toast({ title: "Saved!" });
      setIsDirty(false);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  function updateEmpInfo(field: string, value: string) {
    setEmpInfo(p => ({ ...p, [field]: value }));
    setIsDirty(true);
  }

  function updateSection(updated: any) {
    setSections(prev => prev.map(s => s.id === updated.id ? updated : s));
    setIsDirty(true);
  }

  function copyLink() {
    if (!pkg) return;
    const url = `${window.location.origin}/public/hiring-package/${pkg.publicToken}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Link copied!", description: url }));
  }

  const statusMeta = STATUS_META[pkg?.status || "draft"] || STATUS_META.draft;
  const StatusIcon = statusMeta.Icon;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Hiring package not found.</p>
          <Button className="mt-4" onClick={() => navigate("/admin/publications?tab=hiring")}>Go back</Button>
        </div>
      </div>
    );
  }

  const resp = pkg.employeeResponse as any;
  const publicUrl = `${window.location.origin}/public/hiring-package/${pkg.publicToken}`;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-gray-900 -ml-2"
            onClick={() => navigate("/admin/publications?tab=hiring")}
            data-testid="button-back-to-publications">
            <ArrowLeft className="w-4 h-4" /> Publications
          </Button>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {empInfo.employeeName || "New Hiring Package"}
            </h1>
            <Badge className={`text-xs px-2 py-0 h-5 rounded-full font-medium shrink-0 ${statusMeta.color}`}>
              <StatusIcon className="w-3 h-3 mr-1 inline" />
              {statusMeta.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={copyLink} data-testid="button-copy-link" className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")} title="Preview public page" data-testid="button-preview-public">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => printHiringPackage(pkg, sections, pkg.company?.name || "Your Company")}
              data-testid="button-print-pdf" className="gap-1.5">
              <Printer className="w-3.5 h-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSendDialogOpen(true)}
              data-testid="button-send-email" className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Send
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              data-testid="button-save-package" className="gap-1.5">
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
        </div>

        {/* Timeline info */}
        {(pkg.sentAt || pkg.viewedAt || pkg.completedAt) && (
          <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5 border">
            {pkg.sentAt && <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Sent {fmtDate(pkg.sentAt)}</span>}
            {pkg.viewedAt && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Viewed {fmtDate(pkg.viewedAt)}</span>}
            {pkg.completedAt && <span className="flex items-center gap-1 text-green-700 font-medium"><CheckCircle2 className="w-3 h-3" /> Completed {fmtDate(pkg.completedAt)}</span>}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Employee Info */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" /> Employee Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: "employeeName", label: "Full Name", placeholder: "Jane Smith" },
                  { key: "employeeEmail", label: "Email", placeholder: "jane@example.com", type: "email" },
                  { key: "employeePhone", label: "Phone", placeholder: "(555) 000-0000", type: "tel" },
                  { key: "jobTitle", label: "Job Title", placeholder: "Cleaning Technician" },
                  { key: "startDate", label: "Start Date", type: "date" },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <Label className="text-xs text-gray-500">{label}</Label>
                    <Input
                      type={type || "text"}
                      value={(empInfo as any)[key]}
                      onChange={e => updateEmpInfo(key, e.target.value)}
                      placeholder={placeholder}
                      className="mt-1 h-8 text-sm"
                      data-testid={`input-${key}`}
                    />
                  </div>
                ))}
                <div>
                  <Label className="text-xs text-gray-500">Address</Label>
                  <Textarea
                    value={empInfo.employeeAddress}
                    onChange={e => updateEmpInfo("employeeAddress", e.target.value)}
                    placeholder="123 Main St, City, Province"
                    className="mt-1 text-sm min-h-[60px] resize-none"
                    data-testid="input-employeeAddress"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" /> Internal Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={internalNotes}
                  onChange={e => { setInternalNotes(e.target.value); setIsDirty(true); }}
                  placeholder="Private notes (not visible to employee)"
                  className="text-sm min-h-[80px] resize-none"
                  data-testid="textarea-internal-notes"
                />
              </CardContent>
            </Card>

            <div className="rounded-xl border bg-gray-50 p-3 space-y-1 text-xs text-gray-500">
              <p className="font-medium text-gray-700 mb-1">Public Link</p>
              <p className="break-all font-mono text-[10px] leading-relaxed">{publicUrl}</p>
              <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={copyLink}>
                <Copy className="w-3 h-3 mr-1" /> Copy Link
              </Button>
            </div>
          </div>

          {/* Right: Policy Sections */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Policy Sections</h2>
              <span className="text-xs text-gray-400">{sections.filter(s => s.enabled).length} of {sections.length} enabled</span>
            </div>
            {sections.map(s => (
              <SectionEditor key={s.id} section={s} onChange={updateSection} />
            ))}
          </div>
        </div>

        {/* Employee Response (if completed) */}
        {resp && (
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-4 h-4" /> Employee Response
                {pkg.completedAt && <span className="text-xs font-normal text-green-600">Completed {fmtDate(pkg.completedAt)}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  ["Full Name", resp.fullName],
                  ["Email", resp.email],
                  ["Phone", resp.phone],
                  ["Address", resp.address],
                  ["Job Title", resp.jobTitle],
                  ["Start Date", resp.startDate],
                ].map(([label, value]) => value ? (
                  <div key={label}>
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className="text-gray-900 mt-0.5">{value}</p>
                  </div>
                ) : null)}
              </div>

              {resp.emergencyContact1?.name && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Emergency Contact 1</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-gray-500">Name</p><p>{resp.emergencyContact1.name}</p></div>
                    <div><p className="text-xs text-gray-500">Relationship</p><p>{resp.emergencyContact1.relationship || "—"}</p></div>
                    <div><p className="text-xs text-gray-500">Phone</p><p>{resp.emergencyContact1.phone || "—"}</p></div>
                  </div>
                </div>
              )}
              {resp.emergencyContact2?.name && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Emergency Contact 2</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-gray-500">Name</p><p>{resp.emergencyContact2.name}</p></div>
                    <div><p className="text-xs text-gray-500">Relationship</p><p>{resp.emergencyContact2.relationship || "—"}</p></div>
                    <div><p className="text-xs text-gray-500">Phone</p><p>{resp.emergencyContact2.phone || "—"}</p></div>
                  </div>
                </div>
              )}
              {(resp.allergies || resp.medicalNotes) && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Medical Information</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {resp.allergies && <div><p className="text-xs text-gray-500">Allergies / Sensitivities</p><p>{resp.allergies}</p></div>}
                    {resp.medicalNotes && <div><p className="text-xs text-gray-500">Medical Notes</p><p>{resp.medicalNotes}</p></div>}
                  </div>
                </div>
              )}

              {pkg.signatureData && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Digital Signature</p>
                  <div className="border rounded-lg p-2 bg-white inline-block">
                    <img src={pkg.signatureData} alt="Signature" className="max-h-24 max-w-xs" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      <SendEmailDialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        defaultEmail={empInfo.employeeEmail}
        defaultName={empInfo.employeeName}
        pkgId={id}
        onSent={() => qc.invalidateQueries({ queryKey: ["/api/admin/hiring-packages", id] })}
      />
    </div>
  );
}
