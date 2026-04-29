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

// ── Structured Content Renderer ───────────────────────────────────────────────
function SectionBlock({ number, title, children }: { number: string; title: string; children: JSX.Element | JSX.Element[] | string | null }) {
  return (
    <div className="mb-5">
      <h3 className="font-bold text-sm text-gray-900 mb-1.5">{number}. {title}</h3>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function StructuredAgreementContent({ sections, agr, business }: { sections: any; agr: any; business: any }) {
  const p = sections.parties?.provider || {};
  const c = sections.parties?.client || {};
  const providerName = p.companyName || business?.name || "Service Provider";
  const clientName = c.companyName || agr.clientName || "Client";
  const dateGenerated = agr.createdAt ? new Date(agr.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "";

  const overviewText = sections.overview ||
    `This Service Agreement is entered into as of ${dateGenerated} between ${providerName} ("Service Provider") and ${clientName} ("Client").`;

  return (
    <div className="space-y-1 text-sm">
      {/* Parties */}
      {(p.companyName || c.companyName) && (
        <div className="grid grid-cols-2 gap-6 bg-gray-50 rounded-xl p-4 mb-6 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 mb-1.5">Service Provider</p>
            {p.companyName && <p className="font-semibold">{p.companyName}</p>}
            {p.address && <p className="text-gray-600">{p.address}</p>}
            {(p.city || p.province) && <p className="text-gray-600">{[p.city, p.province, p.postalCode].filter(Boolean).join(", ")}</p>}
            {p.email && <p className="text-gray-600">{p.email}</p>}
            {p.phone && <p className="text-gray-600">{p.phone}</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 mb-1.5">Client</p>
            {c.companyName && <p className="font-semibold">{c.companyName}</p>}
            {c.contactPerson && <p className="text-gray-600">{c.contactPerson}</p>}
            {c.address && <p className="text-gray-600">{c.address}</p>}
            {(c.city || c.province) && <p className="text-gray-600">{[c.city, c.province, c.postalCode].filter(Boolean).join(", ")}</p>}
            {c.email && <p className="text-gray-600">{c.email}</p>}
          </div>
        </div>
      )}

      <SectionBlock number="1" title="Agreement Overview">
        <p>{overviewText}</p>
      </SectionBlock>

      {sections.scopeOfWork && (
        <SectionBlock number="2" title="Scope of Work">
          <p className="whitespace-pre-wrap">{sections.scopeOfWork}</p>
        </SectionBlock>
      )}

      {(sections.schedule?.frequency || sections.schedule?.startDate) && (
        <SectionBlock number="3" title="Service Schedule">
          <p>
            Services will be performed {sections.schedule.frequency}
            {sections.schedule.daysPerWeek ? `, ${sections.schedule.daysPerWeek}× per week` : ""}
            {sections.schedule.startDate ? `, starting ${sections.schedule.startDate}` : ""}
            {sections.schedule.preferredTime ? `. Preferred time: ${sections.schedule.preferredTime}` : ""}.
          </p>
        </SectionBlock>
      )}

      {sections.payment?.monthlyAmount && (
        <SectionBlock number="4" title="Payment Terms">
          <p>The Client agrees to pay <strong>${sections.payment.monthlyAmount}</strong> per {sections.payment.billingCycle}
            {sections.payment.pricePerVisit ? ` ($${sections.payment.pricePerVisit} per visit)` : ""}.</p>
          <p className="mt-1">Invoices are issued {sections.payment.billingCycle}, due on the {sections.payment.paymentDueDay}
            {["1","21","31"].includes(sections.payment.paymentDueDay) ? "st" : sections.payment.paymentDueDay === "2" ? "nd" : sections.payment.paymentDueDay === "3" ? "rd" : "th"} of each period.
            Payment method: {sections.payment.paymentMethod?.replace("_", " ")}. Grace period: {sections.payment.gracePeriod} days.</p>
          <p className="mt-1">If payment is not received within {sections.payment.gracePeriod} days, the Client must notify the Service Provider. Failure to do so may result in service suspension.</p>
        </SectionBlock>
      )}

      {sections.contractTerm?.startDate && (
        <SectionBlock number="5" title="Contract Term">
          <p>
            {sections.contractTerm.contractType === "month-to-month" ? "Month-to-month agreement" : "Fixed term contract"},
            commencing {sections.contractTerm.startDate}
            {sections.contractTerm.isOngoing ? ", continuing until terminated by either party" : sections.contractTerm.endDate ? `, expiring ${sections.contractTerm.endDate}` : ""}.
          </p>
        </SectionBlock>
      )}

      <SectionBlock number="6" title="Termination Policy">
        <p>Either party may terminate this agreement by providing <strong>{sections.termination?.noticePeriod || "30"} days'</strong> written notice to the other party.</p>
      </SectionBlock>

      {sections.nonPayment && (
        <SectionBlock number="7" title="Non-Payment & Enforcement">
          <p>{sections.nonPayment}</p>
        </SectionBlock>
      )}

      {sections.confidentiality && (
        <SectionBlock number="8" title="Confidentiality">
          <p>{sections.confidentiality}</p>
        </SectionBlock>
      )}

      {sections.liability && (
        <SectionBlock number="9" title="Liability & Responsibilities">
          <p>{sections.liability}</p>
        </SectionBlock>
      )}

      {sections.acceptance && (
        <SectionBlock number="10" title="Acceptance">
          <p>{sections.acceptance}</p>
        </SectionBlock>
      )}
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
            {agr.sectionsData ? (
              <StructuredAgreementContent sections={agr.sectionsData} agr={agr} business={business} />
            ) : (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{agr.content}</div>
              </div>
            )}
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
