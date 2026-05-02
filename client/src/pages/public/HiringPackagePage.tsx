import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ChevronRight, Download, Upload, X, FileText, AlertCircle, Loader2, Clock, CheckCheck } from "lucide-react";

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = ["Policies", "Personal Info", "Emergency Contacts", "Medical Info", "Documents", "Signature", "Status"];

function StepIndicator({ current, completed }: { current: number; completed: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-1">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n <= completed;
        const active = n === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${done ? "bg-green-500 border-green-500 text-white" : active ? "bg-primary border-primary text-white" : "bg-white border-gray-300 text-gray-400"}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : n}
              </div>
              <span className={`text-[10px] whitespace-nowrap hidden sm:block ${active ? "text-primary font-medium" : done ? "text-green-600" : "text-gray-400"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 w-6 sm:w-10 mx-0.5 sm:mx-1 shrink-0 ${n <= completed ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Policies ──────────────────────────────────────────────────────────
function PoliciesStep({ policies, acceptedIds, token, onAccept, onAllAccepted }: {
  policies: any[];
  acceptedIds: string[];
  token: string;
  onAccept: (policyId: string) => void;
  onAllAccepted: () => void;
}) {
  const required = policies.filter((p: any) => p.required !== false);
  const firstUnaccepted = required.find((p: any) => !acceptedIds.includes(p.id));
  const [accepting, setAccepting] = useState(false);
  const allAccepted = required.every((p: any) => acceptedIds.includes(p.id));

  const accept = async () => {
    if (!firstUnaccepted) return;
    setAccepting(true);
    try {
      await apiRequest("POST", `/api/public/hiring-package/${token}/accept-policy`, {
        policyId: firstUnaccepted.id,
        policyTitle: firstUnaccepted.title,
        policyVersion: firstUnaccepted.version || "1.0",
        policyContentSnapshot: firstUnaccepted.content || "",
      });
      onAccept(firstUnaccepted.id);
    } catch { /* silent — UI still advances */ }
    setAccepting(false);
  };

  if (allAccepted) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-green-600" /></div>
        <div><h3 className="font-semibold text-lg">All Policies Accepted</h3><p className="text-sm text-muted-foreground mt-1">You have reviewed and accepted all required company policies.</p></div>
        <Button onClick={onAllAccepted} data-testid="button-continue-after-policies" className="px-8">Continue to Personal Information <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
    );
  }

  const currentIdx = required.findIndex((p: any) => p.id === firstUnaccepted?.id);
  const policy = firstUnaccepted;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Policy {currentIdx + 1} of {required.length}</span>
        <div className="flex gap-1">{required.map((p: any) => (<div key={p.id} className={`w-2 h-2 rounded-full ${acceptedIds.includes(p.id) ? "bg-green-500" : p.id === policy?.id ? "bg-primary" : "bg-gray-200"}`} />))}</div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const a = document.createElement("a"); a.href = `/api/public/hiring-package/${token}/download-blank-pdf`; a.download = "hiring-package.pdf"; a.click(); }} data-testid="button-download-blank-pdf"><Download className="w-3.5 h-3.5 mr-1" />Download PDF</Button>
      </div>

      {required.slice(0, currentIdx).map((p: any) => (
        <div key={p.id} className="border border-green-200 bg-green-50 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <span className="text-sm text-green-700 font-medium">{p.title}</span>
        </div>
      ))}

      {policy && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h3 className="font-semibold text-base">{policy.title}</h3>
            {policy.version && <p className="text-xs text-muted-foreground">Version {policy.version}</p>}
          </div>
          <div className="p-4 max-h-72 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{policy.content}</pre>
          </div>
          <div className="px-4 pb-4 pt-3 border-t bg-gray-50/50 space-y-3">
            <p className="text-xs text-muted-foreground italic">By clicking agree, you confirm that you reviewed this policy and understand that it may form part of your confidential employment file.</p>
            <Button className="w-full" onClick={accept} disabled={accepting} data-testid="button-accept-policy">
              {accepting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCheck className="w-4 h-4 mr-2" />}
              {policy.acceptanceStatement || "I have read, understood, and agree to this policy."}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Personal Info ─────────────────────────────────────────────────────
function PersonalInfoStep({ token, saved, onSaved }: { token: string; saved: any; onSaved: (data: any) => void }) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", preferredName: "", email: "", phone: "",
    dateOfBirth: "", address: "", city: "", province: "", postalCode: "", country: "Canada",
    position: "", startDate: "", ...saved,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.address.trim()) e.address = "Required";
    if (!form.city.trim()) e.city = "Required";
    if (!form.province.trim()) e.province = "Required";
    if (!form.postalCode.trim()) e.postalCode = "Required";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/public/hiring-package/${token}/save-progress`, { step: "personal_info", personalInfo: form });
      onSaved(form);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: any) => { setForm(p => ({ ...p, [key]: e.target.value })); if (errors[key]) setErrors(p => ({ ...p, [key]: "" })); },
  });

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-semibold">Personal Information</h2><p className="text-sm text-muted-foreground mt-1">Please provide your personal information accurately. This will be kept in your confidential employment file.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><Label>Legal First Name <span className="text-red-500">*</span></Label><Input className="mt-1" {...f("firstName")} data-testid="input-first-name" />{errors.firstName && <p className="text-xs text-red-500 mt-0.5">{errors.firstName}</p>}</div>
        <div><Label>Legal Last Name <span className="text-red-500">*</span></Label><Input className="mt-1" {...f("lastName")} data-testid="input-last-name" />{errors.lastName && <p className="text-xs text-red-500 mt-0.5">{errors.lastName}</p>}</div>
        <div><Label>Preferred Name <span className="text-xs text-muted-foreground">(optional)</span></Label><Input className="mt-1" {...f("preferredName")} data-testid="input-preferred-name" /></div>
        <div><Label>Email <span className="text-red-500">*</span></Label><Input className="mt-1" type="email" {...f("email")} data-testid="input-email" />{errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}</div>
        <div><Label>Phone Number <span className="text-red-500">*</span></Label><Input className="mt-1" type="tel" {...f("phone")} data-testid="input-phone" />{errors.phone && <p className="text-xs text-red-500 mt-0.5">{errors.phone}</p>}</div>
        <div><Label>Date of Birth <span className="text-xs text-muted-foreground">(optional)</span></Label><Input className="mt-1" type="date" {...f("dateOfBirth")} data-testid="input-dob" /></div>
        <div className="sm:col-span-2"><Label>Home Address <span className="text-red-500">*</span></Label><Input className="mt-1" {...f("address")} placeholder="Street address" data-testid="input-address" />{errors.address && <p className="text-xs text-red-500 mt-0.5">{errors.address}</p>}</div>
        <div><Label>City <span className="text-red-500">*</span></Label><Input className="mt-1" {...f("city")} data-testid="input-city" />{errors.city && <p className="text-xs text-red-500 mt-0.5">{errors.city}</p>}</div>
        <div><Label>Province / State <span className="text-red-500">*</span></Label><Input className="mt-1" {...f("province")} data-testid="input-province" />{errors.province && <p className="text-xs text-red-500 mt-0.5">{errors.province}</p>}</div>
        <div><Label>Postal Code <span className="text-red-500">*</span></Label><Input className="mt-1" {...f("postalCode")} data-testid="input-postal" />{errors.postalCode && <p className="text-xs text-red-500 mt-0.5">{errors.postalCode}</p>}</div>
        <div><Label>Country</Label><Input className="mt-1" {...f("country")} data-testid="input-country" /></div>
        <div><Label>Position / Job Title</Label><Input className="mt-1" {...f("position")} data-testid="input-position" /></div>
        <div><Label>Expected Start Date</Label><Input className="mt-1" type="date" {...f("startDate")} data-testid="input-start-date" /></div>
      </div>
      <Button className="w-full sm:w-auto px-8" onClick={save} disabled={saving} data-testid="button-save-personal">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save & Continue <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// ── Step 3: Emergency Contacts ────────────────────────────────────────────────
