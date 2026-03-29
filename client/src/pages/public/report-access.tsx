import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText, CheckCircle2, AlertTriangle, Clock, MapPin, Calendar,
  Building2, User, Pen, Loader2, Download, XCircle, RotateCcw
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  incident: "Incident Report", issue: "Issue Report", damage: "Damage Report",
  statement: "Statement Report", complaint: "Complaint Report", general: "General Report",
};
const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-blue-100 text-blue-700", medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", sent: "Sent", viewed: "Viewed",
  awaiting_signature: "Awaiting Signature", in_review: "In Review",
  finalized: "Finalized", archived: "Archived",
};

function fmt(d?: string | null) {
  if (!d) return null;
  try { return format(new Date(d), "MMMM d, yyyy"); } catch { return d; }
}

// ─── Signature Pad (draw mode) ────────────────────────────────────────────────
function SignaturePad({ onDataUrl }: { onDataUrl: (url: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const hasStrokes = useRef(false);

  function getPos(e: MouseEvent | PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? (e as any).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? (e as any).touches[0].clientY : (e as MouseEvent).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function start(e: PointerEvent) {
      if (e.button !== undefined && e.button !== 0) return;
      canvas!.setPointerCapture(e.pointerId);
      drawing.current = true;
      const pos = getPos(e, canvas!);
      lastPos.current = pos;
      const ctx = canvas!.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(pos.x / dpr, pos.y / dpr, 1.25, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
    }
    function move(e: PointerEvent) {
      if (!drawing.current) return;
      e.preventDefault();
      const pos = getPos(e, canvas!);
      const ctx = canvas!.getContext("2d")!;
      ctx.beginPath();
      if (lastPos.current) {
        ctx.moveTo(lastPos.current.x / dpr, lastPos.current.y / dpr);
      }
      ctx.lineTo(pos.x / dpr, pos.y / dpr);
      ctx.stroke();
      lastPos.current = pos;
      hasStrokes.current = true;
    }
    function stop() {
      if (!drawing.current) return;
      drawing.current = false;
      lastPos.current = null;
      if (hasStrokes.current) {
        onDataUrl(canvas!.toDataURL("image/png"));
      }
    }

    canvas.addEventListener("pointerdown", start, { passive: false });
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);

    return () => {
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", stop);
      canvas.removeEventListener("pointercancel", stop);
    };
  }, []);

  function clear() {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    hasStrokes.current = false;
    onDataUrl(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 touch-none overflow-hidden" style={{ height: 180 }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          style={{ touchAction: "none", display: "block" }}
          data-testid="canvas-signature-draw"
        />
        <p className="absolute inset-x-0 bottom-2 text-center text-xs text-slate-400 pointer-events-none select-none">
          Draw your signature above
        </p>
      </div>
      <Button variant="outline" size="sm" type="button" onClick={clear} className="text-xs">
        <RotateCcw className="w-3 h-3 mr-1.5" />Clear
      </Button>
    </div>
  );
}

// ─── Typed Signature Preview ─────────────────────────────────────────────────
function TypedSignaturePreview({ name }: { name: string }) {
  if (!name.trim()) return null;
  return (
    <div className="mt-3 rounded-lg border bg-white px-4 py-3">
      <p className="text-xs text-slate-500 mb-1">Signature preview</p>
      <p
        className="text-3xl text-slate-800 leading-tight"
        style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}
        data-testid="text-signature-preview"
      >
        {name}
      </p>
    </div>
  );
}

// ─── Report Section Row ───────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

// ─── Public Report Page ───────────────────────────────────────────────────────
export default function PublicReportAccess() {
  const { token } = useParams<{ token: string }>();
  const [signed, setSigned] = useState(false);
  const [signedData, setSignedData] = useState<{ signerName: string; signedAt: string } | null>(null);

  // Signature state
  const [signerName, setSignerName] = useState("");
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [drawnDataUrl, setDrawnDataUrl] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/public/reports", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/reports/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.message || "Not found"), { code: body.error });
      }
      return res.json();
    },
    retry: false,
  });

  const signMut = useMutation({
    mutationFn: async (payload: object) => {
      const res = await fetch(`/api/public/reports/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to sign");
      return body;
    },
    onSuccess: (body: any) => {
      setSignedData({ signerName: body.signerName, signedAt: body.signedAt });
      setSigned(true);
    },
  });

  function handleSubmitSignature() {
    if (!signerName.trim()) return;
    if (sigMode === "drawn" as any || sigMode === "draw") {
      if (!drawnDataUrl) return;
      signMut.mutate({ signerName: signerName.trim(), signatureType: "drawn", signatureDataUrl: drawnDataUrl, acknowledgementText: "I confirm I have reviewed this report." });
    } else {
      signMut.mutate({ signerName: signerName.trim(), signatureType: "typed", acknowledgementText: "I confirm I have reviewed this report." });
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading report…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !data) {
    const code = (error as any)?.code;
    const msg = code === "revoked" || code === "archived"
      ? "This report link is no longer available. Please contact the sender."
      : "This report link is not valid or has expired. Please contact the sender for a new link.";
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Link Unavailable</h1>
          <p className="text-sm text-slate-500">{msg}</p>
        </div>
      </div>
    );
  }

  const { report, company, location, employee, client, signatures, access } = data;
  const canSign = access.permissions.includes("sign") && !access.alreadySigned && !signed;
  const alreadySigned = access.alreadySigned || signed;
  const typeLabel = TYPE_LABELS[report.reportType] || "Report";

  // ── Signed success state ───────────────────────────────────────────────────
  if (signed && signedData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Report Signed Successfully</h1>
          <p className="text-sm text-slate-500 mb-1">Your signature has been recorded.</p>
          <p className="text-xs text-slate-400">Signed by {signedData.signerName} · {fmt(signedData.signedAt)}</p>
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-400">Powered by <span className="font-semibold text-slate-600">ClockField</span></p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main report view ───────────────────────────────────────────────────────
  const attachments: Array<{ url: string; type: string; name: string }> = (() => {
    try { return JSON.parse(report.attachments || "[]"); } catch { return []; }
  })();
  const imageAttachments = attachments.filter(a => a.type?.startsWith("image") || a.url?.startsWith("data:image"));

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ── Header card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Logo / company bar */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center gap-3">
            {company?.companyLogoUrl ? (
              <img src={company.companyLogoUrl} alt={company.name} className="h-10 w-auto object-contain rounded" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-slate-400" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-800">{company?.name || "ClockField"}</p>
              <p className="text-xs text-slate-500">Secure Report</p>
            </div>
          </div>

          {/* Report title / meta */}
          <div className="px-6 pt-5 pb-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
              {report.severity && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLOR[report.severity] || "bg-slate-100 text-slate-700"}`}>
                  {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)} severity
                </span>
              )}
              {alreadySigned && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />Signed
                </Badge>
              )}
              {!alreadySigned && canSign && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                  <Pen className="w-3 h-3 mr-1" />Signature Required
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-4">{report.title}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              {report.incidentDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{fmt(report.incidentDate)}{report.incidentTime ? ` at ${report.incidentTime}` : ""}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{location.name}{location.address ? ` · ${location.address}` : ""}</span>
                </div>
              )}
              {(employee || client) && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>
                    {employee ? `${employee.firstName} ${employee.lastName}` : ""}
                    {employee && client ? " / " : ""}
                    {client ? (client.contactName || client.name) : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Created {fmt(report.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Report details ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 space-y-0">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />Report Details
          </h2>
          <Field label="Summary" value={report.summary} />
          <Field label="Area Affected" value={report.areaAffected} />
          <Field label="Immediate Action Taken" value={report.immediateAction} />
          <Field label="Witnesses" value={report.witnesses} />
          <Field label="Item Affected" value={report.itemAffected} />
          <Field label="Item Description" value={report.itemDescription} />
          <Field label="Damage Type" value={report.damageType} />
          {report.estimatedCost && <Field label="Estimated Cost" value={`$${report.estimatedCost}`} />}
          {report.workStopped && <Field label="Work Stopped" value="Yes" />}
          {report.customerInformed && <Field label="Customer Informed" value="Yes" />}
          <Field label="Corrective Action" value={report.correctiveAction} />
          <Field label="Final Decision" value={report.finalDecision} />
          <Field label="Next Steps" value={report.nextSteps} />
          {!report.summary && !report.areaAffected && !report.immediateAction && !report.correctiveAction && (
            <p className="text-sm text-slate-400 py-2">No additional details.</p>
          )}
        </div>

        {/* ── Employee statement ── */}
        {report.employeeStatement && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Employee Statement</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.employeeStatement}</p>
          </div>
        )}

        {/* ── Client comments ── */}
        {report.clientComments && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Client Comments</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.clientComments}</p>
          </div>
        )}

        {/* ── Photo attachments ── */}
        {imageAttachments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Photos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {imageAttachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                  <img src={a.url} alt={a.name || `Photo ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-slate-200 hover:opacity-90 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Existing signatures ── */}
        {signatures.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Signatures</h2>
            <div className="space-y-4">
              {signatures.map((sig: any, i: number) => (
                <div key={i} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{sig.signerName}</p>
                      <p className="text-xs text-slate-400 capitalize">{sig.signerRole} · {fmt(sig.signedAt)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Signed
                    </Badge>
                  </div>
                  {sig.signatureType === "drawn" && sig.signatureDataUrl && (
                    <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-2">
                      <img src={sig.signatureDataUrl} alt="Signature" className="h-16 w-auto max-w-full object-contain" />
                    </div>
                  )}
                  {sig.signatureType === "typed" && (
                    <p className="text-2xl text-slate-700 mt-1" style={{ fontFamily: "'Dancing Script', cursive" }}>
                      {sig.signerName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Already signed banner ── */}
        {alreadySigned && !signed && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">This report has already been signed.</p>
          </div>
        )}

        {/* ── Signature section ── */}
        {canSign && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <Pen className="w-4 h-4" />Sign this Report
              </h2>
              <p className="text-xs text-slate-500">Please review the report above and add your signature below.</p>
            </div>

            {signMut.isError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{(signMut.error as any)?.message || "An error occurred. Please try again."}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Full name input */}
              <div>
                <Label htmlFor="signer-name" className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Full Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="signer-name"
                  placeholder="Enter your full name"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  className="text-sm"
                  data-testid="input-signer-name"
                />
              </div>

              {/* Signature mode tabs */}
              <div>
                <Label className="text-xs font-medium text-slate-700 mb-1.5 block">Signature</Label>
                <Tabs value={sigMode} onValueChange={v => setSigMode(v as "draw" | "type")}>
                  <TabsList className="mb-3 h-9">
                    <TabsTrigger value="draw" className="text-xs px-4" data-testid="tab-draw-signature">Draw</TabsTrigger>
                    <TabsTrigger value="type" className="text-xs px-4" data-testid="tab-type-signature">Type</TabsTrigger>
                  </TabsList>
                  <TabsContent value="draw">
                    <SignaturePad onDataUrl={setDrawnDataUrl} />
                  </TabsContent>
                  <TabsContent value="type">
                    <Input
                      placeholder="Type your full name"
                      value={signerName}
                      onChange={e => setSignerName(e.target.value)}
                      className="text-sm"
                      data-testid="input-typed-signature"
                    />
                    <TypedSignaturePreview name={signerName} />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Agreement text */}
              <p className="text-xs text-slate-400">
                By submitting your signature, you confirm that you have read and reviewed this report.
              </p>

              {/* Submit */}
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  onClick={handleSubmitSignature}
                  disabled={
                    signMut.isPending ||
                    !signerName.trim() ||
                    (sigMode === "draw" && !drawnDataUrl)
                  }
                  data-testid="button-submit-signature"
                >
                  {signMut.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
                    : <><CheckCircle2 className="w-4 h-4 mr-2" />Submit Signature</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-400">
            This is a secure report shared via <span className="font-medium text-slate-500">ClockField</span>
          </p>
        </div>
      </div>
    </div>
  );
}
