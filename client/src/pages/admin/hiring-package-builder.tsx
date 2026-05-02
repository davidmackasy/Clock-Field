import { useState, useEffect, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Save, Send, Copy, Printer, ChevronDown, ChevronRight,
  Pencil, Check, X, User, FileText, ClipboardCheck, Loader2, ExternalLink,
  CheckCircle2, Clock, Eye, AlertCircle, RotateCcw,
  ThumbsUp, ThumbsDown, Archive, UserCheck, AlertTriangle,
  Shield, FileDown,
} from "lucide-react";

// ── Default policy sections ───────────────────────────────────────────────────
export const DEFAULT_HIRING_SECTIONS = [
  {
    id: "conduct",
    title: "Rules of Conduct / Conditions of Employment",
    type: "policy",
    enabled: true,
    content: `The following rules of conduct and conditions of employment apply to all employees of [Company Name]. These rules are intended to protect clients, employees, company property, workplace safety, and the professional reputation of [Company Name].

The following actions are considered violations and may result in disciplinary action, up to and including immediate termination:

• Falsification of personal information supplied to the company
• Using incorrect personal information or identification
• Damaging company property, client property, or employee property
• Smoking in unauthorized areas or where the client does not allow smoking
• Being impaired while at work by alcohol, drugs, or any substance
• Use of profane or abusive language
• Unauthorized opening of desks, cabinets, lockers, refrigerators, or client property
• Threatening clients, employees, or members of the public
• Unauthorized use of company property, phone, tools, or equipment
• Removing anything from the workplace without permission
• Theft or attempted theft
• Willful damage to company or client property
• Leaving assigned work areas without authorization
• Entering client areas without permission
• Fighting, harassment, or unsuitable behaviour
• Insubordination
• Failure to follow instructions from a manager or supervisor
• Bringing personal possessions into client areas without approval
• Leaving an assigned work area before completing the shift
• Unauthorized use of client facilities or washrooms
• Working outside assigned hours without approval
• Signing in or out for another employee
• Failure to sign in or out as required
• Showing time other than the exact time worked
• Refusing to cooperate with company or client requirements
• Any act that may damage the reputation, trust, or business relationship of [Company Name]

Acknowledgement: I acknowledge that I have read and understood the Rules of Conduct / Conditions of Employment. I understand that failure to follow these rules may result in disciplinary action, up to and including termination of employment.`,
  },
  {
    id: "ethics",
    title: "Code of Ethics",
    type: "policy",
    enabled: true,
    content: `At [Company Name], employees are expected to act honestly, professionally, respectfully, and responsibly at all times. Employees must not discriminate, harass, or mistreat clients, coworkers, or members of the public.

Core Values:

• Personal respect — Treat every person with dignity and courtesy at all times
• Respect for customers — Provide honest, professional, high-quality service to every client
• Respect for society — Conduct yourself in a manner that reflects positively on your community
• Respect for the environment — Follow company environmental guidelines and handle materials responsibly
• Respect for the company and its interests — Protect the company's reputation, relationships, and business information
• Honesty and responsibility — Be truthful and take ownership of your actions and results
• Compliance with the law — Follow all applicable laws and regulations at all times
• Compliance with business standards — Meet or exceed the standards expected of all service professionals
• Compliance with company policies and procedures — Follow all company policies, guidelines, and instructions

If you have a concern about a violation of this Code of Ethics, you may report it to:
[Manager Name]
[Manager Email]
[Manager Phone]

Acknowledgement: I acknowledge that I have read and understood the Code of Ethics. I agree to follow the ethical standards expected by [Company Name].`,
  },
  {
    id: "dress_code",
    title: "Dress Code and Personal Hygiene Policy",
    type: "policy",
    enabled: true,
    content: `Objective: To ensure all employees of [Company Name] present themselves professionally while representing the company.

Scope: This policy applies to all employees during working hours or when representing the company.

Uniform and Clothing:
• Employees must wear assigned uniforms while on duty
• Company uniforms are for work-related purposes only
• Uniform items are company property where applicable
• Lost or damaged uniforms must be reported immediately
• Uniforms must be clean, pressed, and in good condition at all times
• Uniforms must be worn during working hours and must not be worn in locations that could negatively affect the company image
• Shoes must be clean and appropriate for safe work
• Clothing must not interfere with safe work performance
• Jewelry must not create a safety hazard

Personal Hygiene:
• Employees must maintain appropriate personal hygiene standards at all times
• Strong perfumes, colognes, or lotions should be avoided where they may affect clients or coworkers with sensitivities
• Hair should be clean and tied back where required for safety or hygiene
• Fingernails must be clean, trimmed, and maintained appropriately

Inappropriate Attire (examples):
Sweatpants, jogging pants, bicycle shorts, athletic shorts, tank tops, ripped or unprofessional clothing, flip-flops, sandals, beach footwear, and clothing with offensive wording or images are not permitted.

Non-compliance with this policy may result in being required to change before returning to work, without pay for that time.

Acknowledgement: I acknowledge that I have read and understood the Dress Code and Personal Hygiene Policy. I agree to follow this policy while representing [Company Name].`,
  },
  {
    id: "safety_boots",
    title: "Safety Boots Reimbursement Policy",
    type: "policy",
    enabled: true,
    content: `Objective: To outline the guidelines and expectations for safety footwear requirements and reimbursement at [Company Name].

Guidelines:
• Cleaners may be required to wear CSA-approved safety boots during assigned work duties
• Employees who are required to wear CSA-approved safety boots may be eligible for reimbursement up to the approved company amount
• The employee must submit an original receipt for approved safety boots
• The employee must present the approved safety boots when requested
• The employee must provide any required documentation within the required time period
• If reimbursement is approved, the company may reimburse the employee through payroll
• If employment ends before the required period, the safety boot allowance may be forfeited or adjusted based on company policy

Reimbursement Amount: Up to $60.00 (or as determined by management at time of hire)

Employee Responsibilities:
• Purchase CSA-approved safety footwear that meets company specifications
• Keep safety boots in good and serviceable condition
• Submit the original purchase receipt within 30 days of purchase
• Wear safety boots at all designated job sites

Eligibility:
• Employees must complete their probationary period before claiming reimbursement
• Reimbursement is a one-time benefit per employment period

Acknowledgement: I acknowledge that I have read and understood the Safety Boots Reimbursement Policy. I agree to follow the requirements for safety footwear and reimbursement.`,
  },
  {
    id: "substance_abuse",
    title: "Substance Abuse Policy / Suspicion of Impairment",
    type: "policy",
    enabled: true,
    content: `Objective: [Company Name] is committed to maintaining a safe, professional, and substance-free workplace. Employees must not report to work impaired by alcohol, drugs, medication misuse, or any substance that may affect safe and professional work performance.

[Company Name] adopts a zero-tolerance approach to alcohol and drug use in the workplace where safety, client trust, or work performance may be affected.

Employee Responsibilities:
• Employees must report to work fit for duty
• Employees must follow this policy during all work hours
• Employees must inform management of work restrictions or safety-related medication concerns where appropriate
• Employees must not use, possess, distribute, or be under the influence of alcohol or drugs during working hours
• Employees must cooperate with reasonable company procedures where impairment is suspected

Company Responsibilities:
• [Company Name] will take reasonable measures to protect employee health, client safety, and workplace safety
• [Company Name] may remove an employee from a work site if impairment is reasonably suspected
• [Company Name] may arrange safe transportation where required
• [Company Name] may investigate the situation and document the incident
• [Company Name] may provide support or accommodation where required by law

Suspicion of Impairment Procedure:
If an employee is reasonably suspected of impairment, management may:
• Request a second opinion from another manager or supervisor
• Speak privately with the employee
• Observe and document signs of impairment
• Remove the employee from the work site for safety reasons
• Arrange safe transportation
• Prevent the employee from driving from the site
• Schedule a follow-up meeting
• Determine whether disciplinary action or support is required

Signs That May Indicate Impairment:

Absenteeism:
• Unplanned or unauthorized work absence
• Frequent delays or tardiness
• Frequent sick leave
• Repeated absences before or after weekends, holidays, or pay days

Behaviour at Work:
• Staggering or unstable movement
• Eyes injected with blood or glassy appearance
• Smell of alcohol or cannabis
• Changes in behaviour or mood
• Avoiding supervision
• Confusion or unusual speech
• Inappropriate or erratic behaviour

Labour Relations:
• Poor relationship with coworkers
• Becoming aggressive, argumentative, or uncooperative
• Complaints from others
• Reduced teamwork or cooperation

Performance Issues:
• Failure to meet deadlines
• Neglected work tasks
• Repeated mistakes or poor judgment
• Work quality concerns

Disciplinary Measures:
Failure to comply with this policy may result in disciplinary measures, up to and including termination of employment, depending on the seriousness of the situation.

Acknowledgement: I acknowledge that I have read and understood the Substance Abuse Policy / Suspicion of Impairment. I agree to follow this policy and understand that failure to comply may result in disciplinary action, up to and including termination of employment.`,
  },
  {
    id: "emergency_medical_notice",
    title: "Emergency Contact and Medical Information Notice",
    type: "policy",
    enabled: true,
    content: `This notice explains why [Company Name] collects emergency contact and medical information from employees.

Confidentiality Statement:
The information you provide in the Emergency Contact and Medical Information section of this hiring package will be held in the strictest confidence and will only be shared on a need-to-know basis with authorized personnel. This form is not intended to request or investigate your personal medical history.

The information is being collected only to help respond to an emergency, safety concern, allergy, sensitivity, or medical situation that may occur at work.

Why We Collect This Information:
• To contact your designated person(s) in the event of a workplace emergency
• To be aware of allergies or sensitivities that may affect your safety or the safety of others
• To accommodate any medical needs or restrictions relevant to your safe performance of duties
• To ensure the health and safety of all employees and clients

Storage and Access:
• Your emergency contact and medical information will be stored securely
• Access is limited to authorized personnel only
• This information will not be shared with any third party except in an emergency or as required by law

Acknowledgement: I have read and understood this confidentiality notice regarding the collection and use of my emergency contact and medical information.`,
  },
];

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; Icon: any }> = {
  draft:             { label: "Draft",              color: "bg-gray-100 text-gray-700",    Icon: FileText },
  sent:              { label: "Sent",               color: "bg-blue-100 text-blue-700",    Icon: Send },
  viewed:            { label: "Viewed",             color: "bg-amber-100 text-amber-700",  Icon: Eye },
  started:           { label: "Started",            color: "bg-purple-100 text-purple-700",Icon: Pencil },
  submitted:         { label: "Submitted",          color: "bg-yellow-100 text-yellow-800",Icon: CheckCircle2 },
  under_review:      { label: "Under Review",       color: "bg-yellow-100 text-yellow-800",Icon: Clock },
  missing_documents: { label: "Missing Documents",  color: "bg-orange-100 text-orange-800",Icon: AlertCircle },
  approved:          { label: "Approved / Hired",   color: "bg-green-100 text-green-700",  Icon: CheckCircle2 },
  not_approved:      { label: "Not Approved",       color: "bg-red-100 text-red-700",      Icon: X },
  fired_inactive:    { label: "Fired / Inactive",   color: "bg-gray-200 text-gray-600",    Icon: X },
  archived:          { label: "Archived",           color: "bg-gray-100 text-gray-500",    Icon: Archive },
  completed:         { label: "Submitted",          color: "bg-yellow-100 text-yellow-800",Icon: CheckCircle2 },
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── PDF Print ─────────────────────────────────────────────────────────────────
function printHiringPackage(pkg: any, sections: any[], companyName: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const sectionHtml = sections
    .filter(s => s.enabled)
    .map(s => `
      <div style="margin-bottom:32px;page-break-inside:avoid;">
        <h2 style="font-size:15px;font-weight:700;color:#1a1a1a;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:14px;">${s.title}</h2>
        <p style="white-space:pre-line;font-size:12px;line-height:1.8;color:#374151;">${s.content}</p>
      </div>`)
    .join("");

  const signatureHtml = pkg.signatureData
    ? `<div style="margin-top:24px;"><p style="font-size:11px;color:#6b7280;">Employee Signature:</p><img src="${pkg.signatureData}" style="max-width:240px;border:1px solid #e5e7eb;border-radius:4px;margin-top:4px;" /></div>`
    : `<div style="margin-top:40px;border-top:1px solid #1a1a1a;width:280px;"><p style="font-size:10px;color:#6b7280;margin-top:4px;">Employee Signature</p></div>`;

  const r = pkg.employeeResponse as any;
  const fullName = r?.fullName || r?.firstName ? `${r.firstName || ""} ${r.lastName || ""}`.trim() : pkg.employeeName || "";
  const respHtml = r ? `<div style="margin-bottom:32px;">
    <h2 style="font-size:15px;font-weight:700;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:14px;">Employee Information</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr><td style="padding:5px 0;color:#6b7280;width:140px;">Full Name</td><td>${fullName}</td></tr>
      ${r.phone ? `<tr><td style="padding:5px 0;color:#6b7280;">Phone</td><td>${r.phone}</td></tr>` : ""}
      ${r.email ? `<tr><td style="padding:5px 0;color:#6b7280;">Email</td><td>${r.email}</td></tr>` : ""}
      ${r.address ? `<tr><td style="padding:5px 0;color:#6b7280;">Address</td><td>${[r.address, r.city, r.province, r.postalCode, r.country].filter(Boolean).join(", ")}</td></tr>` : ""}
      ${r.jobTitle ? `<tr><td style="padding:5px 0;color:#6b7280;">Job Title</td><td>${r.jobTitle}</td></tr>` : ""}
      ${r.startDate ? `<tr><td style="padding:5px 0;color:#6b7280;">Start Date</td><td>${r.startDate}</td></tr>` : ""}
    </table>
    ${r.emergencyContact1?.name ? `
    <h3 style="font-size:13px;font-weight:600;margin-top:18px;margin-bottom:8px;">Emergency Contact 1</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr><td style="padding:5px 0;color:#6b7280;width:140px;">Name</td><td>${r.emergencyContact1.name}</td></tr>
      ${r.emergencyContact1.relationship ? `<tr><td style="padding:5px 0;color:#6b7280;">Relationship</td><td>${r.emergencyContact1.relationship}</td></tr>` : ""}
      ${r.emergencyContact1.phone ? `<tr><td style="padding:5px 0;color:#6b7280;">Phone</td><td>${r.emergencyContact1.phone}</td></tr>` : ""}
    </table>` : ""}
    ${r.emergencyContact2?.name ? `
    <h3 style="font-size:13px;font-weight:600;margin-top:18px;margin-bottom:8px;">Emergency Contact 2</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr><td style="padding:5px 0;color:#6b7280;width:140px;">Name</td><td>${r.emergencyContact2.name}</td></tr>
      ${r.emergencyContact2.relationship ? `<tr><td style="padding:5px 0;color:#6b7280;">Relationship</td><td>${r.emergencyContact2.relationship}</td></tr>` : ""}
      ${r.emergencyContact2.phone ? `<tr><td style="padding:5px 0;color:#6b7280;">Phone</td><td>${r.emergencyContact2.phone}</td></tr>` : ""}
    </table>` : ""}
    ${r.allergies || r.medicalNotes ? `
    <h3 style="font-size:13px;font-weight:600;margin-top:18px;margin-bottom:8px;">Medical Information</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      ${r.allergies ? `<tr><td style="padding:5px 0;color:#6b7280;width:140px;">Allergies</td><td>${r.allergies}</td></tr>` : ""}
      ${r.sensitivities ? `<tr><td style="padding:5px 0;color:#6b7280;">Sensitivities</td><td>${r.sensitivities}</td></tr>` : ""}
      ${r.medicalNotes ? `<tr><td style="padding:5px 0;color:#6b7280;">Medical Notes</td><td>${r.medicalNotes}</td></tr>` : ""}
    </table>` : ""}
    ${(pkg.uploadedDocuments as any[])?.length > 0 ? `
    <h3 style="font-size:13px;font-weight:600;margin-top:18px;margin-bottom:8px;">Uploaded Documents</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      ${(pkg.uploadedDocuments as any[]).map(d => `<tr><td style="padding:5px 0;color:#6b7280;width:180px;">${d.docType?.replace(/_/g, " ")}</td><td style="color:#16a34a;">✓ Uploaded</td></tr>`).join("")}
    </table>` : ""}
  </div>` : "";

  const acceptancesHtml = (pkg.policyAcceptances as any[])?.length > 0 ? `
    <div style="margin-bottom:32px;">
      <h2 style="font-size:15px;font-weight:700;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:14px;">Policy Acceptance Log</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <th style="text-align:left;padding:6px 0;color:#6b7280;font-weight:600;">Policy</th>
          <th style="text-align:left;padding:6px 0;color:#6b7280;font-weight:600;">Accepted</th>
        </tr>
        ${(pkg.policyAcceptances as any[]).map(a => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px 0;">${a.title || a.sectionId}</td>
          <td style="padding:6px 0;color:#16a34a;">${a.acceptedAt ? new Date(a.acceptedAt).toLocaleString("en-CA") : "Accepted"}</td>
        </tr>`).join("")}
      </table>
    </div>` : "";

  win.document.write(`<!DOCTYPE html><html><head><title>Hiring Package — ${pkg.employeeName}</title>
