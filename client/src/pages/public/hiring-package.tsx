import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check, CheckCircle2, ChevronDown, ChevronRight, AlertCircle, Building2,
  FileText, User, Phone, Clipboard, Pen, RotateCcw, Upload, X,
  Clock, Printer, AlertTriangle, Lock, Shield, Image, FileIcon,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const STEPS = ["Policies", "Personal Info", "Emergency Contacts", "Medical Info", "Documents", "Signature"];

const DOC_TYPES: { key: string; label: string; required: boolean; accept: string; allowedExts: string[]; hint: string }[] = [
  {
    key: "government_id_front",
    label: "Government ID (Front)",
    required: true,
    accept: ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf",
    allowedExts: ["jpg","jpeg","png","pdf"],
    hint: "Driver's licence, passport, or government-issued ID — front side. JPG, PNG, or PDF.",
  },
  {
    key: "government_id_back",
    label: "Government ID (Back)",
    required: true,
    accept: ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf",
    allowedExts: ["jpg","jpeg","png","pdf"],
    hint: "Back of the same government-issued ID. JPG, PNG, or PDF.",
  },
  {
    key: "resume_cv",
    label: "Resume / CV",
    required: true,
    accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    allowedExts: ["pdf","doc","docx"],
    hint: "PDF, DOC, or DOCX — max 10 MB.",
  },
  {
    key: "work_permit",
    label: "Work Permit",
    required: false,
    accept: ".jpg,.jpeg,.png,.pdf,.doc,.docx,image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    allowedExts: ["jpg","jpeg","png","pdf","doc","docx"],
    hint: "If applicable — leave blank if not required.",
  },
  {
    key: "certificate_license",
    label: "Certificate / Licence",
    required: false,
    accept: ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf",
    allowedExts: ["jpg","jpeg","png","pdf"],
    hint: "Safety training, professional licence, or any relevant certificate.",
  },
  {
    key: "other_supporting_document",
    label: "Other Supporting Document",
    required: false,
    accept: ".jpg,.jpeg,.png,.pdf,.doc,.docx,image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    allowedExts: ["jpg","jpeg","png","pdf","doc","docx"],
    hint: "Any other document you would like to include.",
  },
];

const SUBMITTED_STATUSES = ["submitted", "under_review", "missing_documents", "approved", "not_approved", "fired_inactive", "archived", "completed"];

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  submitted:         { label: "Under Review",              color: "text-amber-800",  bg: "bg-amber-50",  border: "border-amber-200", icon: Clock },
  under_review:      { label: "Under Review",              color: "text-amber-800",  bg: "bg-amber-50",  border: "border-amber-200", icon: Clock },
  missing_documents: { label: "Action Required: Missing Documents", color: "text-orange-800", bg: "bg-orange-50", border: "border-orange-300", icon: AlertTriangle },
  approved:          { label: "Approved / Hired",          color: "text-green-800",  bg: "bg-green-50",  border: "border-green-200", icon: CheckCircle2 },
  not_approved:      { label: "Not Approved",              color: "text-red-800",    bg: "bg-red-50",    border: "border-red-200",   icon: X },
  fired_inactive:    { label: "Fired / Inactive",          color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200",  icon: X },
  archived:          { label: "Archived",                  color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200",  icon: FileText },
  completed:         { label: "Under Review",              color: "text-amber-800",  bg: "bg-amber-50",  border: "border-amber-200", icon: Clock },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Signature Canvas ───────────────────────────────────────────────────────────
function SignatureCanvas({ onSign }: { onSign: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const pt = "touches" in e ? e.touches[0] : e;
    return { x: pt.clientX - rect.left, y: pt.clientY - rect.top };
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    lastPos.current = getPos(e, canvas);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  }

  function stopDrawing() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current!;
    onSign(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSign("");
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden" style={{ height: 140 }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
          onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-gray-400 flex items-center gap-2"><Pen className="w-4 h-4" /> Draw your signature here</p>
          </div>
        )}
      </div>
      {hasSignature && (
        <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 h-7" onClick={clear}>
          <RotateCcw className="w-3.5 h-3.5" /> Clear &amp; Re-sign
        </Button>
      )}
    </div>
  );
}

