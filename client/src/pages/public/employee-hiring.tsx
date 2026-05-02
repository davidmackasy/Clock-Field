import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Lock, Unlock, Upload, X, FileText, Pen, Check, ArrowRight, ArrowLeft,
  Shield, User, Phone, Clock, Eye,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Policies" },
  { id: 2, label: "Personal Info" },
  { id: 3, label: "Emergency Contacts" },
  { id: 4, label: "Medical Info" },
  { id: 5, label: "Documents" },
  { id: 6, label: "Signature" },
  { id: 7, label: "Status" },
];

const DOC_CONFIG = [
  { key: "government_id_front",    label: "Government ID (Front)",        required: true,  accept: ".jpg,.jpeg,.png,.pdf", hint: "JPG, PNG, or PDF" },
  { key: "government_id_back",     label: "Government ID (Back)",         required: true,  accept: ".jpg,.jpeg,.png,.pdf", hint: "JPG, PNG, or PDF" },
  { key: "resume_cv",              label: "Resume / CV",                  required: true,  accept: ".pdf,.doc,.docx",      hint: "PDF, DOC, or DOCX" },
  { key: "work_permit",            label: "Work Permit",                  required: false, accept: ".jpg,.jpeg,.png,.pdf,.doc,.docx", hint: "Optional" },
  { key: "certificate_license",    label: "Certificate / Licence",        required: false, accept: ".jpg,.jpeg,.png,.pdf", hint: "Optional" },
  { key: "other_supporting_document", label: "Other Supporting Document", required: false, accept: ".jpg,.jpeg,.png,.pdf,.doc,.docx", hint: "Optional" },
];

const STATUS_META: Record<string, { label: string; color: string; desc: string }> = {
  under_review:      { label: "Under Review",        color: "bg-yellow-100 text-yellow-800 border-yellow-200",  desc: "Your application has been submitted and is currently being reviewed by our team." },
  missing_documents: { label: "Action Required",     color: "bg-orange-100 text-orange-800 border-orange-200", desc: "Additional documents or information are required to proceed with your application." },
  approved_hired:    { label: "Approved / Hired",    color: "bg-green-100 text-green-800 border-green-200",    desc: "Congratulations! Your application has been approved. We look forward to welcoming you to the team." },
  not_approved:      { label: "Not Approved",        color: "bg-red-100 text-red-800 border-red-200",          desc: "Thank you for your application. Unfortunately, we are unable to proceed at this time." },
  fired_inactive:    { label: "Inactive",            color: "bg-gray-100 text-gray-700 border-gray-200",       desc: "This hiring package is no longer active." },
  archived:          { label: "Archived",            color: "bg-gray-100 text-gray-700 border-gray-200",       desc: "This hiring package has been archived." },
};

// Signature pad component
function SignaturePad({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) { ctx.clearRect(0, 0, 600, 200); ctx.drawImage(img, 0, 0); }
      };
      img.src = value;
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current!);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getPos(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = false;
    if (canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); onChange(""); }
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={600} height={200}
          className="w-full cursor-crosshair"
          style={{ maxHeight: 200 }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          data-testid="signature-canvas"
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Draw your signature with mouse or finger</p>
        <Button type="button" variant="outline" size="sm" onClick={clear} data-testid="button-clear-signature">
          <X className="w-3.5 h-3.5 mr-1" />Clear
        </Button>
      </div>
    </div>
  );
}