function EmergencyContactsStep({ token, saved, onSaved }: { token: string; saved: any; onSaved: (data: any) => void }) {
  const blank = { name: "", relationship: "", phone: "", email: "" };
  const [contact1, setContact1] = useState(saved?.contact1 || blank);
  const [contact2, setContact2] = useState(saved?.contact2 || blank);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!contact1.name.trim()) e["c1name"] = "Required";
    if (!contact1.relationship.trim()) e["c1rel"] = "Required";
    if (!contact1.phone.trim()) e["c1phone"] = "Required";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = { contact1, contact2: contact2.name ? contact2 : null };
      await apiRequest("POST", `/api/public/hiring-package/${token}/save-progress`, { step: "emergency_contacts", emergencyContacts: data });
      onSaved(data);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const field = (c: any, setC: any, key: string, errKey: string) => ({
    value: c[key], onChange: (e: any) => { setC((p: any) => ({ ...p, [key]: e.target.value })); if (errors[errKey]) setErrors(p => ({ ...p, [errKey]: "" })); },
  });

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-semibold">Emergency Contacts</h2><p className="text-sm text-muted-foreground mt-1">Please provide at least one emergency contact. This information will be kept strictly confidential.</p></div>

      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact 1 <span className="text-red-500">*</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Full Name <span className="text-red-500">*</span></Label><Input className="mt-1" {...field(contact1, setContact1, "name", "c1name")} data-testid="input-c1-name" />{errors.c1name && <p className="text-xs text-red-500 mt-0.5">{errors.c1name}</p>}</div>
          <div><Label>Relationship <span className="text-red-500">*</span></Label><Input className="mt-1" placeholder="e.g. Spouse, Parent" {...field(contact1, setContact1, "relationship", "c1rel")} data-testid="input-c1-relationship" />{errors.c1rel && <p className="text-xs text-red-500 mt-0.5">{errors.c1rel}</p>}</div>
          <div><Label>Phone Number <span className="text-red-500">*</span></Label><Input className="mt-1" type="tel" {...field(contact1, setContact1, "phone", "c1phone")} data-testid="input-c1-phone" />{errors.c1phone && <p className="text-xs text-red-500 mt-0.5">{errors.c1phone}</p>}</div>
          <div><Label>Email <span className="text-xs text-muted-foreground">(optional)</span></Label><Input className="mt-1" type="email" {...field(contact1, setContact1, "email", "")} data-testid="input-c1-email" /></div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact 2 <span className="text-xs text-muted-foreground font-normal">(optional)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Full Name</Label><Input className="mt-1" {...field(contact2, setContact2, "name", "")} data-testid="input-c2-name" /></div>
          <div><Label>Relationship</Label><Input className="mt-1" placeholder="e.g. Sibling, Friend" {...field(contact2, setContact2, "relationship", "")} data-testid="input-c2-relationship" /></div>
          <div><Label>Phone Number</Label><Input className="mt-1" type="tel" {...field(contact2, setContact2, "phone", "")} data-testid="input-c2-phone" /></div>
          <div><Label>Email</Label><Input className="mt-1" type="email" {...field(contact2, setContact2, "email", "")} data-testid="input-c2-email" /></div>
        </div>
      </div>

      <Button className="w-full sm:w-auto px-8" onClick={save} disabled={saving} data-testid="button-save-emergency">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save & Continue <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// ── Step 4: Medical Info ──────────────────────────────────────────────────────
