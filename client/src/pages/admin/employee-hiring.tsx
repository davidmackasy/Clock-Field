import { useState, useRef, useEffect } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Send, Copy, CheckCircle2, Clock, XCircle, Archive,
  Loader2, Eye, AlertCircle, UserPlus, Briefcase, MoreHorizontal,
  FileText, CheckCheck, Pencil, Trash2, ExternalLink, Download,
  RefreshCw, User, Phone, Mail, MapPin, Calendar, Shield,
  ChevronDown, ChevronUp, X, FileCheck, Users,
} from "lucide-react";

// ── Default Policy Content ─────────────────────────────────────────────────────
export const DEFAULT_POLICIES = [
  {
    id: "rules_of_conduct",
    title: "Rules of Conduct / Conditions of Employment",
    version: "1.0",
    content: `OBJECTIVE
The Rules of Conduct and Conditions of Employment are designed to protect employees, clients, company property, workplace safety, and the professional reputation of [Company Name].

SCOPE
This policy applies to all employees, contractors, and workers representing [Company Name] while on duty, on client property, using company property, or acting on behalf of the company.

RULES
The following conduct is prohibited and may result in disciplinary action, up to and including termination of employment:

1. Falsification of personal information supplied to the company
2. Using incorrect personal information or identification
3. Damaging company property, client property, or employee property
4. Smoking in unauthorized areas or where a client does not allow smoking
5. Being impaired at work by alcohol, drugs, medication misuse, or any substance
6. Use of profane, threatening, or abusive language
7. Unauthorized opening of desks, cabinets, lockers, refrigerators, or client property
8. Threatening clients, employees, coworkers, or members of the public
9. Unauthorized use of company phone, tools, supplies, vehicle, or equipment
10. Removing anything from the workplace without permission
11. Theft or attempted theft
12. Willful damage to company or client property
13. Leaving assigned work areas without authorization
14. Entering client areas without permission
15. Fighting, harassment, bullying, or unsuitable behaviour
16. Insubordination or failure to follow instructions from a manager, supervisor, or authorized person
17. Bringing personal possessions into client areas without approval
18. Leaving an assigned work area before completing the shift
19. Unauthorized use of client facilities or washrooms
20. Working outside assigned hours without approval
21. Signing in or out for another employee, or allowing another employee to sign in or out for you
22. Failure to sign in or out as required
23. Recording time other than the exact time worked
24. Refusing to cooperate with company or client requirements
25. Any act that may damage the reputation, trust, or business relationship of [Company Name]

ACKNOWLEDGEMENT
I acknowledge that I have read and understood the Rules of Conduct / Conditions of Employment. I understand that failure to follow these rules may result in disciplinary action, up to and including termination of employment.`,
  },
  {
    id: "code_of_ethics",
    title: "Code of Ethics",
    version: "1.0",
    content: `PERSONAL RESPECT
Employees must respect all individuals regardless of origin, beliefs, age, race, gender, or other protected characteristics.

RESPECT FOR CUSTOMERS
Clients are a priority. Employees must act courteously, professionally, and respectfully toward all clients.

RESPECT FOR SOCIETY
Employees must be honest, efficient, and courteous in all dealings with institutions, authorities, and outside organizations.

RESPECT FOR THE ENVIRONMENT
Employees must follow applicable environmental rules and avoid pollution or unsafe disposal practices.

RESPECT FOR THE COMPANY AND ITS INTERESTS
Employees must act honestly and loyally, avoid conflicts of interest, and protect company property and confidential information.

HONESTY AND RESPONSIBILITY
Employees must be honest and transparent in work, reporting, time tracking, client interactions, and company communication.

COMPLIANCE WITH THE LAW
Employees must follow applicable laws and regulations at all times.

COMPLIANCE WITH BUSINESS STANDARDS
Employees must not participate in practices that could damage the company, clients, coworkers, or the public.

COMPLIANCE WITH COMPANY POLICIES
Employees must follow all corporate policies, procedures, safety rules, and instructions provided by [Company Name].

ACKNOWLEDGEMENT
I acknowledge that I have read and understood the Code of Ethics. I agree to follow the ethical standards expected by [Company Name].`,
  },
  {
    id: "dress_code",
    title: "Dress Code and Personal Hygiene Policy",
    version: "1.0",
    content: `OBJECTIVE
Employees must present themselves professionally while representing [Company Name]. Dress, hygiene, and grooming standards help maintain professionalism, safety, client trust, and company image.

SCOPE
This policy applies to all employees while working, visiting client sites, wearing company uniforms, or representing [Company Name].

UNIFORM AND CLOTHING
- Employees must wear issued uniforms while on duty if uniforms are provided
- Uniforms must be used only for work-related purposes
- Uniform items are company property where applicable
- Lost or damaged uniforms must be reported
- Employees may be responsible for replacement costs where allowed by company policy
- Uniforms must be clean, appropriate, and in good condition
- Shoes must be safe, clean, and appropriate for the worksite

HYGIENE
- Employees must maintain clean and appropriate personal hygiene
- Employees should avoid strong perfumes, colognes, or lotions where they may affect clients or coworkers
- Hands and body hygiene must be maintained during work

PERSONAL GROOMING
- Clothing must be clean, pressed, and fit appropriately
- Clothing must not interfere with safe equipment operation
- No dark glasses unless prescribed or required for safety
- Jewelry must not create a safety hazard

INAPPROPRIATE ATTIRE
The following are not permitted: sweatpants, jogging pants, bicycle shorts, athletic shorts, tank tops, ripped or unprofessional clothing, flip-flops, sandals, beach footwear, clothing with offensive wording or images, and inappropriate pins, buttons, or paraphernalia.

ACKNOWLEDGEMENT
I acknowledge that I have read and understood the Dress Code and Personal Hygiene Policy. I agree to follow this policy while representing [Company Name].`,
  },
  {
    id: "safety_boots",
    title: "Safety Boots Reimbursement Policy",
    version: "1.0",
    content: `OBJECTIVE
Some roles may require employees to wear CSA-approved safety boots to perform assigned duties safely.

SCOPE
This policy applies to employees who are required by [Company Name] or client site requirements to wear CSA-approved safety boots.

GUIDELINES
- Employees required to wear CSA-approved safety boots may be eligible for reimbursement up to the approved company amount (default: $60.00)
- Employee must submit the original receipt
- Employee may be required to show the approved safety boots
- Employee must provide any required documentation within the required timeframe
- If approved, reimbursement may be processed through payroll
- If employment ends before the required period, reimbursement may be adjusted or forfeited based on company policy
- Employees are responsible for maintaining their safety boots in safe and usable condition

ACKNOWLEDGEMENT
I acknowledge that I have read and understood the Safety Boots Reimbursement Policy. I agree to follow the requirements for safety footwear and reimbursement.`,
  },
  {
    id: "substance_abuse",
    title: "Substance Abuse Policy / Suspicion of Impairment",
    version: "1.0",
    content: `OBJECTIVE
[Company Name] is committed to maintaining a safe, professional, and substance-free workplace. Employees must not report to work impaired by alcohol, drugs, medication misuse, or any substance that may affect safe and professional work performance.

SCOPE
This policy applies to all employees while working, on client property, using company equipment, driving for work, or representing [Company Name].

ZERO TOLERANCE
[Company Name] uses a zero-tolerance approach to alcohol and drug use in the workplace where safety, client trust, or work performance may be affected.

EMPLOYEE RESPONSIBILITIES
- Report to work fit for duty
- Follow this policy during all working hours
- Do not use, possess, distribute, or be under the influence of alcohol or drugs while working
- Do not consume alcohol or drugs during paid or unpaid breaks when working
- Tell management if a medication or health restriction could affect safe work, where appropriate
- Cooperate with reasonable company procedures where impairment is suspected

COMPANY RESPONSIBILITIES
- Protect employee health, client safety, and workplace safety
- Protect the professional reputation of [Company Name]
- Enforce the policy fairly and investigate and document incidents

SUSPICION OF IMPAIRMENT PROCEDURE
If impairment is reasonably suspected: management may speak privately with the employee, remove the employee from the worksite for safety, arrange safe transportation, and schedule a follow-up meeting. The company may determine whether support, accommodation, or discipline is required.

DISCIPLINARY MEASURES
Failure to comply with this policy may result in disciplinary action, up to and including termination of employment.

ACKNOWLEDGEMENT
I acknowledge that I have read and understood the Substance Abuse Policy / Suspicion of Impairment. I agree to follow this policy and understand that failure to comply may result in disciplinary action, up to and including termination of employment.`,
  },
  {
    id: "emergency_contact_privacy",
    title: "Emergency Contact and Medical Information Privacy Notice",
    version: "1.0",
    content: `PRIVACY NOTICE
The information you provide in the Emergency Contact and Medical Information section will be held in the strictest confidence and will only be shared on a need-to-know basis with authorized company personnel.

This form is not intended to request or investigate your personal medical history. The information is collected only to help respond to an emergency, safety concern, allergy, sensitivity, or medical situation that may occur at work.

All information is stored securely and access is limited to authorized personnel only.

ACKNOWLEDGEMENT
I have read and understood this confidentiality notice regarding my emergency contact and medical information.`,
  },
  {
    id: "final_acknowledgement",
    title: "Final Employee Acknowledgement",
    version: "1.0",
    content: `FINAL ACKNOWLEDGEMENT
By accepting this policy, I confirm and acknowledge the following:

1. I have read and understood all company policies included in this hiring package.
2. I understand that these policies are designed to protect employees, clients, company property, and the professional reputation of [Company Name].
3. I agree to follow all company policies, procedures, and instructions provided by [Company Name].
4. I understand that violations of company policy may result in disciplinary action, up to and including termination of employment.
5. I confirm that all personal information I have provided is accurate and complete to the best of my knowledge.
6. I understand that this hiring package and all accepted policies may become part of my confidential employment file.
7. I understand that [Company Name] reserves the right to update policies and that I will be notified of any material changes.

SIGNATURE
My digital signature on this hiring package confirms that I have reviewed, understood, and agreed to all required company policies and information included in this hiring package.`,
  },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:            { label: "Draft",              color: "bg-gray-100 text-gray-600" },
  sent:             { label: "Sent",               color: "bg-blue-100 text-blue-700" },
  viewed:           { label: "Viewed",             color: "bg-amber-100 text-amber-700" },
  started:          { label: "Started",            color: "bg-purple-100 text-purple-700" },
  in_progress:      { label: "In Progress",        color: "bg-purple-100 text-purple-700" },
  submitted:        { label: "Submitted",          color: "bg-yellow-100 text-yellow-800" },
  under_review:     { label: "Under Review",       color: "bg-yellow-100 text-yellow-800" },
  missing_documents:{ label: "Missing Documents",  color: "bg-orange-100 text-orange-800" },
  approved_hired:   { label: "Approved / Hired",   color: "bg-green-100 text-green-700" },
  not_approved:     { label: "Not Approved",       color: "bg-red-100 text-red-700" },
  fired_inactive:   { label: "Fired / Inactive",   color: "bg-gray-200 text-gray-600" },
  archived:         { label: "Archived",           color: "bg-gray-100 text-gray-500" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status, color: "bg-gray-100 text-gray-600" };
  return <Badge className={`text-xs font-medium ${m.color} border-0`}>{m.label}</Badge>;
}

