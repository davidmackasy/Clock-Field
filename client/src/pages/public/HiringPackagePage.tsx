import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Loader2, Upload, Trash2,
  FileText, Shield, User, AlertCircle, PenTool, Heart,
} from "lucide-react";

type HPPublicData = {
  package: {
    id: string;
    employeeName: string;
    employeeEmail: string;
    position: string;
    status: string;
    sentAt: string | null;
  };
  submission: {
    id: string;
    currentStep: number;
    status: string;
    personalInfoJson: any;
    emergencyContactsJson: any;
    medicalInfoJson: any;
    finalAcknowledgement: boolean;
    signatureData: string | null;
    submittedAt: string | null;
    lastSavedAt: string | null;
    requestedMissingDocs: string[] | null;
  } | null;
  template: {
    id: string;
    name: string;
    policies: { id: string; title: string; content: string }[];
    bootReimbursementAmount: string;
    requireDateOfBirth: boolean;
  } | null;
  policyAcceptances: { id: string; policyId: string; policyTitle: string; acceptedAt: string }[];
  documents: { id: string; documentType: string; originalName: string; fileSize: number }[];
  companyName: string;
};

const STEPS = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "emergency", label: "Emergency Contacts", icon: Heart },
  { id: "medical", label: "Medical Info", icon: Shield },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "documents", label: "Documents", icon: Upload },
  { id: "signature", label: "Signature", icon: PenTool },
  { id: "review", label: "Review & Submit", icon: CheckCircle2 },
];

const REQUIRED_DOCS = [
  { type: "sin_card", label: "SIN Card or Letter", description: "Social Insurance Number card or official CRA letter" },
  { type: "void_cheque", label: "Void Cheque", description: "For direct deposit setup" },
  { type: "government_id", label: "Government ID", description: "Driver's licence, passport, or provincial ID" },
];

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
      <div
        className="bg-primary h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${((step) / total) * 100}%` }}
      />
    </div>
  );
}