function MedicalInfoStep({ token, saved, onSaved }: { token: string; saved: any; onSaved: (data: any) => void }) {
  const [form, setForm] = useState({ allergies: "", sensitivities: "", medicalNotes: "", medications: "", emergencyNotes: "", ...saved });
  const [saving, setSaving] = useState(false);

  const save = async (skip = false) => {
    setSaving(true);
    try {
      const data = skip ? null : form;
      await apiRequest("POST", `/api/public/hiring-package/${token}/save-progress`, { step: "medical_info", medicalInfo: data });
      onSaved(skip ? null : form);
    } catch { onSaved(skip ? null : form); }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-semibold">Optional Medical Information</h2></div>
      <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 text-sm text-blue-800 leading-relaxed">
        The information you provide in this section will be held in the strictest confidence and will only be shared on a need-to-know basis with authorized company personnel. This form is not intended to request or investigate your personal medical history. The information is collected only to help respond to an emergency, allergy, sensitivity, safety concern, or medical situation that may occur at work.
      </div>
      <div className="space-y-4">
        <div><Label>Allergies <span className="text-xs text-muted-foreground">(optional)</span></Label><Textarea className="mt-1 text-sm" rows={2} value={form.allergies} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))} placeholder="e.g. Bee stings, peanuts..." data-testid="textarea-allergies" /></div>
        <div><Label>Sensitivities <span className="text-xs text-muted-foreground">(optional)</span></Label><Textarea className="mt-1 text-sm" rows={2} value={form.sensitivities} onChange={e => setForm(p => ({ ...p, sensitivities: e.target.value }))} placeholder="e.g. Strong fragrances, latex..." data-testid="textarea-sensitivities" /></div>
        <div><Label>Medical Notes Relevant to Workplace Safety <span className="text-xs text-muted-foreground">(optional)</span></Label><Textarea className="mt-1 text-sm" rows={3} value={form.medicalNotes} onChange={e => setForm(p => ({ ...p, medicalNotes: e.target.value }))} placeholder="Any conditions relevant to your safety at work..." data-testid="textarea-medical-notes" /></div>
        <div><Label>Medications / Special Notes <span className="text-xs text-muted-foreground">(optional)</span></Label><Textarea className="mt-1 text-sm" rows={2} value={form.medications} onChange={e => setForm(p => ({ ...p, medications: e.target.value }))} data-testid="textarea-medications" /></div>
        <div><Label>Emergency Safety Notes <span className="text-xs text-muted-foreground">(optional)</span></Label><Textarea className="mt-1 text-sm" rows={2} value={form.emergencyNotes} onChange={e => setForm(p => ({ ...p, emergencyNotes: e.target.value }))} placeholder="What first responders should know..." data-testid="textarea-emergency-notes" /></div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="px-8" onClick={() => save(false)} disabled={saving} data-testid="button-save-medical">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save & Continue <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        <Button variant="outline" onClick={() => save(true)} disabled={saving} data-testid="button-skip-medical">Skip This Section</Button>
      </div>
    </div>
  );
}

