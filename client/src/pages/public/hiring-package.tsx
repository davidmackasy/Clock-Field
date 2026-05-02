import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronDown, ChevronRight, CheckCircle2, Printer, AlertCircle,
  Building2, FileText, User, Phone, MapPin, ClipboardList, Pen,
  RotateCcw, Check,
} from "lucide-react";

// ── Signature Canvas ──────────────────────────────────────────────────────────
function SignatureCanvas({ onSign, existingDataUrl }: { onSign: (data: string) => void; existingDataUrl?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [hasSignature, setHasSignature] = useState(!!existingDataUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (existingDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = existingDataUrl;
    }
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

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSign("");
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden" style={{ height: 120 }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
          onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-gray-400 flex items-center gap-2"><Pen className="w-4 h-4" /> Sign here</p>
          </div>
        )}
      </div>
      {hasSignature && (
        <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 h-7" onClick={clearCanvas}>
          <RotateCcw className="w-3.5 h-3.5" /> Clear signature
        </Button>
      )}
    </div>
  );
}

// ── Policy Section ─────────────────────────────────────────────────────────────
function PolicySection({ section, index }: { section: any; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
        data-testid={`button-expand-section-${index}`}
      >
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-700 text-xs font-bold">
          {index + 1}
        </div>
        <span className="flex-1 font-medium text-gray-800 text-sm leading-snug">{section.title}</span>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t bg-gray-50">
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed pt-4">{section.content}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Public Page ──────────────────────────────────────────────────────────
export default function PublicHiringPackage() {
  const [, params] = useRoute("/public/hiring-package/:token");
  const token = params?.token || "";

  const { data: pkg, isLoading, error } = useQuery<any>({
    queryKey: ["/api/public/hiring-packages", token],
    queryFn: () => fetch(`/api/public/hiring-packages/${token}`).then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); }),
    enabled: !!token,
    retry: false,
  });

  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", address: "", jobTitle: "", startDate: "",
    emergencyContact1: { name: "", relationship: "", phone: "" },
    emergencyContact2: { name: "", relationship: "", phone: "" },
    allergies: "", medicalNotes: "",
  });
  const [signature, setSignature] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  useEffect(() => {
    if (pkg && !submitted) {
      setForm(prev => ({
        ...prev,
        fullName: pkg.employeeName || "",
        email: pkg.employeeEmail || "",
        phone: pkg.employeePhone || "",
        address: pkg.employeeAddress || "",
        jobTitle: pkg.jobTitle || "",
        startDate: pkg.startDate || "",
      }));
      if (pkg.status === "completed" && pkg.employeeResponse) {
        const r = pkg.employeeResponse as any;
        setForm({
          fullName: r.fullName || pkg.employeeName || "",
          email: r.email || pkg.employeeEmail || "",
          phone: r.phone || pkg.employeePhone || "",
          address: r.address || pkg.employeeAddress || "",
          jobTitle: r.jobTitle || pkg.jobTitle || "",
          startDate: r.startDate || pkg.startDate || "",
          emergencyContact1: r.emergencyContact1 || { name: "", relationship: "", phone: "" },
          emergencyContact2: r.emergencyContact2 || { name: "", relationship: "", phone: "" },
          allergies: r.allergies || "",
          medicalNotes: r.medicalNotes || "",
        });
        setSubmitted(true);
      }
    }
  }, [pkg]);

  const submitMutation = useMutation({
    mutationFn: () => fetch(`/api/public/hiring-packages/${token}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeResponse: { ...form, completedAt: new Date().toISOString() }, signatureData: signature }),
    }).then(r => r.json()),
    onSuccess: () => setSubmitted(true),
  });

  function validate() {
    const errors: string[] = [];
    if (!form.fullName.trim()) errors.push("Full name is required.");
    if (!form.phone.trim()) errors.push("Phone number is required.");
    if (!form.emergencyContact1.name.trim()) errors.push("Emergency Contact 1 name is required.");
    if (!form.emergencyContact1.phone.trim()) errors.push("Emergency Contact 1 phone is required.");
    if (!signature) errors.push("Please sign the form before submitting.");
    return errors;
  }

  function handleSubmit() {
    const errors = validate();
    if (errors.length > 0) { setFormErrors(errors); return; }
    setFormErrors([]);
    submitMutation.mutate();
  }

  function setEC(n: 1 | 2, field: string, value: string) {
    const key = `emergencyContact${n}` as "emergencyContact1" | "emergencyContact2";
    setForm(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function printPage() { window.print(); }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
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

  const sections = (Array.isArray(pkg.templateData) ? pkg.templateData : []).filter((s: any) => s.enabled !== false);
  const company = pkg.company || {};
  const isCompleted = submitted || pkg.status === "completed";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {company.logoUrl && (
            <img src={company.logoUrl} alt={company.name} className="h-9 w-9 rounded-lg object-contain border" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{company.name || "Employer"}</p>
            <p className="text-xs text-gray-500">Employee Hiring Package</p>
          </div>
          {isCompleted && (
            <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Completed
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-20">

        {/* Welcome card */}
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0">
          <CardContent className="p-5">
            <h1 className="text-xl font-bold mb-1">
              {isCompleted ? "Package Completed" : `Welcome, ${form.fullName || pkg.employeeName || "New Employee"}!`}
            </h1>
            <p className="text-blue-100 text-sm leading-relaxed">
              {isCompleted
                ? `You completed this hiring package${pkg.completedAt ? ` on ${new Date(pkg.completedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}` : ""}. A copy can be printed below.`
                : `Please read each policy below, fill in your personal information, provide emergency contacts, and sign the form. Your submission is secure and legally binding.`}
            </p>
            {pkg.jobTitle && <p className="text-blue-200 text-sm mt-2 font-medium">{pkg.jobTitle}{pkg.startDate ? ` · Start Date: ${pkg.startDate}` : ""}</p>}
          </CardContent>
        </Card>

        {/* Policy sections */}
        {sections.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Company Policies
            </h2>
            {sections.map((s: any, i: number) => (
              <PolicySection key={s.id || i} section={s} index={i} />
            ))}
          </div>
        )}

        {/* Personal Info */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <User className="w-4 h-4" /> Personal Information
          </h2>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Full Name *</Label>
                  <Input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                    placeholder="Your full legal name" className="mt-1 h-9 text-sm" disabled={isCompleted}
                    data-testid="input-fullName" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="your@email.com" type="email" className="mt-1 h-9 text-sm" disabled={isCompleted}
                    data-testid="input-email" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Phone *</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="(555) 000-0000" type="tel" className="mt-1 h-9 text-sm" disabled={isCompleted}
                    data-testid="input-phone" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Job Title</Label>
                  <Input value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))}
                    placeholder="Cleaning Technician" className="mt-1 h-9 text-sm" disabled={isCompleted}
                    data-testid="input-jobTitle" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Start Date</Label>
                  <Input value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                    type="date" className="mt-1 h-9 text-sm" disabled={isCompleted}
                    data-testid="input-startDate" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Home Address</Label>
                <Textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main St, City, Province, Postal Code" className="mt-1 text-sm min-h-[60px] resize-none" disabled={isCompleted}
                  data-testid="input-address" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Emergency Contacts */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Phone className="w-4 h-4" /> Emergency Contacts
          </h2>
          {[1, 2].map(n => (
            <Card key={n}>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Contact {n} {n === 1 ? "*" : "(Optional)"}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Name {n === 1 ? "*" : ""}</Label>
                    <Input value={(form as any)[`emergencyContact${n}`].name}
                      onChange={e => setEC(n as 1 | 2, "name", e.target.value)}
                      placeholder="Contact name" className="mt-1 h-9 text-sm" disabled={isCompleted}
                      data-testid={`input-ec${n}-name`} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Relationship</Label>
                    <Input value={(form as any)[`emergencyContact${n}`].relationship}
                      onChange={e => setEC(n as 1 | 2, "relationship", e.target.value)}
                      placeholder="e.g. Spouse, Parent" className="mt-1 h-9 text-sm" disabled={isCompleted}
                      data-testid={`input-ec${n}-relationship`} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Phone {n === 1 ? "*" : ""}</Label>
                    <Input value={(form as any)[`emergencyContact${n}`].phone}
                      onChange={e => setEC(n as 1 | 2, "phone", e.target.value)}
                      placeholder="(555) 000-0000" type="tel" className="mt-1 h-9 text-sm" disabled={isCompleted}
                      data-testid={`input-ec${n}-phone`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Medical Info */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Medical Information <span className="text-gray-400 font-normal text-xs">(Optional)</span>
          </h2>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Allergies / Sensitivities</Label>
                <Input value={form.allergies} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))}
                  placeholder="e.g. Latex, bleach, nuts — or 'None'" className="mt-1 h-9 text-sm" disabled={isCompleted}
                  data-testid="input-allergies" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Medical Notes</Label>
                <Textarea value={form.medicalNotes} onChange={e => setForm(p => ({ ...p, medicalNotes: e.target.value }))}
                  placeholder="Any medical conditions relevant to work (optional)" className="mt-1 text-sm min-h-[60px] resize-none" disabled={isCompleted}
                  data-testid="input-medicalNotes" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Acknowledgement & Signature */}
        {!isCompleted && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Pen className="w-4 h-4" /> Acknowledgement & Signature
            </h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  By signing below, I confirm that I have read and understood all policies in this hiring package, and I agree to comply with all terms and conditions of employment described above.
                </p>
                <SignatureCanvas onSign={setSignature} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Completed signature display */}
        {isCompleted && pkg.signatureData && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Pen className="w-4 h-4" /> Your Signature
            </h2>
            <Card>
              <CardContent className="p-4">
                <div className="border rounded-xl p-3 bg-gray-50 inline-block">
                  <img src={pkg.signatureData} alt="Your signature" className="max-h-24 max-w-xs" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Validation errors */}
        {formErrors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1" data-testid="validation-errors">
            {formErrors.map((e, i) => (
              <p key={i} className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {e}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        {!isCompleted ? (
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            data-testid="button-submit-package"
          >
            {submitMutation.isPending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block" />Submitting…</>
              : <><Check className="w-5 h-5 mr-2" /> Submit Hiring Package</>}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Package Submitted Successfully</p>
                <p className="text-green-700 text-xs mt-1">Your employer has been notified. You can print a copy for your records.</p>
              </div>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={printPage} data-testid="button-print-copy">
              <Printer className="w-4 h-4" /> Print / Download PDF
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