// ── Step 1: Policies ───────────────────────────────────────────────────────────
function PoliciesStep({ policies, acceptedIds, onAccept, onContinue }: {
  policies: any[]; acceptedIds: string[]; onAccept: (p: any) => void; onContinue: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(policies[0]?.id || null);
  const allAccepted = policies.every(p => acceptedIds.includes(p.id));
  const firstUnaccepted = policies.find(p => !acceptedIds.includes(p.id));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Step 1: Company Policies</h2>
        <p className="text-sm text-muted-foreground mt-1">Please read and accept each policy. You must accept all policies before continuing.</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm">{acceptedIds.length} of {policies.length} accepted</span>
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(acceptedIds.length / policies.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {policies.map((policy, idx) => {
          const accepted = acceptedIds.includes(policy.id);
          const prevAccepted = idx === 0 || acceptedIds.includes(policies[idx - 1]?.id);
          const unlocked = prevAccepted;
          const isExpanded = expanded === policy.id;
          return (
            <Card key={policy.id} className={`transition-all ${accepted ? "border-green-200 bg-green-50/30" : !unlocked ? "opacity-60" : ""}`}>
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => unlocked && setExpanded(isExpanded ? null : policy.id)}
                disabled={!unlocked}
              >
                <div className="flex items-center gap-3">
                  {accepted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  ) : unlocked ? (
                    <Unlock className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{idx + 1}. {policy.title}</p>
                    {accepted && <p className="text-xs text-green-700">Accepted</p>}
                    {!unlocked && <p className="text-xs text-gray-400">Accept previous policy first</p>}
                  </div>
                </div>
                {unlocked && (isExpanded ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />)}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t pt-3 space-y-4">
                  <div className="text-sm bg-white rounded border p-4 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {policy.content}
                  </div>
                  {!accepted ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">By clicking agree, you confirm that you reviewed this policy and understand that it may form part of your confidential employment file.</p>
                      <Button onClick={() => onAccept(policy)} className="w-full" data-testid={`button-accept-policy-${policy.id}`}>
                        <Check className="w-4 h-4 mr-2" />
                        I have read, understood, and agree to this policy
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-700 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      You have accepted this policy
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {allAccepted && (
        <Button onClick={onContinue} className="w-full" data-testid="button-policies-continue">
          Continue to Personal Information <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );
}

type PersonalForm = { firstName: string; lastName: string; preferredName: string; email: string; phone: string; homeAddress: string; city: string; province: string; postalCode: string; country: string; position: string; startDate: string; employeeId: string; dateOfBirth: string; };
type EmergencyForm = { contact1Name: string; contact1Relationship: string; contact1Phone: string; contact1Email: string; contact2Name: string; contact2Relationship: string; contact2Phone: string; contact2Email: string; };
type MedicalForm = { allergies: string; sensitivities: string; medicalNotes: string; medications: string; emergencyNotes: string; };

// ── Step 2: Personal Information ───────────────────────────────────────────────
function PersonalInfoStep({ initial, requireDob, onSave, onBack }: {
  initial: any; requireDob: boolean; onSave: (data: any) => void; onBack: () => void;
}) {
  const [form, setForm] = useState<PersonalForm>({
    firstName: "", lastName: "", preferredName: "", email: "", phone: "",
    homeAddress: "", city: "", province: "", postalCode: "", country: "Canada",
    position: "", startDate: "", employeeId: "", dateOfBirth: "",
    ...initial,
  });

  const isValid = form.firstName && form.lastName && form.email && form.phone && form.homeAddress && form.city && form.province && form.postalCode && form.position;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Step 2: Personal Information</h2>
        <p className="text-sm text-muted-foreground mt-1">Please provide your personal information accurately. This will be kept in your confidential employment file.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Legal First Name <span className="text-red-500">*</span></Label>
          <Input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} data-testid="input-first-name" />
        </div>
        <div className="space-y-1">
          <Label>Legal Last Name <span className="text-red-500">*</span></Label>
          <Input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} data-testid="input-last-name" />
        </div>
        <div className="space-y-1">
          <Label>Preferred Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input value={form.preferredName} onChange={e => setForm(p => ({ ...p, preferredName: e.target.value }))} data-testid="input-preferred-name" />
        </div>
        <div className="space-y-1">
          <Label>Email <span className="text-red-500">*</span></Label>
          <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} data-testid="input-email" />
        </div>
        <div className="space-y-1">
          <Label>Phone Number <span className="text-red-500">*</span></Label>
          <Input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} data-testid="input-phone" />
        </div>
        {requireDob && (
          <div className="space-y-1">
            <Label>Date of Birth <span className="text-red-500">*</span></Label>
            <Input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} data-testid="input-dob" />
          </div>
        )}
        <div className="sm:col-span-2 space-y-1">
          <Label>Home Address <span className="text-red-500">*</span></Label>
          <Input value={form.homeAddress} onChange={e => setForm(p => ({ ...p, homeAddress: e.target.value }))} data-testid="input-address" />
        </div>
        <div className="space-y-1">
          <Label>City <span className="text-red-500">*</span></Label>
          <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} data-testid="input-city" />
        </div>
        <div className="space-y-1">
          <Label>Province / State <span className="text-red-500">*</span></Label>
          <Input value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))} data-testid="input-province" />
        </div>
        <div className="space-y-1">
          <Label>Postal Code <span className="text-red-500">*</span></Label>
          <Input value={form.postalCode} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))} data-testid="input-postal" />
        </div>
        <div className="space-y-1">
          <Label>Country</Label>
          <Input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} data-testid="input-country" />
        </div>
        <div className="space-y-1">
          <Label>Position / Job Title <span className="text-red-500">*</span></Label>
          <Input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} data-testid="input-position" />
        </div>
        <div className="space-y-1">
          <Label>Expected Start Date</Label>
          <Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} data-testid="input-start-date" />
        </div>
        <div className="space-y-1">
          <Label>Employee ID <span className="text-muted-foreground text-xs">(optional, if provided)</span></Label>
          <Input value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} data-testid="input-employee-id" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} data-testid="button-back-personal">
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Button onClick={() => onSave(form)} disabled={!isValid} className="flex-1" data-testid="button-save-personal">
          Save & Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Emergency Contacts ─────────────────────────────────────────────────