// ── Step 5: Documents ─────────────────────────────────────────────────────────
const DOC_TYPES = [
  { key: "government_id_front", label: "Government ID Front", required: true, accept: "image/jpeg,image/png,image/jpg,application/pdf" },
  { key: "government_id_back", label: "Government ID Back", required: true, accept: "image/jpeg,image/png,image/jpg,application/pdf" },
  { key: "resume_cv", label: "Resume / CV", required: true, accept: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { key: "work_permit", label: "Work Permit", required: false, accept: "image/jpeg,image/png,image/jpg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { key: "certificate_license", label: "Certificate / Licence", required: false, accept: "image/jpeg,image/png,image/jpg,application/pdf" },
  { key: "other_supporting_document", label: "Other Supporting Document", required: false, accept: "image/jpeg,image/png,image/jpg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
];

function DocumentUploadStep({ token, uploadedDocs, onUploaded, onContinue }: {
  token: string;
  uploadedDocs: any[];
  onUploaded: (docs: any[]) => void;
  onContinue: () => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [localDocs, setLocalDocs] = useState<any[]>(uploadedDocs);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { setLocalDocs(uploadedDocs); }, [uploadedDocs]);

  const getDoc = (key: string) => localDocs.find((d: any) => d.documentType === key);

  const upload = async (key: string, file: File) => {
    console.log("[HP Upload] file:", file.name, file.type, file.size, "docType:", key);
    setUploading(key); setErrors(e => ({ ...e, [key]: "" }));
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("documentType", key);
      const res = await fetch(`/api/public/hiring-package/${token}/upload-document`, { method: "POST", body: fd });
      const data = await res.json();
      console.log("[HP Upload] response:", res.status, data);
      if (!res.ok) { setErrors(e => ({ ...e, [key]: data.message || "Upload failed" })); return; }
      const updated = [...localDocs.filter((d: any) => d.documentType !== key), data];
      setLocalDocs(updated); onUploaded(updated);
      setErrors(e => ({ ...e, [key]: "" }));
    } catch (err: any) {
      console.error("[HP Upload] error:", err);
      setErrors(e => ({ ...e, [key]: "Upload failed. Please try again." }));
    } finally { setUploading(null); }
  };

  const remove = async (key: string) => {
    setRemoving(key);
    try {
      await apiRequest("POST", `/api/public/hiring-package/${token}/remove-document`, { documentType: key });
      const updated = localDocs.filter((d: any) => d.documentType !== key);
      setLocalDocs(updated); onUploaded(updated);
    } catch { /* ignore */ }
    setRemoving(null);
  };

  const canContinue = DOC_TYPES.filter(d => d.required).every(d => getDoc(d.key));

  const handleContinue = () => {
    const e: Record<string, string> = {};
    DOC_TYPES.filter(d => d.required).forEach(d => { if (!getDoc(d.key)) e[d.key] = "This document is required"; });
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onContinue();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Document Upload</h2>
        <p className="text-sm text-muted-foreground mt-1">Upload your required documents. Maximum file size: 100 MB.</p>
      </div>
      <div className="space-y-3">
        {DOC_TYPES.map(dt => {
          const doc = getDoc(dt.key);
          const isUploading = uploading === dt.key;
          const isRemoving = removing === dt.key;
          return (
            <div key={dt.key} className={`border rounded-lg p-4 ${errors[dt.key] ? "border-red-300 bg-red-50/30" : doc ? "border-green-200 bg-green-50/30" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className={`w-4 h-4 shrink-0 ${doc ? "text-green-600" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{dt.label}</span>
                    {dt.required ? <span className="ml-1.5 text-xs text-red-500 font-medium">Required</span> : <span className="ml-1.5 text-xs text-muted-foreground">Optional</span>}
                    {doc && <p className="text-xs text-green-600 truncate">Uploaded: {doc.originalName}</p>}
                    {errors[dt.key] && <p className="text-xs text-red-600">{errors[dt.key]}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc ? (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setErrors(e => ({ ...e, [dt.key]: "" })); fileRefs.current[dt.key]?.click(); }} data-testid={`button-replace-${dt.key}`}>Replace</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => remove(dt.key)} disabled={isRemoving} data-testid={`button-remove-${dt.key}`}>{isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileRefs.current[dt.key]?.click()} disabled={isUploading} data-testid={`button-upload-${dt.key}`}>
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}Upload
                    </Button>
                  )}
                </div>
              </div>
              <input ref={el => { fileRefs.current[dt.key] = el; }} id={`upload-${dt.key}`} type="file" accept={dt.accept} className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(dt.key, f); e.target.value = ""; }}
                data-testid={`input-file-${dt.key}`} />
            </div>
          );
        })}
      </div>
      <Button className="w-full sm:w-auto px-8" onClick={handleContinue} data-testid="button-continue-docs">
        Continue to Signature <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// ── Step 6: Signature ─────────────────────────────────────────────────────────
