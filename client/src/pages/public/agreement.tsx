import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, FileSignature, XCircle, Loader2, RotateCw, Download } from "lucide-react";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

// ── Signature Canvas ─────────────────────────────────────────────────────────
function SignatureCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as MouseEvent).clientX - rect.left) * scaleX, y: ((e as MouseEvent).clientY - rect.top) * scaleY };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function start(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawing.current = true;
      const { x, y } = getPos(e, canvas!);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    function move(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (!drawing.current) return;
      const { x, y } = getPos(e, canvas!);
      ctx.lineTo(x, y);
      ctx.stroke();
      hasDrawn.current = true;
    }
    function end(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (!drawing.current) return;
      drawing.current = false;
      if (hasDrawn.current) onChange(canvas!.toDataURL("image/png"));
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, [onChange]);

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden" style={{ height: 140 }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={280}
          className="w-full h-full touch-none cursor-crosshair"
          data-testid="canvas-signature"
          style={{ display: "block" }}
        />
        <span className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-xs text-gray-400 select-none">
          Sign here using your mouse or finger
        </span>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clear} className="gap-1.5" data-testid="button-clear-signature">
        <RotateCw className="w-3.5 h-3.5" /> Clear
      </Button>
    </div>
  );
}

// ── Public Agreement Page ─────────────────────────────────────────────────────
export default function PublicAgreement() {
  const params = useParams<{ token: string }>();
  const [agreed, setAgreed] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [witnessName, setWitnessName] = useState("");
  const [witnessContact, setWitnessContact] = useState("");
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ agreement: any; business: any }>({
    queryKey: ["/api/public/agreements", params.token],
    queryFn: () => apiRequest("GET", `/api/public/agreements/${params.token}`).then(r => r.json()),
  });

  const signMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/public/agreements/${params.token}/sign`, body).then(r => r.json()),
    onSuccess: () => setDone(true),
    onError: (e: any) => setError(e?.message || "Failed to submit signature. Please try again."),
  });

  const declineMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/public/agreements/${params.token}/decline`, {}).then(r => r.json()),
    onSuccess: () => setDeclined(true),
    onError: () => setError("Could not process your response. Please try again."),
  });

  function handleSign() {
    setError(null);
    if (!signerName.trim()) { setError("Please enter your full name."); return; }
    if (!signatureImage) { setError("Please draw your signature above."); return; }
    if (!agreed) { setError("Please check the agreement confirmation box."); return; }
    signMutation.mutate({ signerName, signatureImage, witnessName, witnessContact, witnessSignature, agreed });
  }

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );

  if (isError || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold mb-1">Agreement Not Found</h1>
        <p className="text-sm text-muted-foreground">This link may be invalid or expired.</p>
      </div>
    </div>
  );

  const { agreement: agr, business } = data;
  const isSigned = agr.status === "signed" || agr.status === "completed";
  const isDeclined = agr.status === "declined";

  if (done || isSigned) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md w-full text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Agreement Signed</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Thank you{agr.signerName ? `, ${agr.signerName}` : ""}. Your signature has been recorded.
          {agr.signedAt ? ` Signed on ${fmtDate(agr.signedAt)}.` : ""}
        </p>
        <p className="text-xs text-muted-foreground">You may close this tab. A copy will be provided by {business?.name || "the service provider"}.</p>
      </div>
    </div>
  );

  if (declined || isDeclined) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md w-full text-center">
        <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Agreement Declined</h1>
        <p className="text-sm text-muted-foreground">You have declined this agreement. Please contact {business?.name || "the service provider"} if you have questions.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header branding */}
        <div className="text-center mb-6">
          {business?.logo && <img src={business.logo} alt={business?.name} className="h-10 mx-auto mb-3 object-contain" />}
          <h1 className="text-2xl font-bold">{agr.title}</h1>
          {business?.name && <p className="text-sm text-muted-foreground mt-1">Prepared by {business.name}</p>}
        </div>

        {/* Agreement content */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{agr.content}</div>
            </div>
          </div>
        </div>

        {/* Signing section */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-primary" /> Client Signature
            </h2>
            <p className="text-xs text-muted-foreground">Please complete all fields below to sign this agreement.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-xs mb-1 block font-medium">Full Name *</Label>
              <Input data-testid="input-signer-name" value={signerName} onChange={e => setSignerName(e.target.value)}
                placeholder="Your full legal name" className="h-10" />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block font-medium">Signature *</Label>
            <SignatureCanvas onChange={setSignatureImage} />
          </div>

          {/* Witness section */}
          {agr.witnessEnabled && (
            <div className="border-t pt-5 space-y-4">
              <h3 className="text-sm font-semibold">Witness Signature</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1 block">Witness Full Name</Label>
                  <Input data-testid="input-witness-name" value={witnessName} onChange={e => setWitnessName(e.target.value)} placeholder="Witness name" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Witness Phone / Email</Label>
                  <Input data-testid="input-witness-contact" value={witnessContact} onChange={e => setWitnessContact(e.target.value)} placeholder="Contact info" />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Witness Signature</Label>
                <SignatureCanvas onChange={setWitnessSignature} />
              </div>
            </div>
          )}

          {/* Agreement checkbox */}
          <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
            <Checkbox id="agreed" checked={agreed} onCheckedChange={v => setAgreed(!!v)}
              className="mt-0.5 shrink-0" data-testid="checkbox-agreed" />
            <Label htmlFor="agreed" className="text-sm leading-relaxed cursor-pointer">
              I have read and understood this agreement in its entirety, and I agree to be bound by its terms and conditions.
            </Label>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button data-testid="button-sign-agreement" onClick={handleSign} disabled={signMutation.isPending} className="gap-1.5 flex-1 sm:flex-none">
              {signMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
              Sign Agreement
            </Button>
            <Button variant="outline" data-testid="button-decline-agreement"
              onClick={() => { if (confirm("Are you sure you want to decline this agreement?")) declineMutation.mutate(); }}
              disabled={declineMutation.isPending} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
              {declineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Decline
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Your signature timestamp, name, and IP address will be recorded for verification purposes.</p>
        </div>
      </div>
    </div>
  );
}
