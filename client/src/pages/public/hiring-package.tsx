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
  Check, CheckCircle2, AlertCircle, Building2,
  FileText, User, Phone, Pen, Upload, X,
  Clock, Printer, AlertTriangle, Lock, Shield, Image, FileIcon,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const STEPS = ["Policies", "Personal Info", "Emergency Contacts", "Medical Info", "Documents", "Signature"];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const DOC_TYPES: { key: string; label: string; required: boolean; accept: string; allowedExts: string[]; hint: string }[] = [
  {
    key: "government_id_front",
    label: "Government ID (Front)",
    required: true,
    accept: ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf",
    allowedExts: ["jpg","jpeg","png","pdf"],
    hint: "Driver's licence, passport, or government-issued ID — front side. JPG, PNG, or PDF. Max 25 MB.",
  },
  {
    key: "government_id_back",
    label: "Government ID (Back)",
    required: true,
    accept: ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf",
    allowedExts: ["jpg","jpeg","png","pdf"],
    hint: "Back of the same government-issued ID. JPG, PNG, or PDF. Max 25 MB.",
  },
  {
    key: "resume_cv",
    label: "Resume / CV",
    required: true,
    accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    allowedExts: ["pdf","doc","docx"],
    hint: "PDF, DOC, or DOCX — max 25 MB.",
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
function SignatureCanvas({ onSign, existingSignature }: { onSign: (data: string) => void; existingSignature?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(!!existingSignature);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // If there's an existing signature, restore it
    if (existingSignature) {
      const img = new window.Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = existingSignature;
    }
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function stopDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasDrawn || canvasRef.current) {
      const data = canvasRef.current!.toDataURL("image/png");
      onSign(data);
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSign("");
  }

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white touch-none relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full block cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          data-testid="canvas-signature"
        />
        {!hasDrawn && !existingSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm select-none flex items-center gap-2">
              <Pen className="w-4 h-4" /> Sign here with your mouse or finger
            </p>
          </div>
        )}
      </div>
      {(hasDrawn || existingSignature) && (
        <Button variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-red-500 gap-1.5" onClick={clearCanvas}
          data-testid="button-clear-signature">
          <X className="w-3 h-3" /> Clear signature
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
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (allowedExts.includes(ext)) return true;
    if (!f.type) return false;
    const mime = f.type.toLowerCase();
    if (allowedExts.some(e => ["jpg","jpeg"].includes(e)) && mime.includes("jpeg")) return true;
    if (allowedExts.includes("png") && mime === "image/png") return true;
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
    if (f.size > MAX_FILE_BYTES) {
      setUploadError("File is too large. Maximum size is 25 MB.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    try {
      const data = await readFileAsDataUrl(f);
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
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < current ? "bg-blue-500" : i === current ? "bg-blue-400" : "bg-gray-200"}`} />
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
    staleTime: 0,
  });

  // ── Local state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [policyStep, setPolicyStep] = useState(0);
  const [policyAcceptances, setPolicyAcceptances] = useState<any[]>([]);

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

  const hasRestoredRef = useRef(false);

  const sections = (Array.isArray(pkg?.templateData) ? pkg.templateData : []).filter((s: any) => s.enabled !== false);
  const company = pkg?.company || {};
  const isAlreadySubmitted = SUBMITTED_STATUSES.includes(pkg?.status || "");

  // ── Restore ALL saved progress when pkg loads ─────────────────────────────
  useEffect(() => {
    if (!pkg || submitted || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const resp = (pkg.employeeResponse as any) || null;
    const savedPolicies = Array.isArray(pkg.policyAcceptances) ? pkg.policyAcceptances : [];
    const nameParts = (pkg.employeeName || "").split(" ");

    // ── Restore form ──────────────────────────────────────────────────────
    setForm({
      firstName:     resp?.firstName     || nameParts[0] || "",
      lastName:      resp?.lastName      || nameParts.slice(1).join(" ") || "",
      preferredName: resp?.preferredName || "",
      email:         resp?.email         || pkg.employeeEmail || "",
      phone:         resp?.phone         || pkg.employeePhone || "",
      address:       resp?.address       || pkg.employeeAddress || "",
      city:          resp?.city          || "",
      province:      resp?.province      || "",
      postalCode:    resp?.postalCode    || "",
      country:       resp?.country       || "Canada",
      jobTitle:      resp?.jobTitle      || pkg.jobTitle || "",
      startDate:     resp?.startDate     || pkg.startDate || "",
    });

    // ── Restore emergency contacts ────────────────────────────────────────
    if (resp?.emergencyContact1) setEc1(resp.emergencyContact1);
    if (resp?.emergencyContact2) setEc2(resp.emergencyContact2);

    // ── Restore medical ───────────────────────────────────────────────────
    if (resp) {
      setMedical({
        allergies:     resp.allergies     || "",
        sensitivities: resp.sensitivities || "",
        medicalNotes:  resp.medicalNotes  || "",
        medicationNote: resp.medicationNote || "",
      });
    }

    // ── Restore uploaded documents ────────────────────────────────────────
    const savedDocFiles = resp?.documentFiles;
    if (savedDocFiles && typeof savedDocFiles === "object") {
      const restored: typeof docFiles = {};
      for (const [key, val] of Object.entries(savedDocFiles)) {
        if (val && typeof val === "object" && (val as any).data) {
          restored[key] = val as any;
        }
      }
      setDocFiles(restored);
    }

    // ── Restore signature ─────────────────────────────────────────────────
    const savedSig = pkg.signatureData || resp?.signatureData || "";
    if (savedSig) setSignature(savedSig);

    // ── Restore policy acceptances ────────────────────────────────────────
    if (savedPolicies.length > 0) {
      setPolicyAcceptances(savedPolicies);
      // Advance policyStep to the first unaccepted policy (or last if all done)
      const secs = (Array.isArray(pkg.templateData) ? pkg.templateData : []).filter((s: any) => s.enabled !== false);
      const acceptedIds = new Set(savedPolicies.map((a: any) => a.sectionId));
      const firstUnacceptedIdx = secs.findIndex((s: any) => !acceptedIds.has(s.id));
      setPolicyStep(firstUnacceptedIdx === -1 ? Math.max(0, secs.length - 1) : firstUnacceptedIdx);
    }

    // ── Restore step ──────────────────────────────────────────────────────
    // Prefer explicitly saved currentStep, else infer from progress
    if (typeof resp?.currentStep === "number" && resp.currentStep > 0) {
      setStep(resp.currentStep);
    } else if (savedPolicies.length > 0) {
      const secs = (Array.isArray(pkg.templateData) ? pkg.templateData : []).filter((s: any) => s.enabled !== false);
      const allAccepted = secs.length > 0 && savedPolicies.length >= secs.length;
      if (allAccepted) setStep(1); // At minimum move past policies
    }
  }, [pkg]);

  // ── Core save-progress function ──────────────────────────────────────────
  const saveProgress = useCallback(async (overrides: {
    currentStep?: number;
    newPolicies?: any[];
    newSignature?: string;
    formOverride?: typeof form;
    ec1Override?: typeof ec1;
    ec2Override?: typeof ec2;
    medicalOverride?: typeof medical;
  } = {}) => {
    if (!token || isAlreadySubmitted) return;
    const currentFormData = overrides.formOverride ?? form;
    const currentEc1 = overrides.ec1Override ?? ec1;
    const currentEc2 = overrides.ec2Override ?? ec2;
    const currentMedical = overrides.medicalOverride ?? medical;
    const currentStep_ = overrides.currentStep ?? step;
    const currentPolicies = overrides.newPolicies ?? policyAcceptances;
    const currentSig = overrides.newSignature ?? signature;

    try {
      await fetch(`/api/public/hiring-packages/${token}/save-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: currentStep_,
          policyStep,
          policyAcceptances: currentPolicies,
          employeeResponse: {
            firstName: currentFormData.firstName,
            lastName: currentFormData.lastName,
            fullName: `${currentFormData.firstName} ${currentFormData.lastName}`.trim(),
            preferredName: currentFormData.preferredName,
            email: currentFormData.email,
            phone: currentFormData.phone,
            address: currentFormData.address,
            city: currentFormData.city,
            province: currentFormData.province,
            postalCode: currentFormData.postalCode,
            country: currentFormData.country,
            jobTitle: currentFormData.jobTitle,
            startDate: currentFormData.startDate,
            emergencyContact1: currentEc1,
            emergencyContact2: currentEc2,
            allergies: currentMedical.allergies,
            sensitivities: currentMedical.sensitivities,
            medicalNotes: currentMedical.medicalNotes,
            medicationNote: currentMedical.medicationNote,
          },
          ...(currentSig ? { signatureData: currentSig } : {}),
        }),
      });
    } catch {
      // non-fatal
    }
  }, [token, isAlreadySubmitted, form, ec1, ec2, medical, step, policyStep, policyAcceptances, signature]);

  // ── Persist uploaded document files ─────────────────────────────────────
  async function persistDocFiles(updatedDocs: typeof docFiles) {
    if (!token || isAlreadySubmitted) return;
    const documentFiles: Record<string, any> = {};
    DOC_TYPES.forEach(d => {
      if (updatedDocs[d.key]) documentFiles[d.key] = updatedDocs[d.key];
      else documentFiles[d.key] = null; // explicitly remove deleted files
    });
    try {
      await fetch(`/api/public/hiring-packages/${token}/save-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentFiles }),
      });
    } catch { /* non-fatal */ }
  }

  // ── Policy acceptance ─────────────────────────────────────────────────────
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
    const nextIdx = policyStep < sections.length - 1 ? policyStep + 1 : policyStep;
    setPolicyStep(nextIdx);
    // Save immediately to backend
    saveProgress({ newPolicies: newAcceptances });
  }

  function allPoliciesAccepted() { return policyAcceptances.length >= sections.length; }
  function isPolicyAccepted(section: any) { return policyAcceptances.some(a => a.sectionId === section.id); }

  // ── Document file handler ─────────────────────────────────────────────────
  function handleDocFile(docType: string, file: { filename: string; mimeType: string; size: number; data: string } | null) {
    // Compute the update outside the state setter to avoid calling async code inside React's updater
    const updatedDocs = { ...docFiles, [docType]: file };
    setDocFiles(updatedDocs);
    persistDocFiles(updatedDocs);
  }

  // ── Signature handler ─────────────────────────────────────────────────────
  function handleSign(data: string) {
    setSignature(data);
    if (data) {
      saveProgress({ newSignature: data });
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validateStep(s: number): string[] {
    const errs: string[] = [];
    if (s === 0 && !allPoliciesAccepted()) errs.push("Please accept all policies before continuing.");
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
      DOC_TYPES.filter(d => d.required).forEach(d => {
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
    const nextStep = step + 1;
    setStep(nextStep);
    // Save all current state including the new step
    saveProgress({ currentStep: nextStep });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setErrors([]);
    const prevStep = Math.max(0, step - 1);
    setStep(prevStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Final submission ──────────────────────────────────────────────────────
  async function handleSubmit() {
    const errs = validateStep(5);
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);
    try {
      const documentFiles: Record<string, any> = {};
      DOC_TYPES.forEach(d => { if (docFiles[d.key]) documentFiles[d.key] = docFiles[d.key]; });

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
    } catch {
      setErrors(["Submission failed. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / Error ───────────────────────────────────────────────────────
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

        {/* ── STATUS PAGE ─────────────────────────────────────────────── */}
        {showStatusPage && (
          <>
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-5">
              <h1 className="text-xl font-bold mb-1">Application Status</h1>
              <p className="text-blue-100 text-sm">Welcome back, {pkg.employeeName || "there"}. Here is your current status.</p>
            </div>
            <StatusPage
              status={submitted ? "submitted" : pkg.status}
              company={company}
              employeeName={pkg.employeeName}
              completedAt={pkg.completedAt}
              missingDocsMessage={pkg.missingDocsMessage}
            />
          </>
        )}

        {/* ── STEP 0: POLICIES ────────────────────────────────────────── */}
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

            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Company Policies
              </h2>
              <span className="text-xs text-gray-500 font-medium">
                {policyAcceptances.length} of {sections.length} accepted
              </span>
            </div>

            <div className="space-y-3">
              {sections.map((section: any, idx: number) => {
                const accepted = isPolicyAccepted(section);
                const isCurrent = idx === policyStep && !accepted;
                const isLocked = idx > policyStep && !accepted;

                return (
                  <div key={section.id || idx}
                    className={`rounded-xl border overflow-hidden transition-all ${
                      accepted ? "border-green-200 bg-green-50/30" :
                      isCurrent ? "border-blue-300 bg-white shadow-sm" :
                      "border-gray-200 bg-gray-50 opacity-60"
                    }`}
                  >
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

        {/* ── STEP 1: PERSONAL INFO ──────────────────────────────────── */}
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

        {/* ── STEP 2: EMERGENCY CONTACTS ─────────────────────────────── */}
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

        {/* ── STEP 3: MEDICAL INFO ───────────────────────────────────── */}
        {!showStatusPage && step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" /> Medical Information
              </h2>
              <p className="text-sm text-gray-500 mt-1">This section is optional. Please share only what is relevant to your workplace safety or emergency response. All information is confidential.</p>
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-gray-500">Allergies (optional)</Label>
                  <Textarea value={medical.allergies} onChange={e => setMedical(p => ({ ...p, allergies: e.target.value }))}
                    placeholder="e.g. Peanuts, latex, penicillin" className="mt-1 text-sm min-h-[60px] resize-none" data-testid="input-allergies" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Sensitivities or Chemical Reactions (optional)</Label>
                  <Textarea value={medical.sensitivities} onChange={e => setMedical(p => ({ ...p, sensitivities: e.target.value }))}
                    placeholder="e.g. Sensitivity to bleach or strong scents" className="mt-1 text-sm min-h-[60px] resize-none" data-testid="input-sensitivities" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Medical Notes (optional)</Label>
                  <Textarea value={medical.medicalNotes} onChange={e => setMedical(p => ({ ...p, medicalNotes: e.target.value }))}
                    placeholder="Any relevant medical information your employer should be aware of in an emergency" className="mt-1 text-sm min-h-[60px] resize-none" data-testid="input-medicalNotes" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Medication Note (optional)</Label>
                  <Textarea value={medical.medicationNote} onChange={e => setMedical(p => ({ ...p, medicationNote: e.target.value }))}
                    placeholder="Any medication that may affect work performance or emergency response" className="mt-1 text-sm min-h-[60px] resize-none" data-testid="input-medicationNote" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STEP 4: DOCUMENTS ─────────────────────────────────────── */}
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

        {/* ── STEP 5: SIGNATURE ─────────────────────────────────────── */}
        {!showStatusPage && step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Pen className="w-5 h-5 text-blue-600" /> Review & Sign
              </h2>
              <p className="text-sm text-gray-500 mt-1">Review the summary below, draw your signature, and submit your hiring package.</p>
            </div>

            {/* Summary */}
            <Card>
              <CardContent className="p-4 space-y-3 text-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</p>
                <div className="grid grid-cols-2 gap-2 text-gray-700">
                  <div><span className="text-gray-400 text-xs block">Name</span>{form.firstName} {form.lastName}</div>
                  {form.phone && <div><span className="text-gray-400 text-xs block">Phone</span>{form.phone}</div>}
                  {form.email && <div><span className="text-gray-400 text-xs block">Email</span>{form.email}</div>}
                  {form.jobTitle && <div><span className="text-gray-400 text-xs block">Position</span>{form.jobTitle}</div>}
                </div>
                <div className="pt-2 border-t flex gap-4 flex-wrap text-xs">
                  <span className="flex items-center gap-1 text-green-700">
                    <Check className="w-3.5 h-3.5" /> {policyAcceptances.length} polic{policyAcceptances.length === 1 ? "y" : "ies"} accepted
                  </span>
                  <span className="flex items-center gap-1 text-green-700">
                    <Check className="w-3.5 h-3.5" /> {Object.values(docFiles).filter(Boolean).length} document{Object.values(docFiles).filter(Boolean).length === 1 ? "" : "s"} uploaded
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Signature */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Your Signature <span className="text-red-500">*</span></Label>
              <p className="text-xs text-gray-500">Draw your signature below using your mouse or finger on mobile.</p>
              <SignatureCanvas onSign={handleSign} existingSignature={signature || undefined} />
            </div>

            {/* Acknowledgement */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="ack"
                  checked={agreedToAck}
                  onCheckedChange={v => setAgreedToAck(v as boolean)}
                  data-testid="checkbox-ack"
                />
                <Label htmlFor="ack" className="text-sm text-blue-900 leading-relaxed cursor-pointer">
                  I confirm that the information I provided is accurate to the best of my knowledge. I confirm that I have read, understood, and agreed to all required company policies in this hiring package. I understand that this hiring package and all accepted policies may become part of my confidential employment file.
                </Label>
              </div>
            </div>
          </div>
        )}

        {/* ── ERROR DISPLAY ──────────────────────────────────────────── */}
        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {e}
              </p>
            ))}
          </div>
        )}

        {/* ── NAVIGATION ────────────────────────────────────────────── */}
        {!showStatusPage && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 z-10">
            <div className="max-w-2xl mx-auto flex gap-3">
              {step > 0 && (
                <Button variant="outline" className="flex-1 h-11" onClick={goBack} data-testid="button-back">
                  Back
                </Button>
              )}
              {step < 5 ? (
                <Button
                  className="flex-1 h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700"
                  onClick={goNext}
                  disabled={step === 0 && !allPoliciesAccepted()}
                  data-testid="button-next"
                >
                  {step === 0 ? "Continue to Personal Information" :
                   step === 1 ? "Continue to Emergency Contacts" :
                   step === 2 ? "Continue to Medical Information" :
                   step === 3 ? "Continue to Documents" :
                   "Continue to Signature"}
                </Button>
              ) : (
                <Button
                  className="flex-1 h-11 text-sm font-semibold bg-green-600 hover:bg-green-700"
                  onClick={handleSubmit}
                  disabled={submitting}
                  data-testid="button-submit"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : "Submit Hiring Package"}
                </Button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