// ── Upload Slot ────────────────────────────────────────────────────────────────
function UploadSlot({
  docType, label, required, accept, allowedExts, hint, file, onFile, disabled,
}: {
  docType: string; label: string; required: boolean; accept: string; allowedExts: string[]; hint: string;
  file?: { filename: string; mimeType: string; size: number; data: string } | null;
  onFile: (docType: string, file: { filename: string; mimeType: string; size: number; data: string } | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function isFileTypeAllowed(f: File): boolean {
    // Primary: check file extension (works even when browser reports empty MIME)
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (allowedExts.includes(ext)) return true;
    // Fallback: check MIME type when extension check fails (e.g. mobile cameras)
    if (!f.type) return false;
    const mime = f.type.toLowerCase();
    if (allowedExts.some(e => ["jpg","jpeg"].includes(e)) && mime.includes("jpeg")) return true;
    if (allowedExts.includes("png") && mime === "image/png") return true;
    if (allowedExts.includes("gif") && mime === "image/gif") return true;
    if (allowedExts.includes("pdf") && mime === "application/pdf") return true;
    if (allowedExts.includes("doc") && mime === "application/msword") return true;
    if (allowedExts.includes("docx") && mime.includes("wordprocessingml")) return true;
    return false;
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadError(null);

    if (!isFileTypeAllowed(f)) {
      const extList = allowedExts.map(x => x.toUpperCase()).join(", ");
      setUploadError(`File type not supported. Please upload: ${extList}.`);
      e.target.value = "";
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 10 MB.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    try {
      const data = await readFileAsDataUrl(f);
      // Preserve MIME type — some mobile browsers return empty string; infer from extension
      let mimeType = f.type;
      if (!mimeType) {
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        const extMime: Record<string, string> = {
          jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
          pdf: "application/pdf", doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        mimeType = extMime[ext] || "application/octet-stream";
      }
      onFile(docType, { filename: f.name, mimeType, size: f.size, data });
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  const isImage = file?.mimeType?.startsWith("image/");

  return (
    <div className={`rounded-xl border p-4 transition-colors ${uploadError ? "border-red-200 bg-red-50/30" : file ? "border-green-200 bg-green-50/30" : "border-dashed border-gray-300 bg-gray-50/50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${uploadError ? "bg-red-100" : file ? "bg-green-100" : "bg-gray-100"}`}>
            {uploadError ? <AlertCircle className="w-4 h-4 text-red-500" /> : file ? <Check className="w-4 h-4 text-green-600" /> : isImage ? <Image className="w-4 h-4 text-gray-400" /> : <FileIcon className="w-4 h-4 text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">
              {label} {required && <span className="text-red-500">*</span>}
            </p>
            {uploadError ? (
              <p className="text-xs text-red-600 mt-0.5">{uploadError}</p>
            ) : file ? (
              <p className="text-xs text-green-700 mt-0.5 truncate">{file.filename} ({fileSizeLabel(file.size)})</p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {file && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
              onClick={() => { onFile(docType, null); setUploadError(null); }} disabled={disabled}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant={file ? "outline" : "default"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => { setUploadError(null); inputRef.current?.click(); }}
            disabled={disabled || loading}
            data-testid={`button-upload-${docType}`}
          >
            {loading ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {file ? "Replace" : "Upload"}
          </Button>
        </div>
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
    </div>
  );
}

// ── Step Progress Bar ─────────────────────────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < current ? "bg-blue-500" : i === current ? "bg-blue-400" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// ── Status Page ────────────────────────────────────────────────────────────────
function StatusPage({ status, company, employeeName, completedAt, missingDocsMessage }: {
  status: string; company: any; employeeName: string; completedAt?: string | null; missingDocsMessage?: string | null;
}) {
  const meta = STATUS_DISPLAY[status] || STATUS_DISPLAY.submitted;
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-5 ${meta.bg} ${meta.border}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
            <Icon className={`w-5 h-5 ${meta.color}`} />
          </div>
          <div className="flex-1">
            <p className={`font-semibold text-base ${meta.color}`}>{meta.label}</p>
            {status === "missing_documents" && missingDocsMessage ? (
              <div className="mt-2">
                <p className="text-sm font-medium text-orange-800 mb-1">Message from your employer:</p>
                <p className="text-sm text-orange-700 leading-relaxed whitespace-pre-line">{missingDocsMessage}</p>
              </div>
            ) : status === "approved" ? (
              <p className="text-sm mt-1 text-green-700">Congratulations! Your hiring package has been reviewed and approved. Your employer will contact you with next steps.</p>
            ) : status === "not_approved" ? (
              <p className="text-sm mt-1 text-red-700">After reviewing your application, the employer has decided not to proceed. Please contact your employer if you have questions.</p>
            ) : (
              <div className="mt-1 space-y-1">
                <p className="text-sm text-amber-700">Your hiring package has been submitted and is under review.</p>
                <p className="text-sm text-amber-600">Please keep this link. You can return to check your application status.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Application Summary</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium text-gray-900">{employeeName}</span></div>
          {completedAt && <div className="flex justify-between"><span className="text-gray-500">Submitted</span><span className="font-medium text-gray-900">{new Date(completedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</span></div>}
          <div className="flex justify-between"><span className="text-gray-500">Employer</span><span className="font-medium text-gray-900">{company?.name || "Your Employer"}</span></div>
        </div>
      </div>

      <Button variant="outline" className="w-full gap-2" onClick={() => window.print()} data-testid="button-print-copy">
        <Printer className="w-4 h-4" /> Print / Download Copy
      </Button>
    </div>
  );
}

// ── Main Public Page ───────────────────────────────────────────────────────────
export default function PublicHiringPackage() {
  const [, params] = useRoute("/public/hiring-package/:token");
  const token = params?.token || "";

  const { data: pkg, isLoading, error } = useQuery<any>({
    queryKey: ["/api/public/hiring-packages", token],
    queryFn: () => fetch(`/api/public/hiring-packages/${token}`).then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); }),
    enabled: !!token,
    retry: false,
  });

  // Step state
  const [step, setStep] = useState(0);
  const [policyStep, setPolicyStep] = useState(0);
  const [policyAcceptances, setPolicyAcceptances] = useState<any[]>([]);

  // Form state
  const [form, setForm] = useState({
    firstName: "", lastName: "", preferredName: "", email: "", phone: "",
    address: "", city: "", province: "", postalCode: "", country: "Canada",
    jobTitle: "", startDate: "",
  });
  const [ec1, setEc1] = useState({ name: "", relationship: "", phone: "", email: "" });
  const [ec2, setEc2] = useState({ name: "", relationship: "", phone: "", email: "" });
  const [medical, setMedical] = useState({ allergies: "", sensitivities: "", medicalNotes: "", medicationNote: "" });
  const [docFiles, setDocFiles] = useState<Record<string, { filename: string; mimeType: string; size: number; data: string } | null>>({});
  const [agreedToAck, setAgreedToAck] = useState(false);
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const sections = (Array.isArray(pkg?.templateData) ? pkg.templateData : []).filter((s: any) => s.enabled !== false);
  const company = pkg?.company || {};
  const isAlreadySubmitted = SUBMITTED_STATUSES.includes(pkg?.status || "");

  // Pre-fill form from package data + restore saved document uploads
  useEffect(() => {
    if (pkg && !submitted) {
      const nameParts = (pkg.employeeName || "").split(" ");
      setForm(prev => ({
        ...prev,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: pkg.employeeEmail || "",
        phone: pkg.employeePhone || "",
        jobTitle: pkg.jobTitle || "",
        startDate: pkg.startDate || "",
      }));
      // Restore previously uploaded documents from saved progress
      const savedDocFiles = (pkg.employeeResponse as any)?.documentFiles;
      if (savedDocFiles && typeof savedDocFiles === "object") {
        setDocFiles(prev => {
          const merged: typeof prev = { ...prev };
          for (const [key, val] of Object.entries(savedDocFiles)) {
            if (val && typeof val === "object" && (val as any).data) {
              merged[key] = val as any;
            }
          }
          return merged;
        });
      }
    }
  }, [pkg]);

  // Mark as "started" once employee begins interacting
  useEffect(() => {
    if (pkg && !isAlreadySubmitted && !submitted) {
      fetch(`/api/public/hiring-packages/${token}/save-progress`, { method: "POST" }).catch(() => {});
    }
  }, [pkg]);

  // Persist uploaded document files to server so they survive a page refresh
  async function persistDocFiles(updatedDocs: typeof docFiles) {
    if (!token || isAlreadySubmitted) return;
    const documentFiles: Record<string, any> = {};
    DOC_TYPES.forEach(d => {
      if (updatedDocs[d.key]) documentFiles[d.key] = updatedDocs[d.key];
    });
    try {
      await fetch(`/api/public/hiring-packages/${token}/save-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentFiles }),
      });
    } catch {
      // non-fatal — files are still in local state
    }
  }

  function acceptPolicy(section: any) {
    const acceptance = {
      sectionId: section.id,
      title: section.title,
      contentSnapshot: section.content || "",
      acceptedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    const newAcceptances = [...policyAcceptances, acceptance];
    setPolicyAcceptances(newAcceptances);
    if (policyStep < sections.length - 1) {
      setPolicyStep(policyStep + 1);
    }
  }

  function allPoliciesAccepted() {
    return policyAcceptances.length >= sections.length;
  }

  function isPolicyAccepted(section: any) {
    return policyAcceptances.some(a => a.sectionId === section.id);
  }

  function handleDocFile(docType: string, file: { filename: string; mimeType: string; size: number; data: string } | null) {
    setDocFiles(prev => {
      const updated = { ...prev, [docType]: file };
      persistDocFiles(updated);
      return updated;
    });
  }

  function validateStep(s: number): string[] {
    const errs: string[] = [];
    if (s === 0) {
      if (!allPoliciesAccepted()) errs.push("Please accept all policies before continuing.");
    }
    if (s === 1) {
      if (!form.firstName.trim()) errs.push("First name is required.");
      if (!form.lastName.trim()) errs.push("Last name is required.");
      if (!form.phone.trim()) errs.push("Phone number is required.");
    }
    if (s === 2) {
      if (!ec1.name.trim()) errs.push("Emergency Contact 1 name is required.");
      if (!ec1.phone.trim()) errs.push("Emergency Contact 1 phone is required.");
    }
    if (s === 4) {
      const required = DOC_TYPES.filter(d => d.required);
      required.forEach(d => {
        if (!docFiles[d.key]) errs.push(`${d.label} is required.`);
      });
    }
    if (s === 5) {
      if (!agreedToAck) errs.push("Please check the acknowledgement checkbox.");
      if (!signature) errs.push("Please draw your signature before submitting.");
    }
    return errs;
  }

  function goNext() {
    const errs = validateStep(step);
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setErrors([]);
    setStep(s => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    const errs = validateStep(5);
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);
    try {
      const documentFiles: Record<string, any> = {};
      DOC_TYPES.forEach(d => {
        if (docFiles[d.key]) documentFiles[d.key] = docFiles[d.key];
      });

      const employeeResponse = {
        firstName: form.firstName,
        lastName: form.lastName,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        preferredName: form.preferredName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        city: form.city,
        province: form.province,
        postalCode: form.postalCode,
        country: form.country,
        jobTitle: form.jobTitle,
        startDate: form.startDate,
        emergencyContact1: ec1,
        emergencyContact2: ec2,
        allergies: medical.allergies,
        sensitivities: medical.sensitivities,
        medicalNotes: medical.medicalNotes,
        medicationNote: medical.medicationNote,
        documentFiles,
        completedAt: new Date().toISOString(),
      };

      const r = await fetch(`/api/public/hiring-packages/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeResponse, policyAcceptances, signatureData: signature }),
      });
      if (!r.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch (e: any) {
      setErrors(["Submission failed. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-8 w-2/3 rounded-xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Package Not Found</h1>
          <p className="text-gray-500 text-sm">This hiring package link may be invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const showStatusPage = submitted || isAlreadySubmitted;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {company.logoUrl && (
            <img src={company.logoUrl} alt={company.name} className="h-8 w-8 rounded-lg object-contain border shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{company.name || "Employer"}</p>
            <p className="text-xs text-gray-500">Employee Hiring Package</p>
          </div>
          {showStatusPage ? (
            <Badge className={`text-xs px-2 py-0.5 rounded-full ${STATUS_DISPLAY[pkg.status]?.bg || "bg-amber-50"} ${STATUS_DISPLAY[pkg.status]?.color || "text-amber-800"} border ${STATUS_DISPLAY[pkg.status]?.border || "border-amber-200"}`}>
              {STATUS_DISPLAY[pkg.status]?.label || "Submitted"}
            </Badge>
          ) : (
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded-full">
              Step {step + 1} of {STEPS.length}
            </Badge>
          )}
        </div>
        {!showStatusPage && (
          <div className="max-w-2xl mx-auto px-4 pb-3">
            <StepBar current={step} total={STEPS.length} />
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24">

        {/* Status page */}
        {showStatusPage && (
          <>
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-5">
              <h1 className="text-xl font-bold mb-1">Application Status</h1>
              <p className="text-blue-100 text-sm">Welcome back, {pkg.employeeName || "there"}. Here is your current status.</p>
            </div>
            <StatusPage
              status={pkg.status}
              company={company}
              employeeName={pkg.employeeName}
              completedAt={pkg.completedAt}
              missingDocsMessage={pkg.missingDocsMessage}
            />
          </>
        )}

        {/* ── STEP 0: POLICIES ────────────────────────────────────────────── */}
        {!showStatusPage && step === 0 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-5">
              <h1 className="text-xl font-bold mb-1">
                Welcome, {form.firstName || pkg.employeeName || "New Employee"}!
              </h1>
              <p className="text-blue-100 text-sm leading-relaxed">
                Please read and accept each company policy before filling in your personal information. You must accept every policy to proceed.
              </p>
              {pkg.jobTitle && (
                <p className="text-blue-200 text-sm mt-2 font-medium">{pkg.jobTitle}{pkg.startDate ? ` · Start Date: ${pkg.startDate}` : ""}</p>
              )}
            </div>

            {/* Policy progress */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Company Policies
              </h2>
              <span className="text-xs text-gray-500 font-medium">
                {policyAcceptances.length} of {sections.length} accepted
              </span>
            </div>

            {/* Policy list */}
            <div className="space-y-3">
              {sections.map((section: any, idx: number) => {
                const accepted = isPolicyAccepted(section);
                const isCurrent = idx === policyStep && !accepted;
                const isLocked = idx > policyStep && !accepted;

                return (
                  <div
                    key={section.id || idx}
                    className={`rounded-xl border overflow-hidden transition-all ${
                      accepted ? "border-green-200 bg-green-50/30" :
                      isCurrent ? "border-blue-300 bg-white shadow-sm" :
                      "border-gray-200 bg-gray-50 opacity-60"
                    }`}
                  >
                    {/* Section header */}
                    <div className="flex items-center gap-3 p-4">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        accepted ? "bg-green-100 text-green-700" :
                        isCurrent ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-400"
                      }`}>
                        {accepted ? <Check className="w-3.5 h-3.5" /> : isLocked ? <Lock className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className={`flex-1 font-medium text-sm leading-snug ${accepted ? "text-green-800" : isCurrent ? "text-gray-900" : "text-gray-400"}`}>
                        {section.title}
                      </span>
                      {accepted && <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0 h-5 rounded-full">Accepted</Badge>}
                      {isLocked && <Lock className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                    </div>

                    {/* Current policy: show full content + accept button */}
                    {isCurrent && (
                      <div className="border-t px-4 pb-4">
                        <div className="max-h-72 overflow-y-auto bg-white rounded-lg border border-gray-100 p-4 mt-3">
                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{section.content}</p>
                        </div>
                        <div className="mt-4 bg-blue-50 rounded-xl border border-blue-200 p-3">
                          <p className="text-xs text-blue-700 leading-relaxed">
                            By clicking agree, you confirm that you have reviewed this policy and understand that it forms part of your employment file.
                          </p>
                        </div>
                        <Button
                          className="w-full mt-3 h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 gap-2"
                          onClick={() => acceptPolicy(section)}
                          data-testid={`button-accept-policy-${idx}`}
                        >
                          <Check className="w-4 h-4" /> I have read, understood, and agree to this policy.
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {allPoliciesAccepted() && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">All policies accepted</p>
                  <p className="text-xs text-green-700">You can now proceed to fill in your personal information.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: PERSONAL INFO ─────────────────────────────────────── */}
        {!showStatusPage && step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" /> Personal Information
              </h2>
              <p className="text-sm text-gray-500 mt-1">Please provide your personal details as they appear on your government-issued ID.</p>
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Legal First Name *</Label>
                    <Input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                      placeholder="Jane" className="mt-1 h-9 text-sm" data-testid="input-firstName" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Legal Last Name *</Label>
                    <Input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                      placeholder="Smith" className="mt-1 h-9 text-sm" data-testid="input-lastName" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Preferred Name (optional)</Label>
                    <Input value={form.preferredName} onChange={e => setForm(p => ({ ...p, preferredName: e.target.value }))}
                      placeholder="What you like to be called" className="mt-1 h-9 text-sm" data-testid="input-preferredName" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Email</Label>
                    <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="jane@example.com" type="email" className="mt-1 h-9 text-sm" data-testid="input-email" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Phone Number *</Label>
                    <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="(555) 000-0000" type="tel" className="mt-1 h-9 text-sm" data-testid="input-phone" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Job Title / Position</Label>
                    <Input value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))}
                      placeholder="Cleaning Technician" className="mt-1 h-9 text-sm" data-testid="input-jobTitle" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Start Date</Label>
                    <Input value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                      type="date" className="mt-1 h-9 text-sm" data-testid="input-startDate" />
                  </div>
                </div>
                <div className="pt-1 border-t">
                  <p className="text-xs font-medium text-gray-600 mb-2">Home Address</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-gray-500">Street Address</Label>
                      <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                        placeholder="123 Main Street" className="mt-1 h-9 text-sm" data-testid="input-address" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">City</Label>
                      <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                        placeholder="Toronto" className="mt-1 h-9 text-sm" data-testid="input-city" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Province / State</Label>
                      <Input value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))}
                        placeholder="Ontario" className="mt-1 h-9 text-sm" data-testid="input-province" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Postal Code</Label>
                      <Input value={form.postalCode} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))}
                        placeholder="M5V 3A8" className="mt-1 h-9 text-sm" data-testid="input-postalCode" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Country</Label>
                      <Input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                        placeholder="Canada" className="mt-1 h-9 text-sm" data-testid="input-country" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STEP 2: EMERGENCY CONTACTS ────────────────────────────────── */}
        {!showStatusPage && step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600" /> Emergency Contacts
              </h2>
              <p className="text-sm text-gray-500 mt-1">Provide at least one emergency contact. This information will only be used in the event of an emergency.</p>
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Emergency Contact 1 <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Full Name *</Label>
                    <Input value={ec1.name} onChange={e => setEc1(p => ({ ...p, name: e.target.value }))}
                      placeholder="Contact name" className="mt-1 h-9 text-sm" data-testid="input-ec1-name" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Relationship</Label>
                    <Input value={ec1.relationship} onChange={e => setEc1(p => ({ ...p, relationship: e.target.value }))}
                      placeholder="e.g. Spouse, Parent" className="mt-1 h-9 text-sm" data-testid="input-ec1-relationship" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Phone *</Label>
                    <Input value={ec1.phone} onChange={e => setEc1(p => ({ ...p, phone: e.target.value }))}
                      placeholder="(555) 000-0000" type="tel" className="mt-1 h-9 text-sm" data-testid="input-ec1-phone" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Email (optional)</Label>
                    <Input value={ec1.email} onChange={e => setEc1(p => ({ ...p, email: e.target.value }))}
                      placeholder="contact@email.com" type="email" className="mt-1 h-9 text-sm" data-testid="input-ec1-email" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Emergency Contact 2 <span className="text-gray-400 font-normal">(Optional)</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Full Name</Label>
                    <Input value={ec2.name} onChange={e => setEc2(p => ({ ...p, name: e.target.value }))}
                      placeholder="Contact name" className="mt-1 h-9 text-sm" data-testid="input-ec2-name" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Relationship</Label>
                    <Input value={ec2.relationship} onChange={e => setEc2(p => ({ ...p, relationship: e.target.value }))}
                      placeholder="e.g. Sibling, Friend" className="mt-1 h-9 text-sm" data-testid="input-ec2-relationship" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Phone</Label>
                    <Input value={ec2.phone} onChange={e => setEc2(p => ({ ...p, phone: e.target.value }))}
                      placeholder="(555) 000-0000" type="tel" className="mt-1 h-9 text-sm" data-testid="input-ec2-phone" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Email (optional)</Label>
                    <Input value={ec2.email} onChange={e => setEc2(p => ({ ...p, email: e.target.value }))}
                      placeholder="contact@email.com" type="email" className="mt-1 h-9 text-sm" data-testid="input-ec2-email" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STEP 3: MEDICAL INFO ──────────────────────────────────────── */}
        {!showStatusPage && step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" /> Medical Information
                <Badge className="bg-gray-100 text-gray-600 font-normal text-xs">Optional</Badge>
              </h2>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold">Confidentiality Notice:</span> The information you provide in this section will be held in the strictest confidence and will only be shared on a need-to-know basis with authorized personnel. This form is not intended to request or investigate your personal medical history. The information is being collected only to help respond to an emergency, safety concern, allergy, sensitivity, or medical situation that may occur at work.
              </p>
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-gray-500">Allergies</Label>
                  <Input value={medical.allergies} onChange={e => setMedical(p => ({ ...p, allergies: e.target.value }))}
                    placeholder="e.g. Latex, nuts, penicillin — or 'None known'" className="mt-1 h-9 text-sm" data-testid="input-allergies" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Sensitivities</Label>
                  <Input value={medical.sensitivities} onChange={e => setMedical(p => ({ ...p, sensitivities: e.target.value }))}
                    placeholder="e.g. Bleach, strong scents, dust — or 'None'" className="mt-1 h-9 text-sm" data-testid="input-sensitivities" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Medical Notes Relevant to Workplace Safety</Label>
                  <Textarea value={medical.medicalNotes} onChange={e => setMedical(p => ({ ...p, medicalNotes: e.target.value }))}
                    placeholder="Any conditions or restrictions relevant to safe performance of your job (optional)" className="mt-1 text-sm min-h-[70px] resize-none" data-testid="input-medicalNotes" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Special Medication Note (optional)</Label>
                  <Input value={medical.medicationNote} onChange={e => setMedical(p => ({ ...p, medicationNote: e.target.value }))}
                    placeholder="Any prescribed medication that may affect work performance" className="mt-1 h-9 text-sm" data-testid="input-medicationNote" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STEP 4: DOCUMENTS ─────────────────────────────────────────── */}
        {!showStatusPage && step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" /> Document Upload
              </h2>
              <p className="text-sm text-gray-500 mt-1">Upload clear copies of the required documents. Government ID must show both sides.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed">
              <span className="font-medium">Privacy Notice:</span> The documents you upload will be kept confidential and used only for employment review, identity verification, onboarding, and employment record purposes. Access is limited to authorized company personnel.
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required Documents</p>
              {DOC_TYPES.filter(d => d.required).map(d => (
                <UploadSlot key={d.key} {...d} file={docFiles[d.key] || null} onFile={handleDocFile} />
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Optional Documents</p>
              {DOC_TYPES.filter(d => !d.required).map(d => (
                <UploadSlot key={d.key} {...d} file={docFiles[d.key] || null} onFile={handleDocFile} />
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 5: SIGNATURE ─────────────────────────────────────────── */}
        {!showStatusPage && step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Pen className="w-5 h-5 text-blue-600" /> Final Acknowledgement &amp; Signature
              </h2>
            </div>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-800 leading-relaxed">
                    I confirm that the information I provided is accurate to the best of my knowledge. I confirm that I have read, understood, and agreed to all required company policies in this hiring package. I understand that this hiring package and all accepted policies may become part of my confidential employment file.
                  </p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                  <Checkbox
                    id="ack-checkbox"
                    checked={agreedToAck}
                    onCheckedChange={v => setAgreedToAck(!!v)}
                    className="mt-0.5"
                    data-testid="checkbox-acknowledge"
                  />
                  <label htmlFor="ack-checkbox" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                    I agree and confirm all of the above.
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Digital Signature</p>
                  <p className="text-xs text-gray-500 mb-3">Please draw your signature in the box below using your mouse or finger on mobile.</p>
                  <SignatureCanvas onSign={setSignature} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1" data-testid="validation-errors">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {e}
              </p>
            ))}
          </div>
        )}

      </div>

      {/* Footer nav */}
      {!showStatusPage && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-20">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            {step > 0 && (
              <Button variant="outline" className="flex-1 h-11" onClick={goBack}>
                Back
              </Button>
            )}
            {step === 0 && (
              <Button
                className="flex-1 h-11 font-semibold"
                onClick={goNext}
                disabled={!allPoliciesAccepted()}
                data-testid="button-continue-to-personal"
              >
                Continue to Personal Information
              </Button>
            )}
            {step > 0 && step < 5 && (
              <Button className="flex-1 h-11 font-semibold" onClick={goNext} data-testid={`button-next-step-${step}`}>
                {step === 3 ? "Continue to Documents" : step === 4 ? "Continue to Signature" : "Continue"}
              </Button>
            )}
            {step === 5 && (
              <Button
                className="flex-1 h-11 font-semibold bg-green-600 hover:bg-green-700"
                onClick={handleSubmit}
                disabled={submitting || !agreedToAck || !signature}
                data-testid="button-submit-package"
              >
                {submitting
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block" />Submitting…</>
                  : <><Check className="w-5 h-5 mr-2" /> Submit Hiring Package</>}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