<style>
  @page { margin: 16mm 20mm 20mm 20mm; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
  .cover { background: #1e3a5f; color: white; padding: 48px 40px; margin-bottom: 40px; }
  .cover h1 { font-size: 26px; font-weight: 700; margin: 0 0 8px; }
  .cover p { font-size: 13px; opacity: 0.85; margin: 4px 0; }
</style>
</head><body>
<div class="cover">
  <h1>${companyName}</h1>
  <p style="font-size:17px;font-weight:600;margin-top:14px;">Employee Hiring Package</p>
  <p>${fullName || pkg.employeeName || "Employee"}</p>
  ${pkg.jobTitle ? `<p>${pkg.jobTitle}</p>` : ""}
  ${pkg.startDate ? `<p>Start Date: ${pkg.startDate}</p>` : ""}
</div>
<div style="padding:0 0;">
  ${respHtml}
  ${sectionHtml}
  ${acceptancesHtml}
  <div style="margin-top:48px;">
    <h2 style="font-size:15px;font-weight:700;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:14px;">Acknowledgement</h2>
    <p style="font-size:12px;line-height:1.8;color:#374151;">By signing below, I confirm that I have read, understood, and agreed to all policies and conditions outlined in this hiring package. I confirm that all information I provided is accurate to the best of my knowledge.</p>
    <div style="margin-top:32px;display:flex;gap:48px;flex-wrap:wrap;">
      ${signatureHtml}
      <div style="margin-top:40px;border-top:1px solid #1a1a1a;width:200px;"><p style="font-size:10px;color:#6b7280;margin-top:4px;">Date: ${pkg.completedAt ? fmtDate(pkg.completedAt) : ""}</p></div>
    </div>
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
        <button className="shrink-0" onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
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
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setDraft(section.content); }}>Cancel</Button>
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
            <Input id="send-email-input" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="employee@example.com" className="mt-1" data-testid="input-send-email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate(email)} disabled={!email || mutation.isPending} data-testid="button-confirm-send-email">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Status Action Dialog ──────────────────────────────────────────────────────