function EmergencyContactsStep({ initial, onSave, onBack }: {
  initial: any; onSave: (data: any) => void; onBack: () => void;
}) {
  const [form, setForm] = useState<EmergencyForm>({
    contact1Name: "", contact1Relationship: "", contact1Phone: "", contact1Email: "",
    contact2Name: "", contact2Relationship: "", contact2Phone: "", contact2Email: "",
    ...initial,
  });
  const isValid = form.contact1Name && form.contact1Relationship && form.contact1Phone;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Step 3: Emergency Contacts</h2>
        <p className="text-sm text-muted-foreground mt-1">Please provide at least one emergency contact. This information will be kept confidential.</p>
      </div>
      <div>
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2"><Phone className="w-4 h-4" />Emergency Contact 1 <span className="text-red-500">*</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Full Name <span className="text-red-500">*</span></Label>
            <Input value={form.contact1Name} onChange={e => setForm(p => ({ ...p, contact1Name: e.target.value }))} data-testid="input-ec1-name" />
          </div>
          <div className="space-y-1">
            <Label>Relationship <span className="text-red-500">*</span></Label>
            <Input value={form.contact1Relationship} onChange={e => setForm(p => ({ ...p, contact1Relationship: e.target.value }))} placeholder="Parent, Spouse, Sibling..." data-testid="input-ec1-relationship" />
          </div>
          <div className="space-y-1">
            <Label>Phone Number <span className="text-red-500">*</span></Label>
            <Input type="tel" value={form.contact1Phone} onChange={e => setForm(p => ({ ...p, contact1Phone: e.target.value }))} data-testid="input-ec1-phone" />
          </div>
          <div className="space-y-1">
            <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input type="email" value={form.contact1Email} onChange={e => setForm(p => ({ ...p, contact1Email: e.target.value }))} data-testid="input-ec1-email" />
          </div>
        </div>
      </div>
      <div>
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2"><Phone className="w-4 h-4" />Emergency Contact 2 <span className="text-muted-foreground text-xs">(optional)</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Full Name</Label>
            <Input value={form.contact2Name} onChange={e => setForm(p => ({ ...p, contact2Name: e.target.value }))} data-testid="input-ec2-name" />
          </div>
          <div className="space-y-1">
            <Label>Relationship</Label>
            <Input value={form.contact2Relationship} onChange={e => setForm(p => ({ ...p, contact2Relationship: e.target.value }))} data-testid="input-ec2-relationship" />
          </div>
          <div className="space-y-1">
            <Label>Phone Number</Label>
            <Input type="tel" value={form.contact2Phone} onChange={e => setForm(p => ({ ...p, contact2Phone: e.target.value }))} data-testid="input-ec2-phone" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.contact2Email} onChange={e => setForm(p => ({ ...p, contact2Email: e.target.value }))} data-testid="input-ec2-email" />
          </div>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} data-testid="button-back-emergency">
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Button onClick={() => onSave(form)} disabled={!isValid} className="flex-1" data-testid="button-save-emergency">
          Save & Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 4: Medical Information ────────────────────────────────────────────────