function SignatureStep({ token, hasSig, onSubmitted }: { token: string; hasSig: boolean; onSubmitted: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [signed, setSigned] = useState(hasSig);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = useCallback((e: any) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos; setDrawing(true);
  }, []);

  const draw = useCallback((e: any) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    if (lastPos.current) { ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    lastPos.current = pos;
  }, [drawing]);

  const endDraw = useCallback(() => { setDrawing(false); lastPos.current = null; setSigned(true); }, []);

  const clear = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(hasSig); // if already saved, still "signed"
  };

  const submit = async () => {
    if (!signed && !hasSig) { setError("Please sign before submitting."); return; }
    if (!acknowledged) { setError("Please check the acknowledgement box."); return; }
    setError(""); setSubmitting(true);
    try {
      const canvas = canvasRef.current;
      const sigData = canvas ? canvas.toDataURL("image/png") : "";
      if (sigData && sigData !== "data:,") {
        await apiRequest("POST", `/api/public/hiring-package/${token}/sign`, { signatureData: sigData, finalAcknowledgement: true });
      }
      await apiRequest("POST", `/api/public/hiring-package/${token}/submit`, {});
      onSubmitted();
    } catch (e: any) {
      setError(e?.message || "Submission failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-semibold">Signature &amp; Final Acknowledgement</h2></div>
      <div className="border rounded-lg p-4 bg-gray-50 text-sm text-gray-700 leading-relaxed">
        I confirm that the information I provided is accurate to the best of my knowledge. I confirm that I have read, understood, and agreed to all required company policies in this hiring package. I understand that this hiring package and all accepted policies may become part of my confidential employment file.
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="ack" checked={acknowledged} onCheckedChange={v => setAcknowledged(!!v)} data-testid="checkbox-acknowledgement" />
        <label htmlFor="ack" className="text-sm leading-relaxed cursor-pointer">I agree and confirm the statement above.</label>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Signature <span className="text-red-500">*</span></Label>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={clear} data-testid="button-clear-sig">Clear</Button>
        </div>
        {hasSig && !drawing && <p className="text-xs text-green-600">✓ Signature saved — draw a new one to replace it.</p>}
        <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white" style={{ touchAction: "none" }}>
          <canvas ref={canvasRef} width={560} height={160} className="w-full cursor-crosshair block"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
            data-testid="canvas-signature" />
        </div>
        <p className="text-xs text-muted-foreground">Draw your signature above using your mouse or finger.</p>
      </div>
      {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{error}</p>}
      <Button className="w-full" size="lg" onClick={submit} disabled={submitting || !acknowledged} data-testid="button-submit">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCheck className="w-4 h-4 mr-2" />}Submit Hiring Package
      </Button>
    </div>
  );
}

