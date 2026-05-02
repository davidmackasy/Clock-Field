import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Send, Copy, CheckCircle2, Clock, XCircle, Archive, Loader2,
  Eye, AlertCircle, Users, FileText, Pencil, Trash2, Download, User,
  Phone, Shield, ChevronDown, ChevronUp, X, RotateCcw, Settings,
  Briefcase, ChevronRight, RefreshCw, FileDown, Package,
} from "lucide-react";

// ── Default Policies ──────────────────────────────────────────────────────────
const DEFAULT_POLICIES = [
  {
    id: "rules_of_conduct",
    title: "Rules of Conduct / Conditions of Employment",
    version: "1.0",
    required: true,
    order: 1,
    content: `Objective:\nTo establish clear expectations regarding employee conduct, performance, and behaviour while employed with [Company Name]. These rules exist to ensure a safe, respectful, and productive workplace for all team members and clients.\n\nScope:\nThis policy applies to all employees, contractors, and subcontractors working on behalf of [Company Name].\n\nConduct Standards:\n1. Employees must arrive on time for all scheduled shifts. Consistent tardiness or unexcused absences will result in disciplinary action.\n2. All employees must treat clients, colleagues, supervisors, and the public with courtesy and professionalism at all times.\n3. Theft, fraud, dishonesty, or misrepresentation of any kind will result in immediate termination and may be referred to law enforcement.\n4. Employees must not use company vehicles, supplies, or property for personal use without prior written approval.\n5. All client information, home access details, and business information must be treated as strictly confidential.\n6. Use of personal mobile phones during working hours must be kept to an absolute minimum and must not interfere with work duties.\n7. Employees must not consume alcohol or non-prescribed substances before or during scheduled shifts.\n8. Any disputes with colleagues or clients must be reported to management immediately and must not be handled personally in an aggressive or confrontational manner.\n\nPerformance Standards:\n1. Employees are expected to complete all assigned duties to the standard outlined by management and client expectations.\n2. Employees must follow cleaning protocols, checklists, and instructions provided by supervisors without deviation.\n3. Failure to meet consistent performance standards will result in documented warnings, additional training, or termination.\n\nConsequences:\nViolation of these rules may result in verbal warning, written warning, suspension, demotion, or termination, depending on the severity and frequency of the violation.`,
    acceptanceStatement: "I have read, understood, and agree to abide by the Rules of Conduct and Conditions of Employment.",
  },
  {
    id: "code_of_ethics",
    title: "Code of Ethics",
    version: "1.0",
    required: true,
    order: 2,
    content: `Objective:\nTo define the ethical standards expected of all employees and to ensure that [Company Name] operates with integrity, transparency, and respect in every aspect of its business.\n\nScope:\nThis code applies to all persons employed by or representing [Company Name].\n\nCore Ethical Principles:\n1. Integrity: Employees must act honestly and with integrity in all business dealings, communications, and interactions.\n2. Respect: Every person — client, colleague, or member of the public — must be treated with dignity and respect regardless of their background, identity, or status.\n3. Accountability: Employees must take responsibility for their actions and report mistakes or incidents promptly and honestly.\n4. Confidentiality: Client information, business records, pricing, staff details, and operational data must never be shared externally without written authorization.\n5. Conflict of Interest: Employees must disclose any potential conflict of interest to management in writing and must not allow personal interests to influence their work decisions.\n6. Client Trust: [Company Name] builds its reputation on trust. Employees must never take advantage of client access, belongings, or vulnerabilities.\n7. Fair Dealing: Employees must not engage in unfair competitive practices, deceptive behaviour, or misrepresentation of services.\n\nReporting Ethical Concerns:\nAny employee who witnesses or suspects unethical behaviour must report it to their supervisor or management. Reports made in good faith will be treated confidentially and with no retaliation.`,
    acceptanceStatement: "I have read and agree to uphold the Code of Ethics in all aspects of my employment.",
  },
  {
    id: "dress_code",
    title: "Dress Code and Personal Hygiene Policy",
    version: "1.0",
    required: true,
    order: 3,
    content: `Objective:\nTo ensure that all employees present a professional, clean, and consistent appearance while representing [Company Name] on job sites and in client environments.\n\nScope:\nThis policy applies to all field employees, supervisors, and any employee who interacts with clients.\n\nUniform Requirements:\n1. All employees must wear the designated company uniform at all times while on active duty. Uniform items will be provided by [Company Name] unless otherwise communicated.\n2. Uniforms must be clean, pressed where applicable, and in good condition. Torn, stained, or excessively worn uniforms must be replaced promptly.\n3. Company-branded items (shirts, jackets, hats) must not be modified, cut, or worn with offensive or inappropriate personal clothing.\n4. Employees must wear appropriate closed-toe footwear on all job sites. Safety boots are required in designated areas and are subject to the Safety Boots Reimbursement Policy.\n5. Excessive jewellery that poses a safety risk or could cause damage to client property must not be worn during shifts.\n\nPersonal Hygiene:\n1. Employees must maintain adequate personal hygiene standards at all times during working hours.\n2. Strong fragrances, including heavy perfumes or colognes, must be avoided as they may affect clients with allergies or sensitivities.\n3. Hair must be clean and either tied back or secured when working in environments where it could pose a hygiene or safety concern.\n\nNon-Compliance:\nFailure to maintain dress and hygiene standards may result in the employee being sent home without pay until the issue is corrected, followed by a formal warning.`,
    acceptanceStatement: "I have read and agree to follow the Dress Code and Personal Hygiene Policy.",
  },
  {
    id: "safety_boots",
    title: "Safety Boots Reimbursement Policy",
    version: "1.0",
    required: true,
    order: 4,
    content: `Objective:\nTo ensure all employees working in environments that require protective footwear are properly equipped, and to outline the reimbursement process for approved safety boot purchases.\n\nScope:\nThis policy applies to all field employees required to wear CSA-approved safety boots as part of their job duties.\n\nRequirements:\n1. Employees working on-site must wear CSA-approved Grade 1 safety boots (steel toe or composite toe) at all times during active field duties.\n2. Boots must be in good condition and provide adequate protection. Damaged or worn-through boots must be replaced promptly.\n3. Employees are responsible for purchasing their own safety boots.\n\nReimbursement:\n1. [Company Name] will reimburse eligible employees up to the approved amount of $[boot_reimbursement_amount] for the purchase of safety boots upon commencement of employment.\n2. To receive reimbursement, the employee must submit a valid receipt within 30 days of purchase. Receipts submitted after this period will not be accepted.\n3. Reimbursement will be processed through payroll within the next pay period after submission of an approved receipt.\n4. Only one reimbursement per 12-month period is permitted unless boots are damaged in the course of employment, in which case a management-approved exception may be granted.\n5. Reimbursement is not available for employees who have not yet completed their probationary period unless pre-approved in writing by management.\n\nEmployees must retain all receipts and submit them to management for processing.`,
    acceptanceStatement: "I have read and agree to the Safety Boots Reimbursement Policy.",
  },
  {
    id: "substance_abuse",
    title: "Substance Abuse Policy / Suspicion of Impairment",
    version: "1.0",
    required: true,
    order: 5,
    content: `Objective:\nTo maintain a safe, healthy, and drug-free workplace for all employees, clients, and the public.\n\nScope:\nThis policy applies to all employees, subcontractors, and individuals representing [Company Name] during working hours, on company premises, in company vehicles, or at client locations.\n\nProhibited Conduct:\n1. Reporting to work under the influence of alcohol, cannabis, illegal drugs, or any substance that impairs judgment, motor control, or behaviour is strictly prohibited.\n2. Possessing, using, distributing, or selling controlled substances on company premises, in company vehicles, or at client locations is strictly prohibited.\n3. Misuse of prescription medication in a manner that impairs safe job performance is prohibited. Employees taking prescription medication that may affect performance must notify management in confidence.\n\nSuspicion of Impairment:\n1. Supervisors are authorized to remove any employee from duty if there is reasonable suspicion of impairment.\n2. Reasonable suspicion may be based on observable signs including but not limited to: slurred speech, unsteady balance, erratic behaviour, odour of alcohol or cannabis, or inability to communicate clearly.\n3. An employee removed from duty due to suspected impairment will not be paid for the remainder of that shift.\n4. The employee may be subject to further investigation, mandatory assessment, and disciplinary action up to and including termination.\n\nConsequences:\nAny confirmed violation of this policy will result in immediate termination. Employees causing harm or damage while impaired on duty may be subject to legal action.\n\nDuty to Accommodate:\n[Company Name] is committed to accommodating employees with a substance use disorder in accordance with applicable human rights legislation, subject to the requirement that the employee participate in an approved treatment or rehabilitation program.`,
    acceptanceStatement: "I have read and agree to the Substance Abuse Policy and understand the consequences of impairment on duty.",
  },
  {
    id: "medical_privacy",
    title: "Emergency Contact and Medical Information Privacy Notice",
    version: "1.0",
    required: true,
    order: 6,
    content: `Objective:\nTo inform employees of how their emergency contact and optional medical information is collected, stored, and used by [Company Name].\n\nScope:\nThis notice applies to all employees who provide emergency contact details or optional medical information as part of their onboarding process.\n\nInformation Collected:\n1. Emergency Contact Information: Name, relationship, phone number, and email address for up to two designated emergency contacts.\n2. Optional Medical Information: Allergies, sensitivities, medical conditions relevant to workplace safety, medications, or notes the employee voluntarily chooses to disclose.\n\nPurpose of Collection:\nEmergency contact information is collected solely to enable [Company Name] to reach a designated person in the event of a workplace emergency, illness, or accident.\n\nOptional medical information is collected only to help [Company Name] respond appropriately in an emergency, allergy, sensitivity, or safety situation that may occur at work.\n\nStorage and Access:\n1. All personal and medical information is stored securely and is treated as strictly confidential.\n2. Access to this information is restricted to authorized personnel on a strict need-to-know basis.\n3. This information will not be shared externally, sold, or used for any purpose other than those described in this notice.\n4. Optional medical information is not used to make employment decisions and is not shared with clients, insurers, or third parties without explicit written consent from the employee.\n\nVoluntary Disclosure:\nThe provision of optional medical information is entirely voluntary. Employees are not required to disclose personal medical history. Only information relevant to a potential workplace emergency or safety concern is requested.\n\nRetention:\nPersonal information will be retained for the duration of employment and for a reasonable period thereafter as required by applicable law, after which it will be securely destroyed.`,
    acceptanceStatement: "I have read and understand the Emergency Contact and Medical Information Privacy Notice.",
  },
  {
    id: "final_acknowledgement",
    title: "Final Employee Acknowledgement",
    version: "1.0",
    required: true,
    order: 7,
    content: `By completing this hiring package, I acknowledge and confirm the following:\n\n1. I have read each policy and document included in this hiring package in its entirety.\n2. I understand the contents of all policies, including the Rules of Conduct, Code of Ethics, Dress Code, Safety Boots Reimbursement Policy, Substance Abuse Policy, and Privacy Notice.\n3. I agree to comply with all policies outlined in this hiring package as a condition of my employment.\n4. I understand that these policies may form part of my confidential employment file and may be referenced in employment reviews, performance discussions, or disciplinary proceedings.\n5. I confirm that all personal information I have provided in this application is accurate and complete to the best of my knowledge. I understand that providing false information may result in termination.\n6. I consent to [Company Name] storing my personal information, emergency contact details, and optionally provided medical information in accordance with the Privacy Notice included in this package.\n7. I acknowledge that the digital signature I provide in this package is legally binding and serves as my consent to all contents of this hiring package.\n8. I understand that this hiring package does not constitute a contract of employment and that my employment remains subject to the terms communicated at the time of my official offer.\n\nIf I have any questions about any of the policies or information contained in this hiring package, I agree to raise them with management before completing the final signature step.`,
    acceptanceStatement: "I have read, understood, and agree to this Final Employee Acknowledgement. I confirm that all information I have provided is accurate.",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Policy = typeof DEFAULT_POLICIES[0];

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
    sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
    viewed: { label: "Viewed", className: "bg-purple-100 text-purple-700" },
    started: { label: "Started", className: "bg-yellow-100 text-yellow-800" },
    in_progress: { label: "In Progress", className: "bg-orange-100 text-orange-700" },
    submitted: { label: "Submitted", className: "bg-green-100 text-green-700" },
    under_review: { label: "Under Review", className: "bg-blue-100 text-blue-700" },
    missing_documents: { label: "Missing Docs", className: "bg-red-100 text-red-700" },
    approved_hired: { label: "Approved / Hired", className: "bg-emerald-100 text-emerald-700" },
    not_approved: { label: "Not Approved", className: "bg-red-100 text-red-700" },
    archived: { label: "Archived", className: "bg-gray-100 text-gray-500" },
  };
  const m = map[status] || { label: status, className: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.className}`}>{m.label}</span>;
}

// ── Templates Tab ─────────────────────────────────────────────────────────────
function TemplatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/hiring-package/templates"] });

  const createMut = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/hiring-package/templates", { name, policies: DEFAULT_POLICIES, isDefault: templates.length === 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hiring-package/templates"] }); setCreateOpen(false); setNewName(""); toast({ title: "Template created" }); },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/hiring-package/templates/${id}`, { isDefault: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hiring-package/templates"] }); toast({ title: "Default template updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hiring-package/templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hiring-package/templates"] }); setDeleteId(null); toast({ title: "Template deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  if (isLoading) return <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Templates</h2>
          <p className="text-sm text-muted-foreground">Reusable hiring package layouts. The default template is used when creating new packages.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-create-template"><Plus className="w-4 h-4 mr-1.5" />New Template</Button>
      </div>

      {templates.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No templates yet. Create one to get started.</p>
          <Button size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>Create Default Template</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t: any) => (
            <div key={t.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    {t.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Default</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{(t.policies || []).length} policies · Created {fmtDate(t.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!t.isDefault && (
                  <Button size="sm" variant="outline" onClick={() => setDefaultMut.mutate(t.id)} data-testid={`button-set-default-${t.id}`}>Set Default</Button>
                )}
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(t.id)} data-testid={`button-delete-template-${t.id}`}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Template Name</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Standard Hiring Package" data-testid="input-template-name" />
            <p className="text-xs text-muted-foreground">The new template will be created with the 7 default policies.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(newName)} disabled={!newName.trim() || createMut.isPending} data-testid="button-create-template-confirm">
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Template?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this template. Packages already sent will not be affected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMut.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Policies Tab ──────────────────────────────────────────────────────────────
function PoliciesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [policies, setPolicies] = useState<Policy[]>(DEFAULT_POLICIES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Policy>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/hiring-package/templates"] });
  const defaultTemplate = (templates as any[]).find((t: any) => t.isDefault);

  useEffect(() => {
    if (defaultTemplate?.policies?.length) setPolicies(defaultTemplate.policies);
  }, [defaultTemplate?.id]);

  const save = async () => {
    setSaving(true);
    try {
      const ordered = policies.map((p, i) => ({ ...p, order: i + 1 }));
      if (defaultTemplate) {
        await apiRequest("PATCH", `/api/hiring-package/templates/${defaultTemplate.id}`, { policies: ordered });
      } else {
        await apiRequest("POST", "/api/hiring-package/templates", { name: "Default Template", policies: ordered, isDefault: true });
      }
      qc.invalidateQueries({ queryKey: ["/api/hiring-package/templates"] });
      toast({ title: "Policies saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const startEdit = (p: Policy) => { setEditingId(p.id); setEditDraft({ ...p }); };
  const cancelEdit = () => { setEditingId(null); setEditDraft({}); };
  const saveEdit = () => {
    setPolicies(ps => ps.map(p => p.id === editingId ? { ...p, ...editDraft } as Policy : p));
    setEditingId(null); setEditDraft({});
  };
  const remove = (id: string) => setPolicies(ps => ps.filter(p => p.id !== id));
  const moveUp = (idx: number) => { if (idx === 0) return; const a = [...policies]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; setPolicies(a); };
  const moveDown = (idx: number) => { if (idx === policies.length - 1) return; const a = [...policies]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; setPolicies(a); };
  const duplicate = (p: Policy) => {
    const copy = { ...p, id: p.id + "_copy_" + Date.now(), title: p.title + " (Copy)", order: policies.length + 1 };
    setPolicies(ps => [...ps, copy]);
  };
  const addNew = () => {
    const np: Policy = { id: "policy_" + Date.now(), title: "New Policy", version: "1.0", required: true, order: policies.length + 1, content: "", acceptanceStatement: "I have read and agree to this policy." };
    setPolicies(ps => [...ps, np]);
    setEditingId(np.id); setEditDraft({ ...np });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Policies</h2>
          <p className="text-sm text-muted-foreground">Manage policies included in the hiring package. Changes apply to the default template.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)} data-testid="button-restore-defaults"><RotateCcw className="w-4 h-4 mr-1" />Restore Defaults</Button>
          <Button size="sm" variant="outline" onClick={addNew} data-testid="button-add-policy"><Plus className="w-4 h-4 mr-1" />Add Policy</Button>
          <Button size="sm" onClick={save} disabled={saving} data-testid="button-save-policies">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Save Policies
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {policies.map((policy, idx) => (
          <div key={policy.id} className="border rounded-lg overflow-hidden">
            {editingId === policy.id ? (
              <div className="p-4 space-y-3 bg-blue-50/50">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Policy Title</Label><Input value={editDraft.title || ""} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))} className="mt-1 h-8 text-sm" data-testid="input-policy-title" /></div>
                  <div><Label className="text-xs">Version</Label><Input value={editDraft.version || ""} onChange={e => setEditDraft(d => ({ ...d, version: e.target.value }))} className="mt-1 h-8 text-sm" /></div>
                </div>
                <div><Label className="text-xs">Policy Content</Label><Textarea value={editDraft.content || ""} onChange={e => setEditDraft(d => ({ ...d, content: e.target.value }))} className="mt-1 text-sm min-h-[140px]" data-testid="textarea-policy-content" /></div>
                <div><Label className="text-xs">Acceptance Statement (button text shown to applicant)</Label><Input value={editDraft.acceptanceStatement || ""} onChange={e => setEditDraft(d => ({ ...d, acceptanceStatement: e.target.value }))} className="mt-1 h-8 text-sm" /></div>
                <div className="flex items-center gap-2"><Switch checked={!!editDraft.required} onCheckedChange={v => setEditDraft(d => ({ ...d, required: v }))} /><span className="text-sm">Required policy</span></div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                  <Button size="sm" onClick={saveEdit} data-testid="button-save-policy-edit">Save</Button>
                </div>
              </div>
            ) : (
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => moveDown(idx)} disabled={idx === policies.length - 1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                  </div>
                  <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{policy.title}</span>
                      <span className="text-xs text-muted-foreground">v{policy.version}</span>
                      {policy.required ? <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Required</span> : <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Optional</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{policy.acceptanceStatement}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(policy)} data-testid={`button-edit-policy-${idx}`}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => duplicate(policy)}><FileText className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => remove(policy.id)} data-testid={`button-remove-policy-${idx}`}><X className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Restore Default Policies?</AlertDialogTitle><AlertDialogDescription>This will replace all current policies with the original 7 default policies. Unsaved changes will be lost.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setPolicies(DEFAULT_POLICIES); setEditingId(null); setConfirmReset(false); }}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Create Package Tab ────────────────────────────────────────────────────────
function CreatePackageTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeName: "", employeeEmail: "", position: "", templateId: "" });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<any>(null);

  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/hiring-package/templates"] });
  const defaultTemplate = (templates as any[]).find((t: any) => t.isDefault);

  const handleCreate = async () => {
    if (!form.employeeName.trim() || !form.employeeEmail.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" }); return;
    }
    setCreating(true);
    try {
      const pkg: any = await apiRequest("POST", "/api/hiring-package/packages", {
        employeeName: form.employeeName,
        employeeEmail: form.employeeEmail,
        position: form.position,
        templateId: form.templateId || defaultTemplate?.id || null,
      });
      await apiRequest("POST", `/api/hiring-package/packages/${pkg.id}/send`);
      qc.invalidateQueries({ queryKey: ["/api/hiring-package/packages"] });
      setCreated(pkg);
      toast({ title: "Hiring package sent!", description: `Link sent to ${form.employeeEmail}` });
      setForm({ employeeName: "", employeeEmail: "", position: "", templateId: "" });
    } catch (e: any) {
      toast({ title: "Failed to create package", description: e?.message || "Please try again.", variant: "destructive" });
    } finally { setCreating(false); }
  };

  const publicLink = created ? `${window.location.origin}/public/hiring-package/${created.publicToken}` : "";

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold">Create Package</h2>
        <p className="text-sm text-muted-foreground">Create and send a hiring package link to a new applicant.</p>
      </div>

      {created && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-700 font-medium text-sm"><CheckCircle2 className="w-4 h-4" />Package sent successfully!</div>
          <div className="flex items-center gap-2">
            <Input value={publicLink} readOnly className="text-xs h-8 bg-white" data-testid="input-package-link" />
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicLink); toast({ title: "Link copied" }); }} data-testid="button-copy-link"><Copy className="w-3.5 h-3.5" /></Button>
          </div>
          <Button size="sm" variant="ghost" className="text-green-700" onClick={() => setCreated(null)}>Create another</Button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label>Applicant Full Name <span className="text-red-500">*</span></Label>
          <Input className="mt-1" value={form.employeeName} onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))} placeholder="Jane Smith" data-testid="input-employee-name" />
        </div>
        <div>
          <Label>Applicant Email <span className="text-red-500">*</span></Label>
          <Input className="mt-1" type="email" value={form.employeeEmail} onChange={e => setForm(f => ({ ...f, employeeEmail: e.target.value }))} placeholder="jane@example.com" data-testid="input-employee-email" />
        </div>
        <div>
          <Label>Position / Job Title</Label>
          <Input className="mt-1" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Cleaning Technician" data-testid="input-position" />
        </div>
        <div>
          <Label>Template</Label>
          <Select value={form.templateId} onValueChange={v => setForm(f => ({ ...f, templateId: v }))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder={defaultTemplate ? `Default: ${defaultTemplate.name}` : "No templates — create one first"} /></SelectTrigger>
            <SelectContent>
              {(templates as any[]).map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? " (Default)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" onClick={handleCreate} disabled={creating || !form.employeeName.trim() || !form.employeeEmail.trim()} data-testid="button-send-package">
          {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}Create & Send Hiring Package
        </Button>
      </div>
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ pkg, onClose }: { pkg: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [missingDocsMsg, setMissingDocsMsg] = useState("");
  const [missingDocsOpen, setMissingDocsOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [section, setSection] = useState<"summary" | "policies" | "personal" | "emergency" | "medical" | "documents" | "signature" | "actions">("summary");

  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/hiring-package/submissions", pkg.id],
    queryFn: () => apiRequest("GET", `/api/hiring-package/submissions/${pkg.id}`),
  });

  useEffect(() => { if (detail?.adminNotes) setAdminNotes(detail.adminNotes); }, [detail?.adminNotes]);

  const statusMut = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/hiring-package/submissions/${pkg.id}/status`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hiring-package/packages"] }); qc.invalidateQueries({ queryKey: ["/api/hiring-package/submissions", pkg.id] }); toast({ title: "Status updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const publicLink = `${window.location.origin}/public/hiring-package/${pkg.publicToken}`;
  const sub = detail?.submission;
  const acceptances = detail?.acceptances || [];
  const docs = detail?.documents || [];
  const personal = sub?.personalInfoJson as any;
  const emergency = sub?.emergencyContactsJson as any;
  const medical = sub?.medicalInfoJson as any;

  const sectionBtn = (id: typeof section, label: string) => (
    <button onClick={() => setSection(id)} className={`text-left px-3 py-2 text-sm rounded-lg w-full transition-colors ${section === id ? "bg-primary text-white" : "hover:bg-muted"}`}>{label}</button>
  );

  const downloadDoc = (doc: any) => {
    const a = document.createElement("a"); a.href = `/api/hiring-package/documents/${doc.id}/download`; a.download = doc.originalName; a.click();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">{pkg.employeeName} {statusBadge(pkg.status)}</div>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">{pkg.employeeEmail} · {pkg.position || "No position"}</p>
            </div>
            <div className="flex gap-2 mr-6">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicLink); toast({ title: "Link copied" }); }}><Copy className="w-3.5 h-3.5 mr-1" />Copy Link</Button>
              {sub && <Button size="sm" variant="outline" onClick={() => window.open(`/api/hiring-package/submissions/${pkg.id}/download-pdf`, "_blank")} data-testid="button-download-pdf"><FileDown className="w-3.5 h-3.5 mr-1" />PDF</Button>}
              {sub && <Button size="sm" variant="outline" onClick={() => window.open(`/api/hiring-package/submissions/${pkg.id}/download-zip`, "_blank")} data-testid="button-download-zip"><Package className="w-3.5 h-3.5 mr-1" />ZIP</Button>}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-44 shrink-0 border-r p-3 space-y-1 overflow-y-auto">
            {sectionBtn("summary", "Summary")}
            {sectionBtn("policies", `Policies (${acceptances.length})`)}
            {sectionBtn("personal", "Personal Info")}
            {sectionBtn("emergency", "Emergency Contacts")}
            {sectionBtn("medical", "Medical Info")}
            {sectionBtn("documents", `Documents (${docs.length})`)}
            {sectionBtn("signature", "Signature")}
            {sectionBtn("actions", "Admin Actions")}
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {isLoading && <div className="space-y-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-24 w-full" /></div>}

            {!isLoading && section === "summary" && (
              <div className="space-y-4">
                <h3 className="font-semibold">Application Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Status</span><div className="mt-0.5">{statusBadge(pkg.status)}</div></div>
                  <div><span className="text-muted-foreground">Sent</span><div className="mt-0.5 font-medium">{fmtDate(pkg.sentAt)}</div></div>
                  <div><span className="text-muted-foreground">Position</span><div className="mt-0.5 font-medium">{pkg.position || "—"}</div></div>
                  <div><span className="text-muted-foreground">Submitted</span><div className="mt-0.5 font-medium">{fmtDate(sub?.submittedAt)}</div></div>
                  <div><span className="text-muted-foreground">Policies Accepted</span><div className="mt-0.5 font-medium">{acceptances.length}</div></div>
                  <div><span className="text-muted-foreground">Documents Uploaded</span><div className="mt-0.5 font-medium">{docs.length}</div></div>
                  <div><span className="text-muted-foreground">Signature</span><div className="mt-0.5 font-medium">{sub?.signatureData ? "✓ Signed" : "Not signed"}</div></div>
                  <div><span className="text-muted-foreground">Final Acknowledgement</span><div className="mt-0.5 font-medium">{sub?.finalAcknowledgement ? "✓ Agreed" : "Not agreed"}</div></div>
                </div>
                {sub?.missingDocsMessage && (
                  <div className="border border-amber-200 bg-amber-50 rounded p-3 text-sm"><span className="font-medium text-amber-700">Missing Documents Request:</span> {sub.missingDocsMessage}</div>
                )}
              </div>
            )}

            {!isLoading && section === "policies" && (
              <div className="space-y-3">
                <h3 className="font-semibold">Accepted Policies</h3>
                {acceptances.length === 0 ? <p className="text-sm text-muted-foreground">No policies accepted yet.</p> : acceptances.map((a: any) => (
                  <div key={a.id} className="border rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between"><span className="font-medium">{a.policyTitle}</span><span className="text-xs text-muted-foreground">v{a.policyVersion}</span></div>
                    <div className="text-xs text-green-600">✓ Accepted {fmtDateTime(a.acceptedAt)}</div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && section === "personal" && (
              <div className="space-y-3">
                <h3 className="font-semibold">Personal Information</h3>
                {!personal ? <p className="text-sm text-muted-foreground">Not provided yet.</p> : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[["Legal First Name", personal.firstName], ["Legal Last Name", personal.lastName], ["Preferred Name", personal.preferredName], ["Email", personal.email], ["Phone", personal.phone], ["Date of Birth", personal.dateOfBirth], ["Home Address", personal.address], ["City", personal.city], ["Province / State", personal.province], ["Postal Code", personal.postalCode], ["Country", personal.country], ["Position", personal.position], ["Expected Start Date", personal.startDate]].map(([k, v]) => v ? (
                      <div key={k}><span className="text-muted-foreground text-xs">{k}</span><div className="font-medium">{v as string}</div></div>
                    ) : null)}
                  </div>
                )}
              </div>
            )}

            {!isLoading && section === "emergency" && (
              <div className="space-y-4">
                <h3 className="font-semibold">Emergency Contacts</h3>
                {!emergency ? <p className="text-sm text-muted-foreground">Not provided yet.</p> : [emergency.contact1, emergency.contact2].filter(Boolean).map((c: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1 text-sm">
                    <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Contact {i + 1}</p>
                    <p className="font-medium">{c.name} — {c.relationship}</p>
                    <p>{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && section === "medical" && (
              <div className="space-y-3">
                <h3 className="font-semibold">Optional Medical Information</h3>
                {!medical || Object.values(medical).every(v => !v) ? <p className="text-sm text-muted-foreground">No medical information provided.</p> : (
                  <div className="space-y-2 text-sm">
                    {[["Allergies", medical.allergies], ["Sensitivities", medical.sensitivities], ["Medical Notes", medical.medicalNotes], ["Medications", medical.medications], ["Emergency Safety Notes", medical.emergencyNotes]].map(([k, v]) => v ? (
                      <div key={k}><span className="text-xs text-muted-foreground">{k}</span><p className="font-medium">{v as string}</p></div>
                    ) : null)}
                  </div>
                )}
              </div>
            )}

            {!isLoading && section === "documents" && (
              <div className="space-y-3">
                <h3 className="font-semibold">Uploaded Documents</h3>
                {docs.length === 0 ? <p className="text-sm text-muted-foreground">No documents uploaded yet.</p> : docs.map((doc: any) => (
                  <div key={doc.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm">
                      <p className="font-medium">{doc.originalName}</p>
                      <p className="text-xs text-muted-foreground">{doc.documentType.replace(/_/g, " ")} · {(doc.fileSize / 1024).toFixed(0)} KB · {fmtDate(doc.uploadedAt)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadDoc(doc)} data-testid={`button-download-doc-${doc.id}`}><Download className="w-3.5 h-3.5 mr-1" />Download</Button>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && section === "signature" && (
              <div className="space-y-3">
                <h3 className="font-semibold">Signature</h3>
                {!sub?.signatureData ? <p className="text-sm text-muted-foreground">Not signed yet.</p> : (
                  <div className="space-y-2">
                    <div className="border rounded-lg p-3 bg-white">
                      <img src={sub.signatureData} alt="Signature" className="max-h-24 object-contain" />
                    </div>
                    <p className="text-xs text-muted-foreground">Signed on {fmtDateTime(sub.signatureUploadedAt)}</p>
                    <p className="text-xs text-muted-foreground">Final Acknowledgement: {sub.finalAcknowledgement ? "✓ Agreed" : "Not agreed"}</p>
                  </div>
                )}
              </div>
            )}

            {!isLoading && section === "actions" && (
              <div className="space-y-4">
                <h3 className="font-semibold">Admin Actions</h3>
                <div>
                  <Label className="text-xs">Admin Notes</Label>
                  <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} className="mt-1 text-sm" rows={3} placeholder="Internal notes..." />
                  <Button size="sm" className="mt-2" onClick={() => statusMut.mutate({ adminNotes })} disabled={statusMut.isPending} data-testid="button-save-notes">Save Notes</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="text-green-700 border-green-200 hover:bg-green-50" onClick={() => statusMut.mutate({ reviewStatus: "approved_hired" })} disabled={statusMut.isPending} data-testid="button-approve">✓ Approve / Mark as Hired</Button>
                  <Button variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50" onClick={() => setMissingDocsOpen(true)} disabled={statusMut.isPending} data-testid="button-missing-docs">Request Missing Documents</Button>
                  <Button variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => statusMut.mutate({ reviewStatus: "not_approved" })} disabled={statusMut.isPending} data-testid="button-not-approved">✗ Not Approved</Button>
                  <Button variant="outline" className="text-gray-600" onClick={() => statusMut.mutate({ reviewStatus: "archived" })} disabled={statusMut.isPending} data-testid="button-archive">Archive</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      <Dialog open={missingDocsOpen} onOpenChange={setMissingDocsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Missing Documents</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Message to Applicant</Label>
            <Textarea value={missingDocsMsg} onChange={e => setMissingDocsMsg(e.target.value)} placeholder="Please upload the following documents..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingDocsOpen(false)}>Cancel</Button>
            <Button onClick={() => { statusMut.mutate({ reviewStatus: "missing_documents", missingDocsMessage: missingDocsMsg }); setMissingDocsOpen(false); }} disabled={!missingDocsMsg.trim()}>Send Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ── Package List Component ────────────────────────────────────────────────────
function PackageList({ packages, emptyMsg }: { packages: any[]; emptyMsg: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hiring-package/packages/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hiring-package/packages"] }); setDeleteId(null); toast({ title: "Package deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const resendMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/hiring-package/packages/${id}/send`),
    onSuccess: () => toast({ title: "Link resent" }),
    onError: () => toast({ title: "Failed to resend", variant: "destructive" }),
  });

  if (packages.length === 0) return (
    <div className="border rounded-lg p-8 text-center text-muted-foreground">
      <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{emptyMsg}</p>
    </div>
  );

  return (
    <>
      <div className="space-y-2">
        {packages.map((pkg: any) => (
          <div key={pkg.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <User className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{pkg.employeeName}</span>
                  {statusBadge(pkg.status)}
                </div>
                <p className="text-xs text-muted-foreground">{pkg.employeeEmail} {pkg.position ? `· ${pkg.position}` : ""} · Sent {fmtDate(pkg.sentAt || pkg.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/public/hiring-package/${pkg.publicToken}`); toast({ title: "Link copied" }); }} data-testid={`button-copy-${pkg.id}`}><Copy className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => resendMut.mutate(pkg.id)} data-testid={`button-resend-${pkg.id}`}><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setReviewing(pkg)} data-testid={`button-review-${pkg.id}`}><Eye className="w-3.5 h-3.5 mr-1" />Review</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => setDeleteId(pkg.id)} data-testid={`button-delete-${pkg.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
      {reviewing && <ReviewModal pkg={reviewing} onClose={() => setReviewing(null)} />}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Package?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the hiring package and all associated data.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMut.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function HiringPackageAdmin() {
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [activeTab, setActiveTab] = useState(searchParams.get("hptab") || "sent");

  const { data: packages = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/hiring-package/packages"] });

  const sentStatuses = ["draft", "sent", "viewed", "started", "in_progress"];
  const submittedStatuses = ["submitted", "under_review", "missing_documents"];

  const sentPkgs = (packages as any[]).filter((p: any) => sentStatuses.includes(p.status));
  const submittedPkgs = (packages as any[]).filter((p: any) => submittedStatuses.includes(p.status));
  const approvedPkgs = (packages as any[]).filter((p: any) => p.status === "approved_hired");
  const archivedPkgs = (packages as any[]).filter((p: any) => ["archived", "not_approved"].includes(p.status));

  const tabs = [
    { id: "templates", label: "Templates", icon: <FileText className="w-4 h-4" /> },
    { id: "policies", label: "Policies", icon: <Settings className="w-4 h-4" /> },
    { id: "create", label: "Create Package", icon: <Plus className="w-4 h-4" /> },
    { id: "sent", label: "Sent Packages", icon: <Send className="w-4 h-4" />, count: sentPkgs.length },
    { id: "submitted", label: "Submitted Applications", icon: <Users className="w-4 h-4" />, count: submittedPkgs.length },
    { id: "approved", label: "Approved / Hired", icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: "archived", label: "Archived", icon: <Archive className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Hiring Package</h1>
          <p className="text-sm text-muted-foreground">Manage and send digital hiring packages to applicants.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`tab-hp-${t.id}`}>
            {t.icon}{t.label}
            {t.count != null && t.count > 0 && <span className="ml-1 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full font-medium">{t.count}</span>}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "policies" && <PoliciesTab />}
        {activeTab === "create" && <CreatePackageTab />}
        {activeTab === "sent" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Packages sent to applicants who have not yet fully submitted.</p>
            {isLoading ? <Skeleton className="h-16 w-full" /> : <PackageList packages={sentPkgs} emptyMsg="No packages sent yet. Go to Create Package to send one." />}
          </div>
        )}
        {activeTab === "submitted" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {submittedPkgs.length === 0 ? "No applications submitted yet." : `${submittedPkgs.length} application${submittedPkgs.length === 1 ? "" : "s"} submitted and awaiting review.`}
            </p>
            {isLoading ? <Skeleton className="h-16 w-full" /> : <PackageList packages={submittedPkgs} emptyMsg="No applications submitted yet." />}
          </div>
        )}
        {activeTab === "approved" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Applicants who have been approved or marked as hired.</p>
            {isLoading ? <Skeleton className="h-16 w-full" /> : <PackageList packages={approvedPkgs} emptyMsg="No approved applicants yet." />}
          </div>
        )}
        {activeTab === "archived" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Archived or not approved applications.</p>
            {isLoading ? <Skeleton className="h-16 w-full" /> : <PackageList packages={archivedPkgs} emptyMsg="No archived applications." />}
          </div>
        )}
      </div>
    </div>
  );
}