function MedicalInfoStep({ initial, onSave, onBack }: {
  initial: any; onSave: (data: any) => void; onBack: () => void;
}) {
  const [form, setForm] = useState<MedicalForm>({ allergies: "", sensitivities: "", medicalNotes: "", medications: "", emergencyNotes: "", ...initial });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Step 4: Medical Information</h2>
        <p className="text-sm text-muted-foreground mt-1">This section is optional. All fields below are optional.</p>
      </div>
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">The information you provide in this section will be held in the strictest confidence and will only be shared on a need-to-know basis with authorized company personnel. This form is not intended to request or investigate your personal medical history. The information is collected only to help respond to an emergency, safety concern, allergy, sensitivity, or medical situation that may occur at work.</p>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Allergies <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Textarea value={form.allergies} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))} placeholder="List any known allergies..." rows={2} data-testid="textarea-allergies" />
        </div>
        <div className="space-y-1">
          <Label>Sensitivities <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Textarea value={form.sensitivities} onChange={e => setForm(p => ({ ...p, sensitivities: e.target.value }))} placeholder="List any sensitivities..." rows={2} data-testid="textarea-sensitivities" />
        </div>
        <div className="space-y-1">
          <Label>Medical Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Textarea value={form.medicalNotes} onChange={e => setForm(p => ({ ...p, medicalNotes: e.target.value }))} placeholder="Any medical notes relevant to workplace safety..." rows={2} data-testid="textarea-medical-notes" />
        </div>
        <div className="space-y-1">
          <Label>Medications <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Textarea value={form.medications} onChange={e => setForm(p => ({ ...p, medications: e.target.value }))} placeholder="Medication or special note the company should know..." rows={2} data-testid="textarea-medications" />
        </div>
        <div className="space-y-1">
          <Label>Emergency Safety Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Textarea value={form.emergencyNotes} onChange={e => setForm(p => ({ ...p, emergencyNotes: e.target.value }))} placeholder="Any emergency safety notes..." rows={2} data-testid="textarea-emergency-notes" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} data-testid="button-back-medical">
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Button onClick={() => onSave(form)} className="flex-1" data-testid="button-save-medical">
          Save & Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 5: Documents ──────────────────────────────────────────────────────────
