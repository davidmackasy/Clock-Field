import { useState, useEffect } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Send, Copy, CheckCircle2, Clock, XCircle, Archive,
  Loader2, Eye, AlertCircle, UserPlus, Briefcase, FileText,
  CheckCheck, Pencil, Trash2, Download, User, Phone,
  Shield, ChevronDown, ChevronUp, X, Users,
  RotateCcw, Copy as CopyIcon, Settings,
} from "lucide-react";

// ── Default Policy Content ──────────────────────────────────────────────────────
const DEFAULT_POLICIES: any[] = [
  {
    id: "rules_of_conduct",
    title: "Rules of Conduct / Conditions of Employment",
    version: "1.0",
    required: true,
    acceptanceStatement: "I acknowledge that I have read and understood the Rules of Conduct / Conditions of Employment. I understand that failure to follow these rules may result in disciplinary action, up to and including termination of employment.",
    lastEdited: new Date().toISOString(),
    content: `OBJECTIVE
This policy explains the required standards of conduct for all employees of [Company Name]. These rules are intended to protect employees, clients, company property, workplace safety, service quality, and the professional reputation of [Company Name].

SCOPE
This policy applies to all employees, contractors, and workers while working for [Company Name], reporting to a client site, using company property, wearing company uniform, communicating with clients, or representing the company in any way.

POLICY
The following actions may result in disciplinary action, up to and including termination of employment:

1. Falsification of personal information supplied to the company.
2. Using incorrect or misleading personal information.
3. Damaging company property, client property, or another employee's property.
4. Smoking in unauthorized areas.
5. Smoking where the client does not allow smoking.
6. Being impaired while at work, whether through alcohol, drugs, medication misuse, or any other substance.
7. Using profane, threatening, or abusive language.
8. Opening desks, cabinets, lockers, refrigerators, files, storage areas, or client property without authorization.
9. Threatening clients, coworkers, supervisors, or members of the public.
10. Using company property, client property, telephones, computers, tools, vehicles, or equipment without permission.
11. Removing anything from a workplace or client site without permission, regardless of value.
12. Theft or attempted theft.
13. Willful property damage.
14. Failure to report damage or breakage of client or company property.
15. Leaving assigned work areas without authorization.
16. Entering unauthorized client areas.
17. Allowing an unauthorized person to enter a workplace or client site.
18. Fighting or physical confrontation.
19. Harassment, bullying, discrimination, or unsuitable conduct.
20. Insubordination or refusing to follow lawful instructions.
21. Bringing personal belongings into client areas without authorization.
22. Leaving the assigned work area before completing the shift.
23. Unauthorized use of client washrooms, facilities, supplies, or equipment.
24. Working outside assigned hours without approval.
25. Signing in or out for another employee.
26. Allowing another employee to sign in or out for you.
27. Failing to sign in or out as required.
28. Recording time other than the exact time worked.
29. Refusing to cooperate with company procedures, client requirements, investigations, or safety rules.
30. Any action that negatively affects the trust, reputation, business relationship, or professional image of [Company Name].

ATTENDANCE AND PAYROLL
Employees must work only approved schedules unless otherwise authorized.
Employees must report hours honestly.
Employees must follow the company's clock-in and clock-out process.
Payments are based on approved time records, assigned schedules, and company payroll procedures.
Any change in accommodation, contact information, banking information, or employment-related information must be reported to management as soon as possible.`,
  },
  {
    id: "code_of_ethics",
    title: "Code of Ethics",
    version: "1.0",
    required: true,
    acceptanceStatement: "I acknowledge that I have read and understood the Code of Ethics. I agree to follow the ethical standards expected by [Company Name].",
    lastEdited: new Date().toISOString(),
    content: `OBJECTIVE
[Company Name] is committed to strong values, professional conduct, honesty, respect, and responsible business practices. Employees are expected to follow these principles while working with coworkers, clients, management, and the public.

PERSONAL RESPECT
Employees must respect all individuals regardless of origin, beliefs, age, race, gender, background, disability, or any protected characteristic. Discrimination, harassment, bullying, or disrespectful behaviour is not accepted.

RESPECT FOR CUSTOMERS
Clients are a priority. Employees must be honest, efficient, courteous, and professional when serving clients. Employees must protect client property, follow client site rules, and represent [Company Name] respectfully.

RESPECT FOR SOCIETY
Employees must be honest and professional in dealings with institutions, authorities, clients, coworkers, and the public.

RESPECT FOR THE ENVIRONMENT
Employees must follow environmental rules, waste disposal requirements, chemical handling procedures, and client-specific environmental instructions. Employees must not pollute or misuse products in a way that could harm people, property, or the environment.

RESPECT FOR THE COMPANY AND ITS INTERESTS
Employees must be honest and loyal to [Company Name]. Employees must protect company property, company reputation, company information, client information, and confidential business processes.

HONESTY AND RESPONSIBILITY
Employees must be honest in all work reports, time records, client communications, safety reports, incident reports, and company documents.

COMPLIANCE WITH THE LAW
Employees must follow all applicable laws and regulations while working for [Company Name].

COMPLIANCE WITH BUSINESS STANDARDS
Employees must not participate in practices that could harm the company, clients, coworkers, the public, or the trust placed in the company.

COMPLIANCE WITH COMPANY POLICIES AND PROCEDURES
Employees must follow all company policies, procedures, training instructions, safety rules, client instructions, and management directions.

REPORTING CONCERNS
If an employee believes there has been a violation of this Code of Ethics, they should report the concern to:
[Manager Name]
[Manager Email]
[Manager Phone]`,
  },
  {
    id: "dress_code",
    title: "Dress Code and Personal Hygiene Policy",
    version: "1.0",
    required: true,
    acceptanceStatement: "I acknowledge that I have read and understood the Dress Code and Personal Hygiene Policy. I agree to follow this policy while representing [Company Name].",
    lastEdited: new Date().toISOString(),
    content: `OBJECTIVE
[Company Name] requires employees to present themselves professionally and safely while working. Dress, hygiene, grooming, and uniform standards help maintain client trust, employee safety, and a professional company image.

SCOPE
This policy applies to all employees while working for [Company Name], attending a client location, wearing company uniform, or representing the company.

UNIFORM AND CLOTHING EXPECTATIONS
Employees must wear issued uniforms while on duty if uniforms are provided.
Uniforms must be worn for work-related purposes only.
Uniform items may be considered company property.
Employees are responsible for keeping uniforms clean and in good condition.
Lost, stolen, or damaged uniforms must be reported.
Uniforms damaged through normal wear and tear may be replaced based on company policy.
Uniforms should be worn only during working hours and should not be worn in places that may negatively affect the company image.
Footwear must be safe, clean, and suitable for the worksite.

HYGIENE REQUIREMENTS
Employees must maintain clean and appropriate personal hygiene during working hours.
Employees should avoid heavy perfumes, colognes, or strongly scented lotions where these may affect clients, coworkers, or people with allergies or sensitivities.
Employees must wash hands after eating, using the restroom, handling garbage, or completing tasks where hygiene is required.

PERSONAL GROOMING
Clothing must be clean, pressed, and in good condition.
Clothing must fit appropriately.
Clothing must not interfere with safe operation of equipment.
Dark glasses should not be worn unless required for medical or safety reasons.
Jewelry must not create a safety hazard.
Long or dangling jewelry should be avoided when it may interfere with work.

INAPPROPRIATE ATTIRE
The following items are not permitted during working hours unless specifically approved:
Sweatpants.
Jogging pants.
Bicycle shorts.
Athletic shorts.
Tank tops.
Crop tops.
Midriff clothing.
Ripped or unprofessional clothing.
Flip-flops.
Sandals.
Beach footwear.
Pins, buttons, patches, or clothing with offensive wording or images.
Any clothing that creates a safety concern or does not meet client site expectations.`,
  },
  {
    id: "safety_boots",
    title: "Safety Boots Reimbursement Policy",
    version: "1.0",
    required: true,
    acceptanceStatement: "I acknowledge that I have read and understood the Safety Boots Reimbursement Policy. I agree to follow the requirements for safety footwear and reimbursement.",
    lastEdited: new Date().toISOString(),
    content: `OBJECTIVE
Employees may be required to wear CSA-approved safety boots during assigned work duties. This policy explains the eligibility, reimbursement process, expectations, and responsibilities related to safety boots.

SCOPE
This policy applies to employees who are required by [Company Name], the client, or the worksite to wear CSA-approved safety boots.

GUIDELINES
Employees required to wear CSA-approved safety boots may be eligible for reimbursement.
Default reimbursement amount: $60.00.
Employees must submit an itemized original receipt for CSA-approved safety boots.
Employees may be required to present the safety boots to verify they are CSA-approved and acceptable for workplace use.
Receipts and required documents must be submitted within the required company timeframe.
If approved, reimbursement may be processed through payroll.
Reimbursement may depend on approval from [Company Name].
If employment ends before the required employment period, the allowance may be adjusted, withheld, or forfeited based on company policy.
During extended leave, such as maternity leave, parental leave, extended sick leave, or other approved leave, reimbursement payment may be suspended until the employee returns to work.

RESPONSIBILITIES
Employees are responsible for maintaining safety boots in good repair and safe working condition.
Employees are responsible for wearing required safety footwear when assigned.
Employees must not report to a worksite without required safety footwear where safety boots are required.`,
  },
  {
    id: "substance_abuse",
    title: "Substance Abuse Policy / Suspicion of Impairment",
    version: "1.0",
    required: true,
    acceptanceStatement: "I acknowledge that I have read and understood the Substance Abuse Policy / Suspicion of Impairment. I agree to follow this policy and understand that failure to comply may result in disciplinary action, up to and including termination of employment.",
    lastEdited: new Date().toISOString(),
    content: `OBJECTIVE
[Company Name] is committed to maintaining a safe, professional, and substance-free workplace. Employees must not report to work impaired by alcohol, drugs, medication misuse, or any substance that may affect safe and professional work performance.

SCOPE
This policy applies to all employees while working, reporting to work, on client property, using company property, driving for work, on breaks during work hours, or representing [Company Name].

ZERO TOLERANCE
[Company Name] uses a zero-tolerance approach to alcohol and drug use in the workplace where safety, client trust, work quality, or professional conduct may be affected.

DEFINITIONS
Impaired: A changed physical or mental state caused by alcohol, drugs, medication misuse, or any substance that may affect safe work, judgment, conduct, or performance.
Substance Abuse: The use of alcohol, drugs, medication, or other substances in a way that interferes with work duties, safety, attendance, or workplace behaviour.
Alcohol: Includes intoxicating substances in drinks or products.
Drugs: Includes illegal drugs, controlled substances, cannabis, medication used improperly, and any substance that may affect performance, safety, or judgment.
Cannabis: Includes any substance containing THC, including dried leaves, oils, capsules, food products, candies, vape cartridges, creams, rubs, or similar products.
Illegal Drugs: Any drug or substance where use, sale, possession, purchase, distribution, or exchange is restricted or prohibited by applicable law.

EMPLOYEE RESPONSIBILITIES
Employees must report to work fit for duty.
Employees must follow this policy during all working hours.
Employees must perform work safely during all periods worked.
Employees must communicate any work restrictions, safety concerns, or medication-related limitations where appropriate.
Employees must report any object, condition, or situation that creates a risk to their health, safety, or the safety of others.
Employees must notify management if they believe another employee is impaired and may create a workplace or public safety risk.
Employees must not use, consume, possess, distribute, purchase, or sell alcohol or drugs on company property, client property, or during working hours.
Employees must not consume alcohol or drugs during paid or unpaid breaks.
Employees must cooperate with reasonable procedures when impairment is suspected.

COMPANY RESPONSIBILITIES
[Company Name] will take reasonable steps to protect employee health, client safety, workplace safety, and company reputation.
[Company Name] will enforce this policy and ensure proper implementation.
[Company Name] may remove an employee from a worksite if impairment is reasonably suspected.
[Company Name] may arrange safe transportation when necessary.
[Company Name] may assist or cooperate with support processes where required by law.

SUSPICION OF IMPAIRMENT PROCEDURE
If an employee is suspected of being under the influence, management may:
Request a second opinion from another manager or supervisor.
Speak privately with the employee.
Observe and document the employee's condition.
Ask questions related to workplace safety and fitness for duty.
Remove the employee from the worksite for safety.
Arrange safe transportation.
Prevent the employee from driving a personal vehicle.
Schedule a meeting for the next working day.
Determine next steps, including support, accommodation, investigation, discipline, or return-to-work requirements.

VOLUNTARY IDENTIFICATION
Employees are encouraged to communicate if they have an addiction or substance-related issue that may affect their work or safety. Employees who seek help may receive appropriate support where required by law. Medical information will be kept confidential except as required for safety, accommodation, or legal reasons.

PRESCRIBED MEDICATION
Employees using prescribed medication must ensure it does not affect their ability to work safely. If medication may affect safety, the employee should communicate work restrictions or safety limitations where appropriate. [Company Name] is not requesting personal medical history. Only safety-related work restrictions or emergency information should be shared where needed.

SIGNS THAT MAY INDICATE IMPAIRMENT
Absenteeism: Unplanned or unauthorized work absence, frequent delays, frequent sick leave, repeated absences especially before or after weekends, holidays, or paydays.
Behaviour At Work: Staggering or unstable movement, eyes injected with blood, smell of alcohol or cannabis, changes in behaviour, avoiding supervision, excessive mood changes, confusion, unusual speech, signs of poor judgment, changes in physical appearance.
Performance Issues: Failure to meet deadlines, neglected work tasks, repeated mistakes, poor judgment, work quality concerns, work completed in an unsafe or careless way.

IMPORTANT NOTE
The presence of one or more signs does not automatically prove impairment. Management must assess the situation fairly and consistently. If there is doubt, the company may investigate further.

DISCIPLINARY MEASURES
Employees who do not comply with this policy may face disciplinary action, up to and including termination of employment, depending on the seriousness of the situation.`,
  },
  {
    id: "emergency_contact_privacy",
    title: "Emergency Contact and Medical Information Privacy Notice",
    version: "1.0",
    required: true,
    acceptanceStatement: "I have read and understood this confidentiality notice regarding my emergency contact and medical information.",
    lastEdited: new Date().toISOString(),
    content: `PRIVACY NOTICE
The information you provide in the Emergency Contact and Medical Information section will be held in the strictest confidence and will only be shared on a need-to-know basis with authorized company personnel.

This form is not intended to request or investigate your personal medical history. The information is collected only to help respond to an emergency, allergy, sensitivity, safety concern, or medical situation that may occur at work.

All information is stored securely and access is limited to authorized personnel only.

This section collects:
- Employee name, address, and phone number
- Up to two emergency contacts (name, relationship, phone number, optional email)
- Optional medical information: allergies, sensitivities, special medication, or any emergency safety notes you wish to share

You are not required to provide medical information. Only provide what you are comfortable sharing. The company will use this information solely to respond appropriately in the event of an emergency at or related to the workplace.`,
  },
  {
    id: "final_acknowledgement",
    title: "Final Employee Acknowledgement",
    version: "1.0",
    required: true,
    acceptanceStatement: "By accepting this policy, I confirm that I have reviewed and agreed to all terms in this hiring package and that all information I have provided is accurate and complete.",
    lastEdited: new Date().toISOString(),
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
  draft:             { label: "Draft",              color: "bg-gray-100 text-gray-600" },
  sent:              { label: "Sent",               color: "bg-blue-100 text-blue-700" },
  viewed:            { label: "Viewed",             color: "bg-amber-100 text-amber-700" },
  started:           { label: "Started",            color: "bg-purple-100 text-purple-700" },
  in_progress:       { label: "In Progress",        color: "bg-purple-100 text-purple-700" },
  submitted:         { label: "Submitted",          color: "bg-yellow-100 text-yellow-800" },
  under_review:      { label: "Under Review",       color: "bg-yellow-100 text-yellow-800" },
  missing_documents: { label: "Missing Documents",  color: "bg-orange-100 text-orange-800" },
  approved_hired:    { label: "Approved / Hired",   color: "bg-green-100 text-green-700" },
  not_approved:      { label: "Not Approved",       color: "bg-red-100 text-red-700" },
  fired_inactive:    { label: "Fired / Inactive",   color: "bg-gray-200 text-gray-600" },
  archived:          { label: "Archived",           color: "bg-gray-100 text-gray-500" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status, color: "bg-gray-100 text-gray-600" };
  return <Badge className={`text-xs font-medium ${m.color} border-0`}>{m.label}</Badge>;
}

// ── Review Modal ───────────────────────────────────────────────────────────────
function ReviewModal({ submissionId, onClose }: { submissionId: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [adminNotes, setAdminNotes] = useState("");
  const [missingMsg, setMissingMsg] = useState("");
  const [missingDocs, setMissingDocs] = useState<string[]>([]);
  const [showMissingForm, setShowMissingForm] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

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

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const a = document.createElement("a");
      a.href = `/api/employee-hiring/submissions/${submissionId}/download-pdf`;
      a.download = "completed-hiring-package.pdf";
      a.click();
    } finally {
      setTimeout(() => setDownloadingPdf(false), 2000);
    }
  };

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const a = document.createElement("a");
      a.href = `/api/employee-hiring/submissions/${submissionId}/download-zip`;
      a.download = "hiring-documents.zip";
      a.click();
    } finally {
      setTimeout(() => setDownloadingZip(false), 2000);
    }
  };

  if (isLoading) return (
    <div className="space-y-3 py-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );

  const { submission, policies, documents, pkg } = data || {};
  const personalInfo = submission?.personalInfoJson || {};
  const emergency = submission?.emergencyContactsJson || {};
  const medical = submission?.medicalInfoJson || {};
  const publicLink = pkg ? `${window.location.origin}/public/employee-hiring/${pkg.publicToken}` : "";

  return (
    <div className="space-y-5 py-2 max-h-[75vh] overflow-y-auto pr-1">
      {/* Header + Quick Actions */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{pkg?.employeeName || "Applicant"}</h3>
          <p className="text-sm text-muted-foreground">{pkg?.employeeEmail}{pkg?.position ? ` · ${pkg.position}` : ""}</p>
          {submission?.submittedAt && <p className="text-xs text-muted-foreground mt-0.5">Submitted: {new Date(submission.submittedAt).toLocaleString()}</p>}
        </div>
        <StatusBadge status={submission?.reviewStatus || submission?.status || "started"} />
      </div>

      {/* Download + Action Bar */}
      <div className="flex flex-wrap gap-2 pb-3 border-b">
        <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf} data-testid="button-download-pdf">
          {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
          Completed PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadZip} disabled={downloadingZip || !documents?.length} data-testid="button-download-zip">
          {downloadingZip ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
          All Docs ZIP
        </Button>
        {publicLink && (
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicLink); toast({ title: "Link copied" }); }} data-testid="button-copy-public-link">
            <Copy className="w-3.5 h-3.5 mr-1" />Copy Link
          </Button>
        )}
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

      {/* Medical Info */}
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
          <h4 className="font-medium text-sm flex items-center gap-2"><CheckCheck className="w-4 h-4" />Accepted Policies ({policies?.length || 0})</h4>
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
                  <Button size="sm" variant="outline" onClick={() => { const a = document.createElement("a"); a.href = `/api/employee-hiring/documents/${doc.id}/download`; a.download = doc.originalName; a.click(); }} data-testid={`button-download-${dt}`}>
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
        <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes about this applicant..." rows={3} data-testid="textarea-admin-notes" />
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
                  <input type="checkbox" checked={missingDocs.includes(dt)} onChange={e => setMissingDocs(prev => e.target.checked ? [...prev, dt] : prev.filter(x => x !== dt))} />
                  {DOC_LABELS[dt]}
                </label>
              ))}
            </div>
            <Textarea value={missingMsg} onChange={e => setMissingMsg(e.target.value)} placeholder="Message to applicant about what is missing..." rows={2} data-testid="textarea-missing-message" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => statusMutation.mutate({ reviewStatus: "missing_documents", missingDocsMessage: missingMsg, requestedMissingDocs: missingDocs })} disabled={statusMutation.isPending || missingDocs.length === 0}>Send Request</Button>
              <Button size="sm" variant="outline" onClick={() => setShowMissingForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Decision Buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowApproveModal(true)} disabled={statusMutation.isPending} data-testid="button-approve-hired">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve / Hired
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowMissingForm(v => !v)} disabled={statusMutation.isPending} data-testid="button-request-missing">
          <AlertCircle className="w-3.5 h-3.5 mr-1" />Missing Docs
        </Button>
        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => statusMutation.mutate({ reviewStatus: "not_approved" })} disabled={statusMutation.isPending} data-testid="button-not-approved">
          <XCircle className="w-3.5 h-3.5 mr-1" />Not Approved
        </Button>
        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ reviewStatus: "under_review" })} disabled={statusMutation.isPending}>
          <Clock className="w-3.5 h-3.5 mr-1" />Under Review
        </Button>
        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ reviewStatus: "archived" })} disabled={statusMutation.isPending} data-testid="button-archive">
          <Archive className="w-3.5 h-3.5 mr-1" />Archive
        </Button>
        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ reviewStatus: "fired_inactive" })} disabled={statusMutation.isPending}>
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
              <Button size="sm" onClick={() => statusMutation.mutate({ reviewStatus: "approved_hired" })} disabled={statusMutation.isPending}>Approve Only</Button>
              <Button size="sm" variant="outline" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Policies Tab ───────────────────────────────────────────────────────────────
function PoliciesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [policies, setPolicies] = useState<any[]>(DEFAULT_POLICIES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/employee-hiring/templates"],
    queryFn: () => apiRequest("GET", "/api/employee-hiring/templates").then(r => r.json()),
  });

  useEffect(() => {
    if (!templates.length) return;
    const def = (templates as any[]).find((t: any) => t.isDefault) || templates[0];
    if (def) {
      setDefaultTemplateId(def.id);
      if (def.policies?.length) setPolicies(def.policies);
    }
  }, [templates]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updatedPolicies = policies.map((p, i) => ({ ...p, order: i + 1, lastEdited: p.lastEdited || now }));
      if (defaultTemplateId) {
        await apiRequest("PATCH", `/api/employee-hiring/templates/${defaultTemplateId}`, { policies: updatedPolicies });
      } else {
        const res = await apiRequest("POST", "/api/employee-hiring/templates", {
          name: "Default Template",
          policies: updatedPolicies,
          bootReimbursementAmount: "60.00",
          requireDateOfBirth: false,
          isDefault: true,
        }).then(r => r.json());
        setDefaultTemplateId(res.id);
      }
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/templates"] });
      toast({ title: "Policies saved successfully" });
      setPolicies(updatedPolicies);
    } catch (e: any) {
      toast({ title: "Error saving policies", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updatePolicy = (id: string, updates: any) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, ...updates, lastEdited: new Date().toISOString() } : p));
  };

  const addPolicy = () => {
    const newId = `custom_${Date.now()}`;
    const newPol = { id: newId, title: "New Policy", version: "1.0", required: true, content: "", acceptanceStatement: "I acknowledge that I have read and understood this policy.", lastEdited: new Date().toISOString() };
    setPolicies(prev => [...prev, newPol]);
    setEditingId(newId);
  };

  const duplicatePolicy = (pol: any) => {
    const newId = `${pol.id}_copy_${Date.now()}`;
    const copy = { ...pol, id: newId, title: `${pol.title} (Copy)`, lastEdited: new Date().toISOString() };
    setPolicies(prev => {
      const idx = prev.findIndex(p => p.id === pol.id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const removePolicy = (id: string) => {
    setPolicies(prev => prev.filter(p => p.id !== id));
    setDeleteConfirmId(null);
    if (editingId === id) setEditingId(null);
  };

  const movePolicy = (id: string, dir: -1 | 1) => {
    setPolicies(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx + dir < 0 || idx + dir >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
      return next;
    });
  };

  const previewPolicy = policies.find(p => p.id === previewId);
  const editingPolicy = policies.find(p => p.id === editingId);

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{policies.length} polic{policies.length !== 1 ? "ies" : "y"} · Editing the default template</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)} data-testid="button-restore-defaults">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Restore Defaults
          </Button>
          <Button size="sm" variant="outline" onClick={addPolicy} data-testid="button-add-policy">
            <Plus className="w-3.5 h-3.5 mr-1" />Add Policy
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-policies">
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Save Policies
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {policies.map((pol, idx) => (
          <div key={pol.id} className="border rounded-lg bg-white">
            <div className="flex items-center gap-2 p-3">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => movePolicy(pol.id, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5" aria-label="Move up">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => movePolicy(pol.id, 1)} disabled={idx === policies.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5" aria-label="Move down">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 w-5">{idx + 1}.</span>
                  <span className="font-medium text-sm truncate">{pol.title}</span>
                  <Badge className={`text-xs border-0 shrink-0 ${pol.required !== false ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                    {pol.required !== false ? "Required" : "Optional"}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">v{pol.version || "1.0"}</span>
                </div>
                {pol.lastEdited && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5">Last edited: {new Date(pol.lastEdited).toLocaleDateString()}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setPreviewId(previewId === pol.id ? null : pol.id)} data-testid={`button-preview-policy-${pol.id}`}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => duplicatePolicy(pol)} data-testid={`button-duplicate-policy-${pol.id}`}>
                  <CopyIcon className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(editingId === pol.id ? null : pol.id)} data-testid={`button-edit-policy-${pol.id}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setDeleteConfirmId(pol.id)} data-testid={`button-delete-policy-${pol.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Edit Panel */}
            {editingId === pol.id && (
              <div className="px-4 pb-4 border-t pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Policy Title</Label>
                    <Input value={pol.title} onChange={e => updatePolicy(pol.id, { title: e.target.value })} className="text-sm" data-testid={`input-policy-title-${pol.id}`} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Version</Label>
                    <Input value={pol.version || "1.0"} onChange={e => updatePolicy(pol.id, { version: e.target.value })} className="text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={pol.required !== false} onCheckedChange={v => updatePolicy(pol.id, { required: v })} data-testid={`switch-required-${pol.id}`} />
                    Required policy
                  </label>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Policy Content</Label>
                  <Textarea
                    value={pol.content}
                    onChange={e => updatePolicy(pol.id, { content: e.target.value })}
                    rows={14}
                    className="text-xs font-mono"
                    placeholder="Enter full policy text here..."
                    data-testid={`textarea-policy-content-${pol.id}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Acceptance Statement (shown to applicant)</Label>
                  <Textarea
                    value={pol.acceptanceStatement || ""}
                    onChange={e => updatePolicy(pol.id, { acceptanceStatement: e.target.value })}
                    rows={2}
                    className="text-xs"
                    placeholder="I acknowledge that I have read and understood this policy..."
                    data-testid={`textarea-acceptance-${pol.id}`}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Done Editing
                </Button>
              </div>
            )}

            {/* Preview Panel */}
            {previewId === pol.id && editingId !== pol.id && (
              <div className="px-4 pb-4 border-t pt-3 space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Preview (as applicant sees it)</p>
                <div className="border rounded bg-white p-4 text-sm max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {pol.content || <span className="text-muted-foreground italic">No content yet</span>}
                </div>
                {pol.acceptanceStatement && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-xs text-green-800 font-medium mb-1">Acceptance statement:</p>
                    <p className="text-sm text-green-900">{pol.acceptanceStatement}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {policies.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No policies yet. Add a policy or restore defaults.</p>
          <Button size="sm" className="mt-3" onClick={addPolicy}>Add First Policy</Button>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Button onClick={handleSave} disabled={saving} data-testid="button-save-policies-bottom">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Save All Policies
        </Button>
        <Button variant="outline" onClick={addPolicy}>
          <Plus className="w-4 h-4 mr-1" />Add Policy
        </Button>
      </div>

      {/* Restore Defaults Confirm */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Default Policies?</AlertDialogTitle>
            <AlertDialogDescription>This will reset all policies to the built-in defaults. Your current edits will be lost. This does not affect already-sent packages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setPolicies(DEFAULT_POLICIES); setConfirmReset(false); setEditingId(null); }}>Restore Defaults</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Policy Confirm */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={o => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Policy?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the policy from the list. Already-sent packages are not affected. Click Save to persist this change.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && removePolicy(deleteConfirmId)} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Templates Tab ──────────────────────────────────────────────────────────────
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
  const [form, setForm] = useState({ name: "", bootReimbursementAmount: "60.00", requireDateOfBirth: false, isDefault: false });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editingId
      ? apiRequest("PATCH", `/api/employee-hiring/templates/${editingId}`, data).then(r => r.json())
      : apiRequest("POST", "/api/employee-hiring/templates", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/templates"] });
      toast({ title: editingId ? "Template saved" : "Template created" });
      setEditingId(null); setCreating(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employee-hiring/templates/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employee-hiring/templates"] }); setDeleteId(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (t: any) => {
    setForm({ name: t.name, bootReimbursementAmount: t.bootReimbursementAmount || "60.00", requireDateOfBirth: t.requireDateOfBirth || false, isDefault: t.isDefault || false });
    setEditingId(t.id); setCreating(true);
  };

  const openCreate = () => {
    setForm({ name: "Default Template", bootReimbursementAmount: "60.00", requireDateOfBirth: false, isDefault: (templates as any[]).length === 0 });
    setEditingId(null); setCreating(true);
  };

  if (creating) {
    return (
      <div className="space-y-4 max-w-md">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{editingId ? "Edit Template" : "New Template"}</h3>
          <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setEditingId(null); }}>
            <X className="w-4 h-4 mr-1" />Cancel
          </Button>
        </div>
        <div className="space-y-1">
          <Label>Template Name</Label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} data-testid="input-template-name" />
        </div>
        <div className="space-y-1">
          <Label>Safety Boot Reimbursement Amount ($)</Label>
          <Input value={form.bootReimbursementAmount} onChange={e => setForm(p => ({ ...p, bootReimbursementAmount: e.target.value }))} data-testid="input-boot-amount" />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={form.requireDateOfBirth} onCheckedChange={v => setForm(p => ({ ...p, requireDateOfBirth: v }))} />
            Require Date of Birth
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={form.isDefault} onCheckedChange={v => setForm(p => ({ ...p, isDefault: v }))} />
            Set as Default
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Tip: Edit policy content in the Policies tab. Templates use the current default policies when creating packages.</p>
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
        <p className="text-sm text-muted-foreground">{(templates as any[]).length} template{(templates as any[]).length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={openCreate} data-testid="button-new-template">
          <Plus className="w-4 h-4 mr-1" />New Template
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (templates as any[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No templates yet. Create your first template to start sending hiring packages.</p>
          <Button size="sm" className="mt-3" onClick={openCreate}>Create Default Template</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {(templates as any[]).map((t: any) => (
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
  const [created, setCreated] = useState<any>(null);

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-hiring/templates"],
    queryFn: () => apiRequest("GET", "/api/employee-hiring/templates").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/employee-hiring/packages", data).then(r => r.json()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/employee-hiring/packages"] });
      setCreated(res);
      setForm({ employeeName: "", employeeEmail: "", position: "", templateId: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">Create a new hiring package link for an applicant. They will receive a secure link to complete their application.</p>

      {created && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium text-green-800">Package created!</p>
            <p className="text-xs text-green-700 break-all">{window.location.origin}/public/employee-hiring/{created.publicToken}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/public/employee-hiring/${created.publicToken}`); toast({ title: "Link copied" }); }}>
                <Copy className="w-3.5 h-3.5 mr-1" />Copy Link
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCreated(null)}>Create Another</Button>
            </div>
          </CardContent>
        </Card>
      )}

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
          {(templates as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.employeeName || !form.employeeEmail} data-testid="button-create-package">
        {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
        Create Hiring Package
      </Button>
    </div>
  );
}

// ── Packages / Applications List Tab ──────────────────────────────────────────
function PackagesTab({ filterStatuses, title, isSubmitted }: { filterStatuses?: string[]; title: string; isSubmitted?: boolean }) {
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employee-hiring/packages"] }); toast({ title: "Email sent successfully" }); setSendingId(null); },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); setSendingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employee-hiring/packages/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employee-hiring/packages"] }); setDeleteId(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = filterStatuses
    ? (packages as any[]).filter((p: any) => filterStatuses.includes(p.status))
    : (packages as any[]);

  const getSubmission = (pkg: any) => (submissions as any[]).find((s: any) => s.packageId === pkg.id);

  const countLabel = isSubmitted
    ? `${filtered.length} application${filtered.length !== 1 ? "s" : ""}`
    : `${filtered.length} package${filtered.length !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{countLabel}</p>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No {isSubmitted ? "applications" : "packages"} in {title.toLowerCase()} yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((pkg: any) => {
            const sub = getSubmission(pkg);
            const displayStatus = sub?.reviewStatus || pkg.status;
            const link = `${window.location.origin}/public/employee-hiring/${pkg.publicToken}`;
            const policiesAccepted = sub?.acceptedPoliciesCount || 0;
            const docsUploaded = sub?.documentsCount || 0;
            return (
              <Card key={pkg.id} className="hover:shadow-sm transition-shadow" data-testid={`card-package-${pkg.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{pkg.employeeName}</span>
                        <StatusBadge status={displayStatus} />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <p className="text-xs text-muted-foreground">{pkg.employeeEmail}</p>
                        {pkg.position && <p className="text-xs text-muted-foreground">{pkg.position}</p>}
                        {pkg.sentAt && <p className="text-xs text-muted-foreground">Sent: {new Date(pkg.sentAt).toLocaleDateString()}</p>}
                      </div>
                      {sub && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {sub.personalInfoJson && <span className="text-xs text-green-700">✓ Info</span>}
                          {sub.signatureData && <span className="text-xs text-green-700">✓ Signed</span>}
                          {sub.submittedAt && <span className="text-xs text-muted-foreground">Submitted: {new Date(sub.submittedAt).toLocaleDateString()}</span>}
                          {(sub.emergencyContactsJson) && <span className="text-xs text-green-700">✓ Emergency</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {sub && (
                        <Button size="sm" variant="outline" onClick={() => setReviewId(sub.id)} data-testid={`button-review-${pkg.id}`}>
                          <Eye className="w-3.5 h-3.5 mr-1" />Review
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Link copied" }); }} data-testid={`button-copy-link-${pkg.id}`}>
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
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => setDeleteId(pkg.id)} data-testid={`button-delete-pkg-${pkg.id}`}>
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
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "sent");

  const tabs = [
    { id: "templates",  label: "Templates",              icon: <FileText className="w-4 h-4" /> },
    { id: "policies",   label: "Policies",               icon: <Settings className="w-4 h-4" /> },
    { id: "create",     label: "Create Package",         icon: <Plus className="w-4 h-4" /> },
    { id: "sent",       label: "Sent Packages",          icon: <Send className="w-4 h-4" />,          statuses: ["draft","sent","viewed","started","in_progress"] },
    { id: "submitted",  label: "Submitted Applications", icon: <Users className="w-4 h-4" />,         statuses: ["submitted","under_review","missing_documents"], isSubmitted: true },
    { id: "approved",   label: "Approved / Hired",       icon: <CheckCircle2 className="w-4 h-4" />, statuses: ["approved_hired"] },
    { id: "archived",   label: "Archived",               icon: <Archive className="w-4 h-4" />,       statuses: ["archived","not_approved","fired_inactive"] },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5" />Hiring Package
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Send secure hiring packages to applicants and track their progress.</p>
        </div>

        <div className="flex gap-0 border-b overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid={`tab-${t.id}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="pt-2">
          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "policies" && <PoliciesTab />}
          {activeTab === "create" && <CreatePackageTab />}
          {tabs.filter(t => t.statuses).map(t => activeTab === t.id && (
            <PackagesTab key={t.id} filterStatuses={t.statuses} title={t.label} isSubmitted={t.isSubmitted} />
          ))}
        </div>
      </div>
    </div>
  );
}