export default function HiringPackagePage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: "", lastName: "", dateOfBirth: "", sinNumber: "",
    phone: "", address: "", city: "", province: "", postalCode: "",
  });
  const [emergencyContacts, setEmergencyContacts] = useState([
    { name: "", relationship: "", phone: "" },
  ]);
  const [medicalInfo, setMedicalInfo] = useState({
    allergies: "", medications: "", conditions: "", otherNotes: "",
  });
  const [acceptedPolicies, setAcceptedPolicies] = useState<Set<string>>(new Set());
  const [finalAck, setFinalAck] = useState(false);

  const { data, isLoading, isError } = useQuery<HPPublicData>({
    queryKey: ["/api/public/hiring-package", token],
    queryFn: () => fetch(`/api/public/hiring-package/${token}`).then(r => {
      if (!r.ok) throw new Error("Package not found or expired");
      return r.json();
    }),
    retry: false,
  });

  useEffect(() => {
    if (data?.submission?.personalInfoJson) {
      setPersonalInfo(data.submission.personalInfoJson);
    }
    if (data?.submission?.emergencyContactsJson && Array.isArray(data.submission.emergencyContactsJson)) {
      setEmergencyContacts(data.submission.emergencyContactsJson);
    }
    if (data?.submission?.medicalInfoJson) {
      setMedicalInfo(data.submission.medicalInfoJson);
    }
    if (data?.policyAcceptances) {
      setAcceptedPolicies(new Set(data.policyAcceptances.map(p => p.policyId)));
    }
    if (data?.submission?.finalAcknowledgement) {
      setFinalAck(data.submission.finalAcknowledgement);
    }
    if (data?.submission?.currentStep) {
      setStep(Math.max(0, data.submission.currentStep - 1));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async ({ endpoint, payload }: { endpoint: string; payload: any }) => {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/public/hiring-package", token] }),
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const acceptPolicyMutation = useMutation({
    mutationFn: async (policy: { id: string; title: string; content: string }) => {
      const res = await fetch(`/api/public/hiring-package/${token}/policy-accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: policy.id,
          policyTitle: policy.title,
          policyContentSnapshot: policy.content,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/public/hiring-package", token] }),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);
      const res = await fetch(`/api/public/hiring-package/${token}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/hiring-package", token] });
      toast({ title: "Document uploaded" });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (documentType: string) => {
      const res = await fetch(`/api/public/hiring-package/${token}/documents/${documentType}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/public/hiring-package", token] }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      const signatureData = canvas ? canvas.toDataURL() : null;
      await saveMutation.mutateAsync({ endpoint: `/api/public/hiring-package/${token}/signature`, payload: { signatureData, finalAcknowledgement: finalAck } });
      const res = await fetch(`/api/public/hiring-package/${token}/submit`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/hiring-package", token] });
      toast({ title: "Submitted!", description: "Your hiring package has been submitted successfully." });
    },
    onError: (e: any) => toast({ title: "Submit failed", description: e.message, variant: "destructive" }),
  });

  // Signature canvas
  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };
  const startDraw = (e: any) => { setIsDrawing(true); setLastPoint(getPos(e)); };
  const draw = (e: any) => {
    if (!isDrawing || !lastPoint) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setLastPoint(pos);
  };
  const endDraw = () => { setIsDrawing(false); setLastPoint(null); };
  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveAndNext = async () => {
    setSaving(true);
    try {
      if (step === 0) {
        await saveMutation.mutateAsync({ endpoint: `/api/public/hiring-package/${token}/personal-info`, payload: { personalInfoJson: personalInfo } });
      } else if (step === 1) {
        await saveMutation.mutateAsync({ endpoint: `/api/public/hiring-package/${token}/emergency-contacts`, payload: { emergencyContactsJson: emergencyContacts } });
      } else if (step === 2) {
        await saveMutation.mutateAsync({ endpoint: `/api/public/hiring-package/${token}/medical-info`, payload: { medicalInfoJson: medicalInfo } });
      }
      setStep(s => s + 1);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">Package Not Found</h1>
        <p className="text-muted-foreground max-w-sm">This hiring package link is invalid or has expired. Please contact your employer for a new link.</p>
      </div>
    );
  }

  const { package: pkg, submission, template, policyAcceptances, documents, companyName } = data;

  if (submission?.status === "submitted") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-center px-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-border p-10 max-w-md">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">All Done!</h1>
          <p className="text-muted-foreground mb-6">Your hiring package has been submitted to <strong>{companyName}</strong>. They will review it and be in touch soon.</p>
          <p className="text-sm text-muted-foreground">Submitted on {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "—"}</p>
        </div>
      </div>
    );
  }

  const policies = template?.policies ?? [];
  const allPoliciesAccepted = policies.every(p => acceptedPolicies.has(p.id));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{companyName}</div>
              <div className="font-semibold text-foreground">Hiring Package — {pkg.employeeName}</div>
            </div>
            <div className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
          </div>
          <ProgressBar step={step + 1} total={STEPS.length} />
          <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${i === step ? "bg-primary text-primary-foreground" : i < step ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {i < step ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  {s.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-border shadow-sm p-6">

          {/* Step 0: Personal Info */}
          {step === 0 && (
            <div className="space-y-4" data-testid="step-personal-info">
              <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
              <p className="text-sm text-muted-foreground">Please provide your personal details accurately.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name <span className="text-destructive">*</span></Label>
                  <Input className="mt-1" value={personalInfo.firstName} onChange={e => setPersonalInfo(p => ({ ...p, firstName: e.target.value }))} data-testid="input-first-name" />
                </div>
                <div>
                  <Label>Last Name <span className="text-destructive">*</span></Label>
                  <Input className="mt-1" value={personalInfo.lastName} onChange={e => setPersonalInfo(p => ({ ...p, lastName: e.target.value }))} data-testid="input-last-name" />
                </div>
                {template?.requireDateOfBirth && (
                  <div>
                    <Label>Date of Birth</Label>
                    <Input className="mt-1" type="date" value={personalInfo.dateOfBirth} onChange={e => setPersonalInfo(p => ({ ...p, dateOfBirth: e.target.value }))} data-testid="input-dob" />
                  </div>
                )}
                <div>
                  <Label>SIN (last 3 digits or full)</Label>
                  <Input className="mt-1" value={personalInfo.sinNumber} onChange={e => setPersonalInfo(p => ({ ...p, sinNumber: e.target.value }))} data-testid="input-sin" />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input className="mt-1" type="tel" value={personalInfo.phone} onChange={e => setPersonalInfo(p => ({ ...p, phone: e.target.value }))} data-testid="input-phone" />
                </div>
                <div className="col-span-2">
                  <Label>Street Address</Label>
                  <Input className="mt-1" value={personalInfo.address} onChange={e => setPersonalInfo(p => ({ ...p, address: e.target.value }))} data-testid="input-address" />
                </div>
                <div>
                  <Label>City</Label>
                  <Input className="mt-1" value={personalInfo.city} onChange={e => setPersonalInfo(p => ({ ...p, city: e.target.value }))} data-testid="input-city" />
                </div>
                <div>
                  <Label>Province</Label>
                  <Input className="mt-1" value={personalInfo.province} onChange={e => setPersonalInfo(p => ({ ...p, province: e.target.value }))} data-testid="input-province" />
                </div>
                <div>
                  <Label>Postal Code</Label>
                  <Input className="mt-1" value={personalInfo.postalCode} onChange={e => setPersonalInfo(p => ({ ...p, postalCode: e.target.value }))} data-testid="input-postal-code" />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Emergency Contacts */}
          {step === 1 && (
            <div className="space-y-4" data-testid="step-emergency-contacts">
              <h2 className="text-lg font-semibold text-foreground">Emergency Contacts</h2>
              <p className="text-sm text-muted-foreground">Provide at least one emergency contact person.</p>
              {emergencyContacts.map((c, i) => (
                <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Contact {i + 1}</span>
                    {i > 0 && (
                      <Button variant="ghost" size="sm" className="text-destructive h-7" onClick={() => setEmergencyContacts(cs => cs.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Full Name <span className="text-destructive">*</span></Label>
                      <Input className="mt-1" value={c.name} onChange={e => setEmergencyContacts(cs => cs.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} data-testid={`input-ec-name-${i}`} />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Input className="mt-1" placeholder="e.g. Spouse, Parent" value={c.relationship} onChange={e => setEmergencyContacts(cs => cs.map((x, idx) => idx === i ? { ...x, relationship: e.target.value } : x))} data-testid={`input-ec-relationship-${i}`} />
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <Input className="mt-1" type="tel" value={c.phone} onChange={e => setEmergencyContacts(cs => cs.map((x, idx) => idx === i ? { ...x, phone: e.target.value } : x))} data-testid={`input-ec-phone-${i}`} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setEmergencyContacts(cs => [...cs, { name: "", relationship: "", phone: "" }])} data-testid="btn-add-contact">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Another Contact
              </Button>
            </div>
          )}

          {/* Step 2: Medical Info */}
          {step === 2 && (
            <div className="space-y-4" data-testid="step-medical-info">
              <h2 className="text-lg font-semibold text-foreground">Medical Information</h2>
              <p className="text-sm text-muted-foreground">This information helps us ensure a safe working environment. All fields are optional.</p>
              <div className="space-y-4">
                <div>
                  <Label>Known Allergies</Label>
                  <Textarea className="mt-1" rows={3} placeholder="List any allergies..." value={medicalInfo.allergies} onChange={e => setMedicalInfo(m => ({ ...m, allergies: e.target.value }))} data-testid="input-allergies" />
                </div>
                <div>
                  <Label>Current Medications</Label>
                  <Textarea className="mt-1" rows={3} placeholder="List any medications..." value={medicalInfo.medications} onChange={e => setMedicalInfo(m => ({ ...m, medications: e.target.value }))} data-testid="input-medications" />
                </div>
                <div>
                  <Label>Medical Conditions</Label>
                  <Textarea className="mt-1" rows={3} placeholder="Any relevant medical conditions..." value={medicalInfo.conditions} onChange={e => setMedicalInfo(m => ({ ...m, conditions: e.target.value }))} data-testid="input-conditions" />
                </div>
                <div>
                  <Label>Other Notes</Label>
                  <Textarea className="mt-1" rows={2} placeholder="Anything else we should know..." value={medicalInfo.otherNotes} onChange={e => setMedicalInfo(m => ({ ...m, otherNotes: e.target.value }))} data-testid="input-medical-notes" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Policies */}
          {step === 3 && (
            <div className="space-y-4" data-testid="step-policies">
              <h2 className="text-lg font-semibold text-foreground">Company Policies</h2>
              <p className="text-sm text-muted-foreground">Please read and accept each company policy below before proceeding.</p>
              {policies.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No policies to review.</div>
              ) : (
                <div className="space-y-4">
                  {policies.map(policy => {
                    const accepted = acceptedPolicies.has(policy.id);
                    return (
                      <div key={policy.id} className={`border rounded-lg overflow-hidden transition-colors ${accepted ? "border-green-400 dark:border-green-600" : "border-border"}`}>
                        <div className={`flex items-center justify-between px-4 py-3 ${accepted ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/30"}`}>
                          <span className="text-sm font-medium text-foreground">{policy.title}</span>
                          {accepted && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        </div>
                        <div className="px-4 py-3 max-h-48 overflow-y-auto">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{policy.content}</p>
                        </div>
                        {!accepted && (
                          <div className="px-4 pb-3 border-t border-border bg-muted/10">
                            <Button
                              size="sm" className="mt-3"
                              onClick={() => {
                                setAcceptedPolicies(s => new Set([...s, policy.id]));
                                acceptPolicyMutation.mutate(policy);
                              }}
                              disabled={acceptPolicyMutation.isPending}
                              data-testid={`btn-accept-policy-${policy.id}`}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> I Accept This Policy
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {!allPoliciesAccepted && policies.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  You must accept all policies to continue.
                </div>
              )}
            </div>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <div className="space-y-4" data-testid="step-documents">
              <h2 className="text-lg font-semibold text-foreground">Document Uploads</h2>
              <p className="text-sm text-muted-foreground">Please upload the following required documents. Accepted formats: PDF, JPG, PNG (max 20MB each).</p>
              <div className="space-y-4">
                {REQUIRED_DOCS.map(doc => {
                  const uploaded = documents.find(d => d.documentType === doc.type);
                  return (
                    <div key={doc.type} className={`border rounded-lg p-4 transition-colors ${uploaded ? "border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10" : "border-border"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-foreground">{doc.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{doc.description}</div>
                        </div>
                        {uploaded ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {uploaded.originalName}
                            </span>
                            <Button
                              variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0"
                              onClick={() => deleteDocMutation.mutate(doc.type)}
                              disabled={deleteDocMutation.isPending}
                              data-testid={`btn-delete-doc-${doc.type}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer" data-testid={`upload-${doc.type}`}>
                            <input
                              type="file"
                              className="sr-only"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) uploadDocMutation.mutate({ file, documentType: doc.type });
                              }}
                            />
                            <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs font-medium hover:bg-muted/50 transition-colors">
                              <Upload className="w-3.5 h-3.5" /> Upload
                            </div>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {template?.bootReimbursementAmount && parseFloat(template.bootReimbursementAmount) > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">
                  Note: You are eligible for a boot reimbursement of <strong>${template.bootReimbursementAmount}</strong>. Please include your receipt with your SIN Card document or send it separately.
                </div>
              )}
            </div>
          )}

          {/* Step 5: Signature */}
          {step === 5 && (
            <div className="space-y-4" data-testid="step-signature">
              <h2 className="text-lg font-semibold text-foreground">Your Signature</h2>
              <p className="text-sm text-muted-foreground">Draw your signature in the box below. This confirms your consent to all information provided.</p>
              <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white dark:bg-gray-950">
                {data.submission?.signatureData && (
                  <img src={data.submission.signatureData} alt="Existing signature" className="w-full max-h-40 object-contain" />
                )}
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={180}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                  data-testid="signature-canvas"
                />
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={clearCanvas} data-testid="btn-clear-signature">Clear</Button>
              </div>
              <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
                <Checkbox
                  id="final-ack"
                  checked={finalAck}
                  onCheckedChange={v => setFinalAck(!!v)}
                  data-testid="checkbox-final-ack"
                />
                <label htmlFor="final-ack" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  I confirm that all information provided in this hiring package is accurate and complete. I agree to the company policies and consent to the use of this digital signature.
                </label>
              </div>
            </div>
          )}

          {/* Step 6: Review & Submit */}
          {step === 6 && (
            <div className="space-y-4" data-testid="step-review">
              <h2 className="text-lg font-semibold text-foreground">Review & Submit</h2>
              <p className="text-sm text-muted-foreground">Please review your information before final submission. Once submitted, your employer will be notified.</p>

              <div className="space-y-3">
                {[
                  { label: "Personal Information", complete: !!(personalInfo.firstName && personalInfo.lastName), icon: User },
                  { label: "Emergency Contacts", complete: emergencyContacts.some(c => c.name.trim()), icon: Heart },
                  { label: "Medical Information", complete: true, icon: Shield },
                  { label: "Policy Acceptances", complete: allPoliciesAccepted || policies.length === 0, icon: FileText },
                  { label: "Documents", complete: documents.length >= REQUIRED_DOCS.length, icon: Upload },
                  { label: "Signature", complete: finalAck, icon: PenTool },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.complete ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                        <Icon className={`w-4 h-4 ${item.complete ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`} />
                      </div>
                      <span className="text-sm font-medium text-foreground flex-1">{item.label}</span>
                      {item.complete
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <AlertCircle className="w-4 h-4 text-amber-500" />}
                    </div>
                  );
                })}
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !finalAck || !personalInfo.firstName}
                data-testid="btn-submit-package">
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Submit Hiring Package
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline" size="sm"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            data-testid="btn-prev-step">
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          {step < STEPS.length - 1 && (
            <Button
              size="sm"
              onClick={saveAndNext}
              disabled={saving || (step === 3 && !allPoliciesAccepted && policies.length > 0)}
              data-testid="btn-next-step">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