function DocumentsStep({ token, uploadedDocs, onDocUploaded, onDocRemoved, onContinue, onBack }: {
  token: string; uploadedDocs: any[]; onDocUploaded: (doc: any) => void; onDocRemoved: (docType: string) => void; onContinue: () => void; onBack: () => void;
}) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getDoc = (key: string) => uploadedDocs.find(d => d.documentType === key);
  const requiredUploaded = DOC_CONFIG.filter(d => d.required).every(d => !!getDoc(d.key));

  const handleUpload = async (key: string, file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [key]: "File exceeds 100 MB limit" }));
      return;
    }
    setUploading(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: "" }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", key);
      const res = await fetch(`/api/public/employee-hiring/${token}/upload-document`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      onDocUploaded(data.document);
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [key]: e.message || "Upload failed" }));
    } finally {
      setUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRemove = async (key: string) => {
    try {
      await fetch(`/api/public/employee-hiring/${token}/remove-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: key }),
      });
      onDocRemoved(key);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Step 5: Required Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">Please upload the required documents. Maximum file size: 100 MB per file.</p>
      </div>
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="pt-3 pb-3">
          <p className="text-xs text-blue-800">The documents you upload will be kept confidential and used only for employment review, identity verification, onboarding, and employment record purposes. Access is limited to authorized company personnel.</p>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {DOC_CONFIG.map(docCfg => {
          const doc = getDoc(docCfg.key);
          const isUploading = uploading[docCfg.key];
          const error = errors[docCfg.key];
          return (
            <Card key={docCfg.key} className={`${doc ? "border-green-200 bg-green-50/30" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {docCfg.label}
                      {docCfg.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{docCfg.hint}</p>
                    {doc && (
                      <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Uploaded: {doc.originalName}
                      </p>
                    )}
                    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {doc && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => handleRemove(docCfg.key)} data-testid={`button-remove-${docCfg.key}`}>
                        <X className="w-3 h-3 mr-1" />Remove
                      </Button>
                    )}
                    <label
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md cursor-pointer transition-colors ${doc ? "border-gray-200 bg-white hover:bg-gray-50" : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"}`}
                      data-testid={`label-upload-${docCfg.key}`}
                    >
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {doc ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept={docCfg.accept}
                        className="hidden"
                        id={`upload-${docCfg.key}`}
                        disabled={isUploading}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(docCfg.key, f); e.target.value = ""; }}
                        data-testid={`input-upload-${docCfg.key}`}
                      />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} data-testid="button-back-docs">
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Button onClick={onContinue} disabled={!requiredUploaded} className="flex-1" data-testid="button-docs-continue">
          Continue to Signature <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
      {!requiredUploaded && (
        <p className="text-xs text-muted-foreground text-center">Please upload all required documents (marked with *) to continue.</p>
      )}
    </div>
  );
}

// ── Step 6: Signature ──────────────────────────────────────────────────────────
function SignatureStep({ token, existingSignature, onSigned, onSubmit, submitting, onBack }: {
  token: string; existingSignature: string; onSigned: (sig: string) => void; onSubmit: () => void; submitting: boolean; onBack: () => void;
}) {
  const [sig, setSig] = useState(existingSignature || "");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSigChange = (dataUrl: string) => {
    setSig(dataUrl);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    if (!dataUrl) return;
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/public/employee-hiring/${token}/sign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureData: dataUrl }),
        });
        onSigned(dataUrl);
      } finally { setSaving(false); }
    }, 800);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Step 6: Final Acknowledgement & Signature</h2>
        <p className="text-sm text-muted-foreground mt-1">Please read the final acknowledgement and sign below.</p>
      </div>
      <Card className="bg-amber-50 border-amber-100">
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm text-amber-900 font-medium">Final Acknowledgement</p>
          <p className="text-sm text-amber-800 leading-relaxed">I confirm that the information I provided is accurate to the best of my knowledge. I confirm that I have read, understood, and agreed to all required company policies in this hiring package. I understand that this hiring package and all accepted policies may become part of my confidential employment file.</p>
        </CardContent>
      </Card>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={e => setAcknowledged(e.target.checked)}
          className="mt-0.5"
          data-testid="checkbox-acknowledge"
        />
        <span className="text-sm">I agree and confirm the above statement.</span>
      </label>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Pen className="w-4 h-4" />Draw Your Signature <span className="text-red-500">*</span>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {sig && !saving && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
        </Label>
        <SignaturePad value={sig} onChange={handleSigChange} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} data-testid="button-back-sig">
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!sig || !acknowledged || submitting}
          className="flex-1"
          data-testid="button-submit-package"
        >
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Submit Hiring Package
        </Button>
      </div>
    </div>
  );
}