function StatusActionDialog({
  open, onClose, action, pkgId, onDone,
}: {
  open: boolean; onClose: () => void;
  action: "approve" | "not_approved" | "missing_documents" | "under_review" | "fired_inactive" | "archived";
  pkgId: string; onDone: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [missingMsg, setMissingMsg] = useState("");

  const statusMap: Record<string, string> = {
    approve: "approved",
    not_approved: "not_approved",
    missing_documents: "missing_documents",
    under_review: "under_review",
    fired_inactive: "fired_inactive",
    archived: "archived",
  };

  const labelMap: Record<string, string> = {
    approve: "Approve / Mark as Hired",
    not_approved: "Mark Not Approved",
    missing_documents: "Request Missing Documents",
    under_review: "Move to Under Review",
    fired_inactive: "Mark Fired / Inactive",
    archived: "Archive",
  };

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/hiring-packages/${pkgId}/update-status`, {
      status: statusMap[action],
      statusNote: note || null,
      missingDocsMessage: action === "missing_documents" ? missingMsg : null,
    }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      onDone();
      onClose();
      setNote(""); setMissingMsg("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labelMap[action]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {action === "missing_documents" && (
            <div>
              <Label>Message to Employee <span className="text-red-500">*</span></Label>
              <Textarea
                value={missingMsg}
                onChange={e => setMissingMsg(e.target.value)}
                placeholder="List the specific documents or information the employee needs to provide..."
                className="mt-1 min-h-[80px] text-sm"
                data-testid="textarea-missing-docs-message"
              />
            </div>
          )}
          <div>
            <Label>Internal Note (admin only, optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add an internal note about this status change..."
              className="mt-1 min-h-[60px] text-sm"
              data-testid="textarea-status-note"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (action === "missing_documents" && !missingMsg.trim())}
            className={action === "approve" ? "bg-green-600 hover:bg-green-700" : action === "not_approved" || action === "fired_inactive" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Confirm
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
  const [statusAction, setStatusAction] = useState<"approve" | "not_approved" | "missing_documents" | "under_review" | "fired_inactive" | "archived" | null>(null);
  const [docPreview, setDocPreview] = useState<{ data: string; mimeType: string; filename: string } | null>(null);

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

  function downloadDoc(doc: any) {
    const link = document.createElement("a");
    link.href = doc.data;
    link.download = doc.filename || doc.docType;
    link.click();
  }

  const statusMeta = STATUS_META[pkg?.status || "draft"] || STATUS_META.draft;
  const StatusIcon = statusMeta.Icon;
  const isSubmittedOrLater = ["submitted", "under_review", "missing_documents", "approved", "not_approved", "fired_inactive", "archived", "completed"].includes(pkg?.status || "");

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
  const policyAcceptances = (pkg.policyAcceptances as any[]) || [];
  const uploadedDocs = (pkg.uploadedDocuments as any[]) || [];
  const publicUrl = `${window.location.origin}/public/hiring-package/${pkg.publicToken}`;
  const fullName = resp?.fullName || (resp?.firstName ? `${resp.firstName} ${resp.lastName || ""}`.trim() : pkg.employeeName);

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
            <Button variant="outline" size="sm" onClick={() => setSendDialogOpen(true)} data-testid="button-send-email" className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Send Email
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => printHiringPackage(pkg, sections, pkg.company?.name || "Your Company")}
              data-testid="button-print-package" className="gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-package"
              className="gap-1.5">
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
        </div>

        {/* Admin Status Actions (shown when package is submitted or later) */}
        {isSubmittedOrLater && (
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Review Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-1.5 text-white"
                onClick={() => setStatusAction("approve")}
                data-testid="button-approve-package"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Approve / Hire
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-yellow-300 text-yellow-800 hover:bg-yellow-50"
                onClick={() => setStatusAction("under_review")}
                data-testid="button-under-review"
              >
                <Clock className="w-3.5 h-3.5" /> Mark Under Review
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-orange-300 text-orange-800 hover:bg-orange-50"
                onClick={() => setStatusAction("missing_documents")}
                data-testid="button-request-docs"
              >
                <AlertCircle className="w-3.5 h-3.5" /> Request Missing Docs
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => setStatusAction("not_approved")}
                data-testid="button-not-approved"
              >
                <ThumbsDown className="w-3.5 h-3.5" /> Not Approved
              </Button>
              {pkg.status === "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-gray-600"
                  onClick={() => setStatusAction("fired_inactive")}
                  data-testid="button-fired-inactive"
                >
                  <X className="w-3.5 h-3.5" /> Mark Fired / Inactive
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-gray-500"
                onClick={() => setStatusAction("archived")}
                data-testid="button-archive-package"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </Button>
            </div>
            {pkg.statusNote && (
              <p className="text-xs text-gray-500 mt-3 italic">Internal note: {pkg.statusNote}</p>
            )}
          </div>
        )}

        {/* Timeline */}
        {(pkg.sentAt || pkg.viewedAt || pkg.completedAt) && (
          <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5 border">
            {pkg.sentAt && <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Sent {fmtDate(pkg.sentAt)}</span>}
            {pkg.viewedAt && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Viewed {fmtDate(pkg.viewedAt)}</span>}
            {pkg.completedAt && <span className="flex items-center gap-1 text-green-700 font-medium"><CheckCircle2 className="w-3 h-3" /> Submitted {fmtDate(pkg.completedAt)}</span>}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Employee Info + Notes + Link */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> Employee Info
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

        {/* Employee Response (if submitted) */}
        {resp && (
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-4 h-4" /> Employee Submission
                {pkg.completedAt && <span className="text-xs font-normal text-green-600">Submitted {fmtDateTime(pkg.completedAt)}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Personal Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  ["Full Name", fullName],
                  ["Email", resp.email],
                  ["Phone", resp.phone],
                  ["Job Title", resp.jobTitle],
                  ["Start Date", resp.startDate],
                  ["Address", [resp.address, resp.city, resp.province, resp.postalCode, resp.country].filter(Boolean).join(", ")],
                ].map(([label, value]) => value ? (
                  <div key={label as string}>
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className="text-gray-900 mt-0.5">{value}</p>
                  </div>
                ) : null)}
              </div>

              {/* Emergency Contacts */}
              {resp.emergencyContact1?.name && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Emergency Contact 1</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-gray-500">Name</p><p>{resp.emergencyContact1.name}</p></div>
                    <div><p className="text-xs text-gray-500">Relationship</p><p>{resp.emergencyContact1.relationship || "—"}</p></div>
                    <div><p className="text-xs text-gray-500">Phone</p><p>{resp.emergencyContact1.phone || "—"}</p></div>
                    <div><p className="text-xs text-gray-500">Email</p><p>{resp.emergencyContact1.email || "—"}</p></div>
                  </div>
                </div>
              )}
              {resp.emergencyContact2?.name && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Emergency Contact 2</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-gray-500">Name</p><p>{resp.emergencyContact2.name}</p></div>
                    <div><p className="text-xs text-gray-500">Relationship</p><p>{resp.emergencyContact2.relationship || "—"}</p></div>
                    <div><p className="text-xs text-gray-500">Phone</p><p>{resp.emergencyContact2.phone || "—"}</p></div>
                    <div><p className="text-xs text-gray-500">Email</p><p>{resp.emergencyContact2.email || "—"}</p></div>
                  </div>
                </div>
              )}

              {/* Medical */}
              {(resp.allergies || resp.sensitivities || resp.medicalNotes || resp.medicationNote) && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Medical Information (Confidential)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {resp.allergies && <div><p className="text-xs text-gray-500">Allergies</p><p>{resp.allergies}</p></div>}
                    {resp.sensitivities && <div><p className="text-xs text-gray-500">Sensitivities</p><p>{resp.sensitivities}</p></div>}
                    {resp.medicalNotes && <div className="md:col-span-2"><p className="text-xs text-gray-500">Medical Notes</p><p>{resp.medicalNotes}</p></div>}
                    {resp.medicationNote && <div className="md:col-span-2"><p className="text-xs text-gray-500">Medication Note</p><p>{resp.medicationNote}</p></div>}
                  </div>
                </div>
              )}

              {/* Uploaded Documents */}
              {uploadedDocs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Uploaded Documents</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {uploadedDocs.map((doc: any) => {
                      const docFile = resp?.documentFiles?.[doc.docType];
                      return (
                        <div key={doc.docType} className="flex items-center justify-between rounded-lg border bg-white p-2.5 gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 capitalize">{doc.docType.replace(/_/g, " ")}</p>
                            <p className="text-[10px] text-gray-400 truncate">{doc.filename}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {docFile?.mimeType?.startsWith("image/") && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                                onClick={() => setDocPreview({ data: docFile.data, mimeType: docFile.mimeType, filename: doc.filename || doc.docType })}
                                title="Preview">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {docFile?.data && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                                onClick={() => downloadDoc({ ...docFile, filename: doc.filename || doc.docType })}
                                title="Download">
                                <FileDown className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="Uploaded" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Signature */}
              {pkg.signatureData && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Digital Signature</p>
                  <div className="border rounded-lg p-2 bg-white inline-block">
                    <img src={pkg.signatureData} alt="Signature" className="max-h-24 max-w-xs" />
                  </div>
                </div>
              )}

              {/* Policy acceptance log */}
              {policyAcceptances.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Policy Acceptance Log ({policyAcceptances.length} accepted)</p>
                  <div className="space-y-1.5">
                    {policyAcceptances.map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50/50 px-3 py-2">
                        <span className="text-xs text-gray-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
                          {a.title || a.sectionId}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-2">{a.acceptedAt ? fmtDateTime(a.acceptedAt) : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Send email dialog */}
      <SendEmailDialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        defaultEmail={empInfo.employeeEmail}
        defaultName={empInfo.employeeName}
        pkgId={id}
        onSent={() => qc.invalidateQueries({ queryKey: ["/api/admin/hiring-packages", id] })}
      />

      {/* Status action dialog */}
      {statusAction && (
        <StatusActionDialog
          open={!!statusAction}
          onClose={() => setStatusAction(null)}
          action={statusAction}
          pkgId={id}
          onDone={() => qc.invalidateQueries({ queryKey: ["/api/admin/hiring-packages", id] })}
        />
      )}

      {/* Document preview dialog */}
      <Dialog open={!!docPreview} onOpenChange={v => !v && setDocPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{docPreview?.filename}</DialogTitle>
          </DialogHeader>
          {docPreview?.mimeType?.startsWith("image/") && (
            <img src={docPreview.data} alt={docPreview.filename} className="w-full rounded-lg border max-h-[70vh] object-contain" />
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => docPreview && downloadDoc(docPreview)}>
              <FileDown className="w-3.5 h-3.5 mr-1" /> Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