// ── Submission Review Modal ────────────────────────────────────────────────────
function ReviewModal({ submissionId, onClose }: { submissionId: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [adminNotes, setAdminNotes] = useState("");
  const [missingMsg, setMissingMsg] = useState("");
  const [missingDocs, setMissingDocs] = useState<string[]>([]);
  const [showMissingForm, setShowMissingForm] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/employee-hiring/submissions", submissionId],
    queryFn: () => apiRequest("GET", `/api/employee-hiring/submissions/${submissionId}`).then(r => r.json()),
  });

  const statusMutation = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/employee-hiring/submissions/${submissionId}/status`, body).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/submissions"] });
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/submissions", submissionId] });
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/packages"] });
      toast({ title: "Status updated" });
      if (!showMissingForm && !showApproveModal) onClose();
      setShowMissingForm(false);
      setShowApproveModal(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const notesMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/employee-hiring/submissions/${submissionId}/status`, { adminNotes }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/submissions", submissionId] });
      toast({ title: "Notes saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (data?.submission?.adminNotes) setAdminNotes(data.submission.adminNotes);
  }, [data?.submission?.adminNotes]);

  const DOC_LABELS: Record<string, string> = {
    government_id_front: "Government ID Front",
    government_id_back: "Government ID Back",
    resume_cv: "Resume / CV",
    work_permit: "Work Permit",
    certificate_license: "Certificate / Licence",
    other_supporting_document: "Other Supporting Document",
  };
  const REQUIRED_DOCS = ["government_id_front", "government_id_back", "resume_cv"];
  const ALL_DOC_TYPES = Object.keys(DOC_LABELS);

  if (isLoading) return (
    <div className="space-y-3 py-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );

  const { submission, policies, documents, pkg } = data || {};
  const personalInfo = submission?.personalInfoJson || {};
  const emergency = submission?.emergencyContactsJson || {};
  const medical = submission?.medicalInfoJson || {};

  return (
    <div className="space-y-6 py-2 max-h-[75vh] overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{pkg?.employeeName || "Applicant"}</h3>
          <p className="text-sm text-muted-foreground">{pkg?.employeeEmail} · {pkg?.position}</p>
        </div>
        <StatusBadge status={submission?.reviewStatus || submission?.status || "started"} />
      </div>

      {/* Personal Information */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2"><User className="w-4 h-4" />Personal Information</h4>
          {Object.keys(personalInfo).length === 0 ? (
            <p className="text-sm text-muted-foreground">Not provided yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {personalInfo.firstName && <><span className="text-muted-foreground">Legal Name:</span><span>{personalInfo.firstName} {personalInfo.lastName}</span></>}
              {personalInfo.preferredName && <><span className="text-muted-foreground">Preferred:</span><span>{personalInfo.preferredName}</span></>}
              {personalInfo.email && <><span className="text-muted-foreground">Email:</span><span>{personalInfo.email}</span></>}
              {personalInfo.phone && <><span className="text-muted-foreground">Phone:</span><span>{personalInfo.phone}</span></>}
              {personalInfo.homeAddress && <><span className="text-muted-foreground">Address:</span><span>{personalInfo.homeAddress}, {personalInfo.city}, {personalInfo.province} {personalInfo.postalCode}</span></>}
              {personalInfo.position && <><span className="text-muted-foreground">Position:</span><span>{personalInfo.position}</span></>}
              {personalInfo.startDate && <><span className="text-muted-foreground">Start Date:</span><span>{personalInfo.startDate}</span></>}
              {personalInfo.dateOfBirth && <><span className="text-muted-foreground">Date of Birth:</span><span>{personalInfo.dateOfBirth}</span></>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2"><Phone className="w-4 h-4" />Emergency Contacts</h4>
          {!emergency.contact1Name ? (
            <p className="text-sm text-muted-foreground">Not provided yet</p>
          ) : (
            <div className="space-y-3 text-sm">
              {emergency.contact1Name && (
                <div>
                  <p className="font-medium">Contact 1: {emergency.contact1Name} ({emergency.contact1Relationship})</p>
                  <p className="text-muted-foreground">{emergency.contact1Phone}{emergency.contact1Email ? ` · ${emergency.contact1Email}` : ""}</p>
                </div>
              )}
              {emergency.contact2Name && (
                <div>
                  <p className="font-medium">Contact 2: {emergency.contact2Name} ({emergency.contact2Relationship})</p>
                  <p className="text-muted-foreground">{emergency.contact2Phone}{emergency.contact2Email ? ` · ${emergency.contact2Email}` : ""}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Information */}
      {(medical.allergies || medical.sensitivities || medical.medicalNotes || medical.medications || medical.emergencyNotes) && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2"><Shield className="w-4 h-4" />Medical Information (Confidential)</h4>
            <div className="space-y-1 text-sm">
              {medical.allergies && <p><span className="text-muted-foreground">Allergies:</span> {medical.allergies}</p>}
              {medical.sensitivities && <p><span className="text-muted-foreground">Sensitivities:</span> {medical.sensitivities}</p>}
              {medical.medicalNotes && <p><span className="text-muted-foreground">Medical Notes:</span> {medical.medicalNotes}</p>}
              {medical.medications && <p><span className="text-muted-foreground">Medications:</span> {medical.medications}</p>}
              {medical.emergencyNotes && <p><span className="text-muted-foreground">Emergency Notes:</span> {medical.emergencyNotes}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policy Acceptances */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2"><CheckCheck className="w-4 h-4" />Policy Acceptances ({policies?.length || 0})</h4>
          {!policies?.length ? (
            <p className="text-sm text-muted-foreground">No policies accepted yet</p>
          ) : (
            <div className="space-y-2">
              {policies.map((p: any) => (
                <div key={p.id} className="border rounded-lg">
                  <button
                    className="w-full flex items-center justify-between p-3 text-sm text-left"
                    onClick={() => setExpandedPolicy(expandedPolicy === p.id ? null : p.id)}
                  >
                    <span className="font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      {p.policyTitle}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                      <span className="text-xs">{new Date(p.acceptedAt).toLocaleDateString()}</span>
                      {expandedPolicy === p.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                  {expandedPolicy === p.id && (
                    <div className="px-3 pb-3 border-t pt-2">
                      <p className="text-xs text-muted-foreground mb-2">Accepted: {new Date(p.acceptedAt).toLocaleString()} · v{p.policyVersion}</p>
                      <div className="text-xs bg-muted rounded p-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                        {p.policyContentSnapshot}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Uploaded Documents</h4>
          {ALL_DOC_TYPES.map(dt => {
            const doc = documents?.find((d: any) => d.documentType === dt);
            const isRequired = REQUIRED_DOCS.includes(dt);
            if (!doc && !isRequired) return null;
            return (
              <div key={dt} className="flex items-center justify-between py-1 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{DOC_LABELS[dt]}{isRequired && <span className="text-red-500 ml-1">*</span>}</p>
                  {doc ? (
                    <p className="text-xs text-muted-foreground">{doc.originalName} · {(doc.fileSize / 1024).toFixed(0)} KB · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                  ) : (
                    <p className="text-xs text-orange-600">Not uploaded</p>
                  )}
                </div>
                {doc && (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = `/api/employee-hiring/documents/${doc.id}/download`;
                      a.download = doc.originalName;
                      a.click();
                    }}
                    data-testid={`button-download-${dt}`}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />Download
                  </Button>
                )}
              </div>
            );
          })}
          {documents?.filter((d: any) => !ALL_DOC_TYPES.includes(d.documentType)).map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between py-1 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{doc.documentType}</p>
                <p className="text-xs text-muted-foreground">{doc.originalName} · {(doc.fileSize / 1024).toFixed(0)} KB</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { const a = document.createElement("a"); a.href = `/api/employee-hiring/documents/${doc.id}/download`; a.download = doc.originalName; a.click(); }}>
                <Download className="w-3.5 h-3.5 mr-1" />Download
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Signature */}
      {submission?.signatureData && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2"><Pencil className="w-4 h-4" />Digital Signature</h4>
            <img src={submission.signatureData} alt="Signature" className="border rounded max-w-xs bg-white" />
            {submission.signatureUploadedAt && (
              <p className="text-xs text-muted-foreground">Signed: {new Date(submission.signatureUploadedAt).toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Notes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Admin Notes</Label>
        <Textarea
          value={adminNotes}
          onChange={e => setAdminNotes(e.target.value)}
          placeholder="Internal notes about this applicant..."
          rows={3}
          data-testid="textarea-admin-notes"
        />
        <Button size="sm" variant="outline" onClick={() => notesMutation.mutate()} disabled={notesMutation.isPending}>
          {notesMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Save Notes
        </Button>
      </div>

      {/* Missing Documents Form */}
      {showMissingForm && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4 space-y-3">
            <h4 className="font-medium text-sm text-orange-800">Request Missing Documents</h4>
            <div className="space-y-2">
              {ALL_DOC_TYPES.map(dt => (
                <label key={dt} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={missingDocs.includes(dt)}
                    onChange={e => setMissingDocs(prev => e.target.checked ? [...prev, dt] : prev.filter(x => x !== dt))}
                  />
                  {DOC_LABELS[dt]}
                </label>
              ))}
            </div>
            <Textarea
              value={missingMsg}
              onChange={e => setMissingMsg(e.target.value)}
              placeholder="Message to applicant about what is missing..."
              rows={2}
              data-testid="textarea-missing-message"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => statusMutation.mutate({ reviewStatus: "missing_documents", missingDocsMessage: missingMsg, requestedMissingDocs: missingDocs })} disabled={statusMutation.isPending || missingDocs.length === 0}>
                Send Request
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowMissingForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Decision Buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => setShowApproveModal(true)}
          disabled={statusMutation.isPending}
          data-testid="button-approve-hired"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve / Hired
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => setShowMissingForm(v => !v)}
          disabled={statusMutation.isPending}
          data-testid="button-request-missing"
        >
          <AlertCircle className="w-3.5 h-3.5 mr-1" />Missing Docs
        </Button>
        <Button
          size="sm" variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => statusMutation.mutate({ reviewStatus: "not_approved" })}
          disabled={statusMutation.isPending}
          data-testid="button-not-approved"
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />Not Approved
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => statusMutation.mutate({ reviewStatus: "under_review" })}
          disabled={statusMutation.isPending}
        >
          <Clock className="w-3.5 h-3.5 mr-1" />Under Review
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => statusMutation.mutate({ reviewStatus: "archived" })}
          disabled={statusMutation.isPending}
          data-testid="button-archive"
        >
          <Archive className="w-3.5 h-3.5 mr-1" />Archive
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => statusMutation.mutate({ reviewStatus: "fired_inactive" })}
          disabled={statusMutation.isPending}
        >
          <X className="w-3.5 h-3.5 mr-1" />Fired / Inactive
        </Button>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 space-y-3">
            <h4 className="font-medium text-sm text-green-800">Approve Applicant</h4>
            <p className="text-sm text-green-700">Do you want to create an employee profile from this hiring package?</p>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => statusMutation.mutate({ reviewStatus: "approved_hired", createEmployee: true })} disabled={statusMutation.isPending}>
                <UserPlus className="w-3.5 h-3.5 mr-1" />Create Employee Profile
              </Button>
              <Button size="sm" onClick={() => statusMutation.mutate({ reviewStatus: "approved_hired" })} disabled={statusMutation.isPending}>
                Approve Only
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Template Editor ────────────────────────────────────────────────────────────
function TemplatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/employee-hiring/templates"],
    queryFn: () => apiRequest("GET", "/api/employee-hiring/templates").then(r => r.json()),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", bootReimbursementAmount: "60.00", requireDateOfBirth: false, isDefault: false, policies: DEFAULT_POLICIES });
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (data: any) => editingId
      ? apiRequest("PATCH", `/api/employee-hiring/templates/${editingId}`, data).then(r => r.json())
      : apiRequest("POST", "/api/employee-hiring/templates", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/templates"] });
      toast({ title: editingId ? "Template saved" : "Template created" });
      setEditingId(null);
      setCreating(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employee-hiring/templates/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employee-hiring/templates"] }); setDeleteId(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (t: any) => {
    setForm({ name: t.name, bootReimbursementAmount: t.bootReimbursementAmount || "60.00", requireDateOfBirth: t.requireDateOfBirth || false, isDefault: t.isDefault || false, policies: t.policies || DEFAULT_POLICIES });
    setEditingId(t.id);
    setCreating(true);
  };

  const openCreate = () => {
    setForm({ name: "Default Template", bootReimbursementAmount: "60.00", requireDateOfBirth: false, isDefault: templates.length === 0, policies: DEFAULT_POLICIES });
    setEditingId(null);
    setCreating(true);
  };

  if (creating) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{editingId ? "Edit Template" : "New Template"}</h3>
          <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setEditingId(null); }}>
            <X className="w-4 h-4 mr-1" />Cancel
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Template Name</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} data-testid="input-template-name" />
          </div>
          <div className="space-y-1">
            <Label>Safety Boot Reimbursement Amount ($)</Label>
            <Input value={form.bootReimbursementAmount} onChange={e => setForm(p => ({ ...p, bootReimbursementAmount: e.target.value }))} data-testid="input-boot-amount" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={form.requireDateOfBirth} onCheckedChange={v => setForm(p => ({ ...p, requireDateOfBirth: v }))} />
            Require Date of Birth
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={form.isDefault} onCheckedChange={v => setForm(p => ({ ...p, isDefault: v }))} />
            Set as Default Template
          </label>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm">Policies ({form.policies.length})</h4>
          {form.policies.map((pol, idx) => (
            <div key={pol.id} className="border rounded-lg">
              <button className="w-full flex items-center justify-between p-3 text-sm text-left" onClick={() => setEditingPolicyId(editingPolicyId === pol.id ? null : pol.id)}>
                <span className="font-medium">{idx + 1}. {pol.title}</span>
                {editingPolicyId === pol.id ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
              </button>
              {editingPolicyId === pol.id && (
                <div className="px-3 pb-3 border-t pt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Title</Label>
                      <Input value={pol.title} onChange={e => setForm(p => ({ ...p, policies: p.policies.map(pl => pl.id === pol.id ? { ...pl, title: e.target.value } : pl) }))} className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Version</Label>
                      <Input value={pol.version} onChange={e => setForm(p => ({ ...p, policies: p.policies.map(pl => pl.id === pol.id ? { ...pl, version: e.target.value } : pl) }))} className="text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Content</Label>
                    <Textarea value={pol.content} onChange={e => setForm(p => ({ ...p, policies: p.policies.map(pl => pl.id === pol.id ? { ...pl, content: e.target.value } : pl) }))} rows={12} className="text-xs font-mono" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name} data-testid="button-save-template">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {editingId ? "Save Template" : "Create Template"}
          </Button>
          <Button variant="outline" onClick={() => { setCreating(false); setEditingId(null); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={openCreate} data-testid="button-new-template">
          <Plus className="w-4 h-4 mr-1" />New Template
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No templates yet. Create your first template to start sending hiring packages.</p>
          <Button size="sm" className="mt-3" onClick={openCreate}>Create Default Template</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    {t.isDefault && <Badge className="bg-blue-100 text-blue-700 text-xs border-0">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{(t.policies || []).length} policies · Boot reimb: ${t.bootReimbursementAmount}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)} data-testid={`button-edit-template-${t.id}`}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => setDeleteId(t.id)} data-testid={`button-delete-template-${t.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the template. Existing sent packages are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Create Package Tab ─────────────────────────────────────────────────────────
function CreatePackageTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeName: "", employeeEmail: "", position: "", templateId: "" });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-hiring/templates"],
    queryFn: () => apiRequest("GET", "/api/employee-hiring/templates").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/employee-hiring/packages", data).then(r => r.json()),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/packages"] });
      const link = `${window.location.origin}/public/employee-hiring/${created.publicToken}`;
      toast({ title: "Package created!", description: "Copy the link to share with the applicant." });
      setForm({ employeeName: "", employeeEmail: "", position: "", templateId: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">Create a new hiring package to send to an applicant. They will receive a secure link to complete their application.</p>
      <div className="space-y-1">
        <Label>Applicant Name <span className="text-red-500">*</span></Label>
        <Input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))} placeholder="Jane Smith" data-testid="input-applicant-name" />
      </div>
      <div className="space-y-1">
        <Label>Applicant Email <span className="text-red-500">*</span></Label>
        <Input type="email" value={form.employeeEmail} onChange={e => setForm(p => ({ ...p, employeeEmail: e.target.value }))} placeholder="jane@example.com" data-testid="input-applicant-email" />
      </div>
      <div className="space-y-1">
        <Label>Position / Job Title</Label>
        <Input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="Cleaning Technician" data-testid="input-position" />
      </div>
      <div className="space-y-1">
        <Label>Template</Label>
        <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.templateId} onChange={e => setForm(p => ({ ...p, templateId: e.target.value }))} data-testid="select-template">
          <option value="">Use default template</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.employeeName || !form.employeeEmail} data-testid="button-create-package">
        {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
        Create Hiring Package
      </Button>
    </div>
  );
}

// ── Packages List Tab ──────────────────────────────────────────────────────────
function PackagesTab({ filterStatuses, title }: { filterStatuses?: string[]; title: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: packages = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/employee-hiring/packages"],
    queryFn: () => apiRequest("GET", "/api/employee-hiring/packages").then(r => r.json()),
  });
  const { data: submissions = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-hiring/submissions"],
    queryFn: () => apiRequest("GET", "/api/employee-hiring/submissions").then(r => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/employee-hiring/packages/${id}/send`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/packages"] });
      toast({ title: "Email sent successfully" });
      setSendingId(null);
    },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); setSendingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employee-hiring/packages/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employee-hiring/packages"] }); setDeleteId(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = filterStatuses
    ? packages.filter(p => filterStatuses.includes(p.status))
    : packages;

  const getSubmission = (pkg: any) => submissions.find((s: any) => s.packageId === pkg.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} package{filtered.length !== 1 ? "s" : ""}</p>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No packages in {title.toLowerCase()} yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pkg => {
            const sub = getSubmission(pkg);
            const displayStatus = sub?.reviewStatus || pkg.status;
            const link = `${window.location.origin}/public/employee-hiring/${pkg.publicToken}`;
            return (
              <Card key={pkg.id} className="hover:shadow-sm transition-shadow" data-testid={`card-package-${pkg.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{pkg.employeeName}</span>
                        <StatusBadge status={displayStatus} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{pkg.employeeEmail}{pkg.position ? ` · ${pkg.position}` : ""}</p>
                      {pkg.sentAt && <p className="text-xs text-muted-foreground">Sent: {new Date(pkg.sentAt).toLocaleDateString()}</p>}
                      {sub && (
                        <p className="text-xs text-muted-foreground">
                          {sub.personalInfoJson ? "✓ Info " : ""}
                          {sub.signatureData ? "✓ Signed " : ""}
                          {sub.submittedAt ? `· Submitted ${new Date(sub.submittedAt).toLocaleDateString()}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {sub && (
                        <Button size="sm" variant="outline" onClick={() => setReviewId(sub.id)} data-testid={`button-review-${pkg.id}`}>
                          <Eye className="w-3.5 h-3.5 mr-1" />Review
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline"
                        onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Link copied" }); }}
                        data-testid={`button-copy-link-${pkg.id}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => { setSendingId(pkg.id); sendMutation.mutate(pkg.id); }}
                        disabled={sendMutation.isPending && sendingId === pkg.id}
                        data-testid={`button-send-${pkg.id}`}
                      >
                        {sendMutation.isPending && sendingId === pkg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="text-red-600 border-red-200"
                        onClick={() => setDeleteId(pkg.id)}
                        data-testid={`button-delete-pkg-${pkg.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <Dialog open={!!reviewId} onOpenChange={o => !o && setReviewId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Application Review</DialogTitle>
          </DialogHeader>
          {reviewId && <ReviewModal submissionId={reviewId} onClose={() => setReviewId(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this hiring package and all associated data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminEmployeeHiring() {
  const tabs = [
    { id: "sent",      label: "Sent Packages",          statuses: ["draft","sent","viewed","started","in_progress"] },
    { id: "submitted", label: "Submitted Applications", statuses: ["submitted","under_review","missing_documents"] },
    { id: "approved",  label: "Approved / Hired",       statuses: ["approved_hired"] },
    { id: "archived",  label: "Archived",               statuses: ["archived","not_approved","fired_inactive"] },
  ];

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "sent");

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Hiring Package
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Send secure hiring packages to applicants and track their progress.</p>
          </div>
        </div>

        <div className="flex gap-1 border-b pb-0 -mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === "templates" ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-templates"
          >
            <FileText className="w-4 h-4" />Templates
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === "create" ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-create-package"
          >
            <Plus className="w-4 h-4" />Create Package
          </button>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="pt-6">
          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "create" && <CreatePackageTab />}
          {tabs.map(t => activeTab === t.id && (
            <PackagesTab key={t.id} filterStatuses={t.statuses} title={t.label} />
          ))}
        </div>
      </div>
    </div>
  );
}