// ── Step 7: Status ─────────────────────────────────────────────────────────────
function StatusStep({ submission, pkg, missingDocsMessage, requestedMissingDocs, token, onUploadedMissing }: {
  submission: any; pkg: any; missingDocsMessage: string; requestedMissingDocs: string[]; token: string; onUploadedMissing: () => void;
}) {
  const status = submission?.reviewStatus || "under_review";
  const meta = STATUS_META[status] || STATUS_META["under_review"];
  const [uploadedMissing, setUploadedMissing] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const DOC_LABELS: Record<string, string> = {
    government_id_front: "Government ID (Front)",
    government_id_back: "Government ID (Back)",
    resume_cv: "Resume / CV",
    work_permit: "Work Permit",
    certificate_license: "Certificate / Licence",
    other_supporting_document: "Other Supporting Document",
  };

  const handleMissingUpload = async (key: string, file: File) => {
    if (file.size > 100 * 1024 * 1024) { setErrors(p => ({ ...p, [key]: "File exceeds 100 MB" })); return; }
    setUploading(p => ({ ...p, [key]: true }));
    setErrors(p => ({ ...p, [key]: "" }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("documentType", key);
      const res = await fetch(`/api/public/employee-hiring/${token}/upload-document`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setUploadedMissing(p => ({ ...p, [key]: data.document }));
      onUploadedMissing();
    } catch (e: any) {
      setErrors(p => ({ ...p, [key]: e.message }));
    } finally {
      setUploading(p => ({ ...p, [key]: false }));
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div className={`inline-block px-4 py-2 rounded-full border text-sm font-medium ${meta.color}`}>
        {meta.label}
      </div>
      <div>
        <h2 className="text-lg font-semibold">
          {status === "approved_hired" ? "🎉 Congratulations!" : "Application Submitted"}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">{meta.desc}</p>
      </div>
      {status !== "missing_documents" && (
        <Card className="max-w-sm mx-auto text-left">
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Keep this link to check your application status:</p>
            <p className="text-xs font-mono bg-muted rounded p-2 break-all">{window.location.href}</p>
          </CardContent>
        </Card>
      )}
      {status === "missing_documents" && (
        <div className="max-w-sm mx-auto text-left space-y-4">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm font-medium text-orange-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />Action Required
              </p>
              {missingDocsMessage && <p className="text-sm text-orange-700">{missingDocsMessage}</p>}
            </CardContent>
          </Card>
          {requestedMissingDocs?.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Please upload the following document(s):</p>
              {requestedMissingDocs.map(key => (
                <Card key={key} className={uploadedMissing[key] ? "border-green-200 bg-green-50/30" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{DOC_LABELS[key] || key}</p>
                        {uploadedMissing[key] && <p className="text-xs text-green-700">✓ Uploaded: {uploadedMissing[key].originalName}</p>}
                        {errors[key] && <p className="text-xs text-red-600">{errors[key]}</p>}
                      </div>
                      <label className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded-md cursor-pointer ${uploadedMissing[key] ? "border-gray-200 bg-white" : "border-primary bg-primary text-primary-foreground"}`}>
                        {uploading[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        {uploadedMissing[key] ? "Replace" : "Upload"}
                        <input type="file" className="hidden" disabled={uploading[key]} onChange={e => { const f = e.target.files?.[0]; if (f) handleMissingUpload(key, f); e.target.value = ""; }} />
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Public Page ───────────────────────────────────────────────────────────
export default function PublicEmployeeHiring() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [step, setStep] = useState(1);
  const [acceptedPolicyIds, setAcceptedPolicyIds] = useState<string[]>([]);
  const [personalInfo, setPersonalInfo] = useState<any>({});
  const [emergencyContacts, setEmergencyContacts] = useState<any>({});
  const [medicalInfo, setMedicalInfo] = useState<any>({});
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["/api/public/employee-hiring", token],
    queryFn: () => fetch(`/api/public/employee-hiring/${token}`).then(r => r.json()),
    enabled: !!token,
    staleTime: 30_000,
  });

  // Hydrate state from backend on load
  useEffect(() => {
    if (!data) return;
    const { submission, policies: pols } = data;
    if (!submission) return;
    // Accepted policies
    if (data.acceptedPolicyIds?.length) setAcceptedPolicyIds(data.acceptedPolicyIds);
    // Personal info
    if (submission.personalInfoJson) setPersonalInfo(submission.personalInfoJson);
    // Emergency contacts
    if (submission.emergencyContactsJson) setEmergencyContacts(submission.emergencyContactsJson);
    // Medical info
    if (submission.medicalInfoJson) setMedicalInfo(submission.medicalInfoJson);
    // Documents
    if (data.documents?.length) setUploadedDocs(data.documents);
    // Signature
    if (submission.signatureData) setSignature(submission.signatureData);
    // Step — resume from where they left off
    const s = submission;
    if (s.submittedAt) { setStep(7); return; }
    if (s.signatureData) { setStep(6); return; }
    const REQUIRED_DOCS = ["government_id_front", "government_id_back", "resume_cv"];
    const docs = data.documents || [];
    if (REQUIRED_DOCS.every((k: string) => docs.find((d: any) => d.documentType === k))) { setStep(6); return; }
    if (s.medicalInfoJson || s.emergencyContactsJson) { setStep(5); return; }
    if (s.emergencyContactsJson) { setStep(4); return; }
    if (s.personalInfoJson) { setStep(3); return; }
    const policies = data.policies || [];
    if (data.acceptedPolicyIds?.length === policies.length && policies.length > 0) { setStep(2); return; }
    setStep(1);
  }, [data]);

  const saveProgress = async (updates: any) => {
    await fetch(`/api/public/employee-hiring/${token}/save-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  };

  const handleAcceptPolicy = async (policy: any) => {
    const newIds = [...acceptedPolicyIds, policy.id];
    setAcceptedPolicyIds(newIds);
    await fetch(`/api/public/employee-hiring/${token}/accept-policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId: policy.id, policyTitle: policy.title, policyVersion: policy.version, policyContentSnapshot: policy.content }),
    });
    // After accepting all policies, auto-expand next
    const policies = data?.policies || [];
    const nextIdx = policies.findIndex((p: any) => !newIds.includes(p.id) && p.id !== policy.id);
  };

  const handleSavePersonal = async (info: any) => {
    setPersonalInfo(info);
    await saveProgress({ personalInfoJson: info, currentStep: 3 });
    setStep(3);
  };

  const handleSaveEmergency = async (info: any) => {
    setEmergencyContacts(info);
    await saveProgress({ emergencyContactsJson: info, currentStep: 4 });
    setStep(4);
  };

  const handleSaveMedical = async (info: any) => {
    setMedicalInfo(info);
    await saveProgress({ medicalInfoJson: info, currentStep: 5 });
    setStep(5);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/public/employee-hiring/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data2 = await res.json();
      if (!res.ok) throw new Error(data2.message || "Submission failed");
      setStep(7);
      refetch();
    } catch (e: any) {
      setSubmitError(e.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (error || data?.error || !data?.pkg) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Link Not Found</h2>
        <p className="text-sm text-muted-foreground mt-1">This hiring package link is invalid or has expired. Please contact your employer for a new link.</p>
      </div>
    </div>
  );

  const { pkg, submission, policies = [], template } = data;
  const requireDob = template?.requireDateOfBirth || false;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">ClockField</span>
          </div>
          <h1 className="text-xl font-bold">Hiring Package</h1>
          {pkg.employeeName && <p className="text-sm text-muted-foreground">For: {pkg.employeeName}{pkg.position ? ` · ${pkg.position}` : ""}</p>}
        </div>

        {/* Step indicator */}
        {step < 7 && (
          <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
            {STEPS.slice(0, 6).map((s, idx) => (
              <div key={s.id} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors ${step === s.id ? "bg-primary text-primary-foreground" : step > s.id ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {step > s.id ? <Check className="w-3 h-3" /> : s.id}
                </div>
                <span className={`text-xs whitespace-nowrap hidden sm:block ${step === s.id ? "text-primary font-medium" : step > s.id ? "text-green-700" : "text-gray-400"}`}>{s.label}</span>
                {idx < 5 && <div className={`w-4 h-px flex-none mx-1 ${step > s.id ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        <Card className="shadow-sm">
          <CardContent className="p-5 sm:p-6">
            {step === 1 && (
              <PoliciesStep
                policies={policies}
                acceptedIds={acceptedPolicyIds}
                onAccept={handleAcceptPolicy}
                onContinue={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <PersonalInfoStep
                initial={personalInfo}
                requireDob={requireDob}
                onSave={handleSavePersonal}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <EmergencyContactsStep
                initial={emergencyContacts}
                onSave={handleSaveEmergency}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <MedicalInfoStep
                initial={medicalInfo}
                onSave={handleSaveMedical}
                onBack={() => setStep(3)}
              />
            )}
            {step === 5 && (
              <DocumentsStep
                token={token}
                uploadedDocs={uploadedDocs}
                onDocUploaded={doc => setUploadedDocs(prev => { const updated = prev.filter(d => d.documentType !== doc.documentType); return [...updated, doc]; })}
                onDocRemoved={key => setUploadedDocs(prev => prev.filter(d => d.documentType !== key))}
                onContinue={() => setStep(6)}
                onBack={() => setStep(4)}
              />
            )}
            {step === 6 && (
              <SignatureStep
                token={token}
                existingSignature={signature}
                onSigned={setSignature}
                onSubmit={handleSubmit}
                submitting={submitting}
                onBack={() => setStep(5)}
              />
            )}
            {step === 7 && submission && (
              <StatusStep
                submission={submission}
                pkg={pkg}
                missingDocsMessage={submission.missingDocsMessage || ""}
                requestedMissingDocs={submission.requestedMissingDocs || []}
                token={token}
                onUploadedMissing={refetch}
              />
            )}
            {submitError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded text-sm text-red-700">
                {submitError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