// ── Step 7: Status ────────────────────────────────────────────────────────────
function StatusStep({ token, status }: { token: string; status: string }) {
  const statusMap: Record<string, { icon: any; color: string; title: string; msg: string }> = {
    submitted: { icon: Clock, color: "text-blue-500", title: "Under Review", msg: "Your hiring package has been submitted and is under review." },
    under_review: { icon: Clock, color: "text-blue-500", title: "Under Review", msg: "Your hiring package has been submitted and is under review." },
    missing_documents: { icon: AlertCircle, color: "text-amber-500", title: "Action Required: Missing Documents", msg: "The employer has requested additional documents. Please upload the requested files." },
    approved_hired: { icon: CheckCircle2, color: "text-green-500", title: "Approved / Hired", msg: "Congratulations! Your application has been approved." },
    not_approved: { icon: X, color: "text-red-500", title: "Not Approved", msg: "Thank you for your application. Unfortunately we will not be moving forward at this time." },
    archived: { icon: FileText, color: "text-gray-500", title: "Archived", msg: "This hiring package has been archived." },
  };
  const s = statusMap[status] || { icon: Clock, color: "text-blue-500", title: "Submitted", msg: "Your hiring package has been submitted." };
  const Icon = s.icon;

  return (
    <div className="text-center py-10 space-y-6">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${s.color === "text-green-500" ? "bg-green-100" : s.color === "text-amber-500" ? "bg-amber-100" : s.color === "text-red-500" ? "bg-red-100" : "bg-blue-100"}`}>
        <Icon className={`w-9 h-9 ${s.color}`} />
      </div>
      <div>
        <h2 className="text-xl font-bold">{s.title}</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{s.msg}</p>
        <p className="text-xs text-muted-foreground mt-3">Please keep this link. You can return to this page to check your application status.</p>
        {status !== "not_approved" && status !== "archived" && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
            <Clock className="w-3.5 h-3.5" /> Current status: <strong>{s.title}</strong>
          </div>
        )}
      </div>
      {(status === "submitted" || status === "under_review" || status === "approved_hired") && (
        <Button variant="outline" onClick={() => { const a = document.createElement("a"); a.href = `/api/public/hiring-package/${token}/download-completed-pdf`; a.download = "completed-hiring-package.pdf"; a.click(); }} data-testid="button-download-completed-pdf">
          <Download className="w-4 h-4 mr-2" />Download Completed Hiring Package PDF
        </Button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HiringPackagePage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [step, setStep] = useState(1);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [personalInfo, setPersonalInfo] = useState<any>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<any>(null);
  const [medicalInfo, setMedicalInfo] = useState<any>(null);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/public/hiring-package", token],
    queryFn: () => apiRequest("GET", `/api/public/hiring-package/${token}`),
    retry: false,
  });

  // Hydrate from server on load
  useEffect(() => {
    if (!data) return;
    const sub = data.submission;
    const acceptances = data.acceptances || [];
    const docs = data.documents || [];
    setAcceptedIds(acceptances.map((a: any) => a.policyId));
    if (sub?.personalInfoJson) setPersonalInfo(sub.personalInfoJson);
    if (sub?.emergencyContactsJson) setEmergencyContacts(sub.emergencyContactsJson);
    if (sub?.medicalInfoJson) setMedicalInfo(sub.medicalInfoJson);
    setUploadedDocs(docs);
    if (sub?.status === "submitted" || sub?.status === "under_review" || sub?.status === "missing_documents" || sub?.status === "approved_hired" || sub?.status === "not_approved") {
      setSubmitted(true); setStep(7); return;
    }
    // Step recovery
    const policies: any[] = data.package?.policies || data.template?.policies || [];
    const required = policies.filter((p: any) => p.required !== false);
    const allPoliciesAccepted = required.every((p: any) => acceptances.some((a: any) => a.policyId === p.id));
    if (!allPoliciesAccepted) { setStep(1); return; }
    if (!sub?.personalInfoJson) { setStep(2); return; }
    if (!sub?.emergencyContactsJson) { setStep(3); return; }
    if (!sub?.medicalInfoJson && sub?.medicalInfoJson !== null) { setStep(4); return; }
    const requiredDocs = ["government_id_front", "government_id_back", "resume_cv"];
    const hasRequiredDocs = requiredDocs.every(k => docs.some((d: any) => d.documentType === k));
    if (!hasRequiredDocs) { setStep(5); return; }
    if (!sub?.signatureData) { setStep(6); return; }
    setStep(7);
  }, [data]);

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="space-y-3 w-64"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="font-semibold text-lg">Invalid or Expired Link</h2>
        <p className="text-sm text-muted-foreground">This hiring package link is invalid or has expired. Please contact your employer for a new link.</p>
      </div>
    </div>
  );

  const pkg = data.package || {};
  const policies: any[] = pkg.policies || data.template?.policies || [];
  const companyName = data.companyName || "Your Employer";
  const completedStep = step - 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-2">
        <div className="w-7 h-7 bg-primary rounded flex items-center justify-center"><span className="text-white text-xs font-bold">CF</span></div>
        <span className="font-semibold text-sm">ClockField</span>
        <span className="text-muted-foreground text-sm">·</span>
        <span className="text-sm text-muted-foreground">Hiring Package</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Hiring Package</h1>
          <p className="text-sm text-muted-foreground">For: {pkg.employeeName || "Applicant"} · {companyName}</p>
        </div>

        <StepIndicator current={step} completed={completedStep} />

        <div className="bg-white border rounded-xl p-5 sm:p-6 shadow-sm">
          {step === 1 && (
            <PoliciesStep policies={policies} acceptedIds={acceptedIds} token={token}
              onAccept={id => setAcceptedIds(p => [...p.filter(x => x !== id), id])}
              onAllAccepted={() => setStep(2)} />
          )}
          {step === 2 && (
            <PersonalInfoStep token={token} saved={personalInfo}
              onSaved={data => { setPersonalInfo(data); setStep(3); }} />
          )}
          {step === 3 && (
            <EmergencyContactsStep token={token} saved={emergencyContacts}
              onSaved={data => { setEmergencyContacts(data); setStep(4); }} />
          )}
          {step === 4 && (
            <MedicalInfoStep token={token} saved={medicalInfo}
              onSaved={data => { setMedicalInfo(data); setStep(5); }} />
          )}
          {step === 5 && (
            <DocumentUploadStep token={token} uploadedDocs={uploadedDocs}
              onUploaded={docs => setUploadedDocs(docs)}
              onContinue={() => setStep(6)} />
          )}
          {step === 6 && (
            <SignatureStep token={token} hasSig={!!data.submission?.signatureData}
              onSubmitted={() => { setSubmitted(true); setStep(7); }} />
          )}
          {step === 7 && (
            <StatusStep token={token} status={data.submission?.status || "submitted"} />
          )}
        </div>
      </div>
    </div>
  );
}
