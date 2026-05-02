import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, Save, Send, Copy, ExternalLink, CheckCircle2, Eye,
  FileText, Loader2, Download, AlertCircle, Activity,
  Mail, Mic, MicOff, Wand2, ChevronRight, Sparkles, Users, FileSignature,
  DollarSign, Calendar, ShieldAlert, Lock, HandshakeIcon, ClipboardCheck,
  XCircle, Clock,
} from "lucide-react";
import type { Agreement, AgreementActivityLog } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────
type SectionsData = {
  parties: {
    provider: { companyName: string; address: string; city: string; province: string; postalCode: string; email: string; phone: string };
    client: { companyName: string; address: string; city: string; province: string; postalCode: string; contactPerson: string; email: string; phone: string };
  };
  overview: string;
  scopeOfWork: string;
  schedule: { frequency: string; daysPerWeek: string; startDate: string; preferredTime: string };
  payment: { monthlyAmount: string; pricePerVisit: string; billingCycle: string; paymentDueDay: string; paymentMethod: string; gracePeriod: string };
  contractTerm: { startDate: string; endDate: string; contractType: string; isOngoing: boolean };
  termination: { noticePeriod: string };
  nonPayment: string;
  confidentiality: string;
  liability: string;
  acceptance: string;
};

const DEFAULT_SECTIONS: SectionsData = {
  parties: {
    provider: { companyName: "", address: "", city: "", province: "", postalCode: "", email: "", phone: "" },
    client: { companyName: "", address: "", city: "", province: "", postalCode: "", contactPerson: "", email: "", phone: "" },
  },
  overview: "",
  scopeOfWork: "The Service Provider agrees to perform professional cleaning services including:\n\n• General cleaning of all specified areas\n• Floor cleaning and maintenance\n• Waste disposal\n• Surface sanitization and disinfection",
  schedule: { frequency: "Weekly", daysPerWeek: "2", startDate: "", preferredTime: "8:00 AM – 12:00 PM" },
  payment: { monthlyAmount: "", pricePerVisit: "", billingCycle: "monthly", paymentDueDay: "1", paymentMethod: "bank_transfer", gracePeriod: "3" },
  contractTerm: { startDate: "", endDate: "", contractType: "month-to-month", isOngoing: true },
  termination: { noticePeriod: "30" },
  nonPayment: "If payment is not made and no communication is received within the agreed timeframe, the Service Provider reserves the right to suspend or terminate services immediately without further notice.",
  confidentiality: "Both parties agree to maintain the confidentiality of all sensitive information disclosed during the course of this agreement, including but not limited to pricing, client data, and operational processes.",
  liability: "The Client must provide safe and reasonable access to the service location at the agreed times. The Client must ensure the premises are free from hazards that could affect service delivery. Any damage to property must be reported to the Service Provider within 24 hours of discovery.",
  acceptance: "By signing below, both parties confirm that they have read, understood, and agree to the terms of this agreement. This agreement constitutes the entire understanding between the parties and supersedes all prior discussions.",
};

// ── Section Nav Config ────────────────────────────────────────────────────────
const SECTIONS = [
  { key: "header",          label: "1. Header",          icon: FileText },
  { key: "parties",         label: "2. Parties",         icon: Users },
  { key: "overview",        label: "3. Overview",        icon: FileSignature },
  { key: "scopeOfWork",     label: "4. Scope of Work",   icon: ClipboardCheck },
  { key: "schedule",        label: "5. Schedule",        icon: Calendar },
  { key: "payment",         label: "6. Payment Terms",   icon: DollarSign },
  { key: "contractTerm",    label: "7. Contract Term",   icon: Clock },
  { key: "termination",     label: "8. Termination",     icon: XCircle },
  { key: "nonPayment",      label: "9. Non-Payment",     icon: ShieldAlert },
  { key: "confidentiality", label: "10. Confidentiality",icon: Lock },
  { key: "liability",       label: "11. Liability",      icon: AlertCircle },
  { key: "acceptance",      label: "12. Acceptance",     icon: HandshakeIcon },
  { key: "signatures",      label: "13. Signatures",     icon: CheckCircle2 },
];

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Viewed", signed: "Signed",
  completed: "Completed", declined: "Declined",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  signed: "bg-green-100 text-green-700",
  completed: "bg-teal-100 text-teal-700",
  declined: "bg-red-100 text-red-700",
};
const EVENT_LABELS: Record<string, string> = {
  created: "Agreement created", sent_email: "Sent via email", sent_link: "Link shared",
  viewed: "Viewed by client", signed: "Signed by client", declined: "Declined by client",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDateShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

// ── Voice Button ──────────────────────────────────────────────────────────────
function VoiceButton({ onTranscript, compact }: { onTranscript: (t: string) => void; compact?: boolean }) {
  const [active, setActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser."); return; }
    if (active) { recognitionRef.current?.stop(); setActive(false); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .filter((res: any) => res.isFinal)
        .map((res: any) => res[0].transcript)
        .join(" ");
      if (transcript) onTranscript(transcript);
    };
    r.onend = () => setActive(false);
    r.onerror = () => setActive(false);
    recognitionRef.current = r;
    r.start();
    setActive(true);
  }, [active, onTranscript]);

  return (
    <Button type="button" variant={active ? "destructive" : "outline"} size="sm"
      onClick={toggle} className="gap-1.5 text-xs shrink-0"
      title={active ? "Stop recording" : "Voice input"}
      data-testid="button-voice-input">
      {active ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      {!compact && (active ? "Stop" : "Voice")}
    </Button>
  );
}

// ── AI Improve Button ─────────────────────────────────────────────────────────
function AIImproveMenu({ text, onResult }: { text: string; onResult: (r: string) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const actions = [
    { key: "improve", label: "Improve" },
    { key: "professional", label: "Make Professional" },
    { key: "expand", label: "Expand" },
    { key: "shorten", label: "Shorten" },
  ];

  async function runAI(instruction: string) {
    if (!text.trim()) { toast({ title: "No text to improve", variant: "destructive" }); return; }
    setLoading(instruction);
    try {
      const r = await apiRequest("POST", "/api/admin/agreements/improve-text", { text, instruction }).then(r => r.json());
      onResult(r.result);
      toast({ title: "AI improvement applied." });
    } catch {
      toast({ title: "AI improvement failed", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {actions.map(a => (
        <Button key={a.key} type="button" variant="outline" size="sm" disabled={!!loading}
          onClick={() => runAI(a.key)} className="gap-1 text-xs h-7 px-2"
          data-testid={`button-ai-${a.key}`}>
          {loading === a.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {a.label}
        </Button>
      ))}
    </div>
  );
}

// ── Live Preview ──────────────────────────────────────────────────────────────
function LivePreview({ agr, sections, businessName }: { agr: Agreement; sections: SectionsData; businessName: string }) {
  const dateGenerated = fmtDateShort(agr.createdAt);
  const provider = sections.parties.provider;
  const client = sections.parties.client;
  const providerName = provider.companyName || businessName || "Service Provider";
  const clientName = client.companyName || agr.clientName || "Client";

  const overviewText = sections.overview ||
    `This Service Agreement is entered into as of ${dateGenerated} between ${providerName} ("Service Provider") and ${clientName} ("Client").`;

  return (
    <div className="font-serif text-[11px] text-gray-800 leading-relaxed space-y-4 p-2">
      <div className="border-b pb-3">
        <h1 className="text-base font-bold">{agr.title}</h1>
        <p className="text-[10px] text-gray-500 mt-0.5">Agreement ID: {agr.id?.slice(0,8)} · {dateGenerated}</p>
      </div>

      {(provider.companyName || client.companyName) && (
        <div className="grid grid-cols-2 gap-3 text-[10px]">
          <div>
            <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">Service Provider</p>
            <p className="font-semibold">{provider.companyName || "—"}</p>
            {provider.address && <p>{provider.address}</p>}
            {(provider.city || provider.province) && <p>{[provider.city, provider.province, provider.postalCode].filter(Boolean).join(", ")}</p>}
            {provider.email && <p>{provider.email}</p>}
            {provider.phone && <p>{provider.phone}</p>}
          </div>
          <div>
            <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">Client</p>
            <p className="font-semibold">{client.companyName || "—"}</p>
            {client.contactPerson && <p>{client.contactPerson}</p>}
            {client.address && <p>{client.address}</p>}
            {(client.city || client.province) && <p>{[client.city, client.province, client.postalCode].filter(Boolean).join(", ")}</p>}
            {client.email && <p>{client.email}</p>}
          </div>
        </div>
      )}

      <div>
        <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">1. Agreement Overview</p>
        <p className="text-[10px]">{overviewText}</p>
      </div>

      {sections.scopeOfWork && (
        <div>
          <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">2. Scope of Work</p>
          <p className="whitespace-pre-wrap text-[10px]">{sections.scopeOfWork}</p>
        </div>
      )}

      {(sections.schedule.frequency || sections.schedule.startDate) && (
        <div>
          <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">3. Service Schedule</p>
          <p className="text-[10px]">
            Services will be performed {sections.schedule.frequency}{sections.schedule.daysPerWeek ? `, ${sections.schedule.daysPerWeek}x/week` : ""}{sections.schedule.startDate ? `, starting ${sections.schedule.startDate}` : ""}{sections.schedule.preferredTime ? `, ${sections.schedule.preferredTime}` : ""}.
          </p>
        </div>
      )}

      {sections.payment.monthlyAmount && (
        <div>
          <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">4. Payment Terms</p>
          <p className="text-[10px]">
            Client agrees to pay ${sections.payment.monthlyAmount}/month (${sections.payment.pricePerVisit || "—"}/visit). Billing is {sections.payment.billingCycle}, due on the {sections.payment.paymentDueDay}. Payment method: {sections.payment.paymentMethod?.replace("_", " ")}. Grace period: {sections.payment.gracePeriod} days.
          </p>
        </div>
      )}

      {sections.contractTerm.startDate && (
        <div>
          <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">5. Contract Term</p>
          <p className="text-[10px]">
            {sections.contractTerm.contractType === "month-to-month" ? "Month-to-month agreement" : "Fixed term contract"}, starting {sections.contractTerm.startDate}{sections.contractTerm.isOngoing ? ", ongoing until terminated" : sections.contractTerm.endDate ? `, ending ${sections.contractTerm.endDate}` : ""}.
          </p>
        </div>
      )}

      <div>
        <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">6. Termination</p>
        <p className="text-[10px]">Either party may terminate this agreement with {sections.termination.noticePeriod} days written notice.</p>
      </div>

      {sections.nonPayment && (
        <div>
          <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">7. Non-Payment Enforcement</p>
          <p className="text-[10px]">{sections.nonPayment}</p>
        </div>
      )}

      <div>
        <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">8. Confidentiality</p>
        <p className="text-[10px]">{sections.confidentiality}</p>
      </div>

      <div>
        <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">9. Liability</p>
        <p className="text-[10px]">{sections.liability}</p>
      </div>

      <div>
        <p className="font-bold uppercase text-[9px] text-gray-400 mb-1">10. Acceptance</p>
        <p className="text-[10px]">{sections.acceptance}</p>
      </div>

      <div className="border-t pt-3 mt-4">
        <p className="font-bold uppercase text-[9px] text-gray-400 mb-2">Signatures</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] text-gray-400">Service Provider</p>
            <div className="h-8 border-b border-gray-300 mt-3" />
            <p className="text-[9px] text-gray-400 mt-1">{providerName}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-400">Client</p>
            {agr.signatureImage ? (
              <img src={agr.signatureImage} alt="Client signature" className="h-8 mt-1" />
            ) : (
              <div className="h-8 border-b border-gray-300 mt-3" />
            )}
            <p className="text-[9px] text-gray-400 mt-1">{clientName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PDF Print ─────────────────────────────────────────────────────────────────
function openPrintPreview(agr: Agreement, sections: SectionsData, businessName: string) {
  const provider = sections.parties.provider;
  const client = sections.parties.client;
  const providerName = provider.companyName || businessName;
  const clientName = client.companyName || agr.clientName;
  const dateGenerated = fmtDateShort(agr.createdAt);
  const overviewText = sections.overview ||
    `This Service Agreement is entered into as of ${dateGenerated} between ${providerName} ("Service Provider") and ${clientName} ("Client").`;

  const sect = (num: string, title: string, content: string) =>
    content ? `<div class="section"><h3>${num}. ${title}</h3><p>${content.replace(/\n/g, "<br>")}</p></div>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Clockfield</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 16mm 20mm 20mm 20mm; }
    @page :first { margin-top: 0; }
    body { font-family: Georgia, "Times New Roman", serif; font-size: 11pt; color: #111; line-height: 1.65; padding: 22mm 0 18mm 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 12pt; margin-bottom: 18pt; }
    .header h1 { font-size: 18pt; font-weight: bold; margin-bottom: 4pt; }
    .header .meta { font-size: 9pt; color: #555; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24pt; margin-bottom: 18pt; padding: 12pt; background: #f9f9f9; border: 1px solid #ddd; }
    .party-block h4 { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5pt; color: #666; margin-bottom: 4pt; }
    .party-block p { font-size: 10pt; margin: 1pt 0; }
    .section { margin-bottom: 14pt; page-break-inside: avoid; break-inside: avoid; }
    .section h3 { font-size: 11pt; font-weight: bold; margin-bottom: 4pt; color: #1a1a1a; break-after: avoid; page-break-after: avoid; }
    .section p { font-size: 10pt; }
    .sig-block { margin-top: 30pt; border-top: 2px solid #1a1a1a; padding-top: 20pt; page-break-inside: avoid; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20pt; margin-top: 14pt; }
    .sig-col label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5pt; color: #666; display: block; margin-bottom: 8pt; }
    .sig-line { border-bottom: 1.5px solid #1a1a1a; height: 50pt; margin-bottom: 4pt; }
    .sig-img { max-height: 50pt; border-bottom: 1.5px solid #1a1a1a; display: block; }
    .sig-col .name { font-size: 10pt; font-weight: bold; margin-top: 4pt; }
    .sig-col .date-signed { font-size: 9pt; color: #555; }
    .print-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 5pt 0; display: flex; justify-content: space-between; align-items: center; font-size: 8pt; color: #999; }
    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${agr.title}</h1>
    <div class="meta">
      Date: ${dateGenerated} &nbsp;·&nbsp; Prepared by ${providerName}
    </div>
  </div>

  <div class="parties">
    <div class="party-block">
      <h4>Service Provider</h4>
      <p><strong>${provider.companyName || providerName}</strong></p>
      ${provider.address ? `<p>${provider.address}</p>` : ""}
      ${(provider.city || provider.province) ? `<p>${[provider.city, provider.province, provider.postalCode].filter(Boolean).join(", ")}</p>` : ""}
      ${provider.email ? `<p>${provider.email}</p>` : ""}
      ${provider.phone ? `<p>${provider.phone}</p>` : ""}
    </div>
    <div class="party-block">
      <h4>Client</h4>
      <p><strong>${client.companyName || clientName}</strong></p>
      ${client.contactPerson ? `<p>${client.contactPerson}</p>` : ""}
      ${client.address ? `<p>${client.address}</p>` : ""}
      ${(client.city || client.province) ? `<p>${[client.city, client.province, client.postalCode].filter(Boolean).join(", ")}</p>` : ""}
      ${client.email ? `<p>${client.email}</p>` : ""}
      ${client.phone ? `<p>${client.phone}</p>` : ""}
    </div>
  </div>

  ${sect("1", "Agreement Overview", overviewText)}
  ${sect("2", "Scope of Work", sections.scopeOfWork)}
  ${sections.schedule.frequency ? `<div class="section"><h3>3. Service Schedule</h3><p>Services will be performed ${sections.schedule.frequency}${sections.schedule.daysPerWeek ? `, ${sections.schedule.daysPerWeek}× per week` : ""}${sections.schedule.startDate ? `, starting ${sections.schedule.startDate}` : ""}${sections.schedule.preferredTime ? `. Preferred time: ${sections.schedule.preferredTime}` : ""}.</p></div>` : ""}
  ${sections.payment.monthlyAmount ? `<div class="section"><h3>4. Payment Terms</h3>
    <p>The Client agrees to pay <strong>$${sections.payment.monthlyAmount} per ${sections.payment.billingCycle}</strong>${sections.payment.pricePerVisit ? ` ($${sections.payment.pricePerVisit} per visit)` : ""}.</p>
    <p>Invoices will be issued ${sections.payment.billingCycle}. Payment is due on the <strong>${sections.payment.paymentDueDay}${["1","21","31"].includes(sections.payment.paymentDueDay) ? "st" : sections.payment.paymentDueDay === "2" ? "nd" : sections.payment.paymentDueDay === "3" ? "rd" : "th"}</strong> of each billing period.</p>
    <p>Preferred payment method: ${sections.payment.paymentMethod.replace("_", " ")}. A grace period of ${sections.payment.gracePeriod} days applies.</p>
    <p>If payment is not received within ${sections.payment.gracePeriod} days, the Client must notify the Service Provider. Failure to do so may result in service suspension.</p>
  </div>` : ""}
  ${sections.contractTerm.startDate ? `<div class="section"><h3>5. Contract Term</h3><p>${sections.contractTerm.contractType === "month-to-month" ? "Month-to-month agreement" : "Fixed term contract"}, commencing ${sections.contractTerm.startDate}${sections.contractTerm.isOngoing ? ", continuing on an ongoing basis until terminated by either party" : sections.contractTerm.endDate ? `, expiring ${sections.contractTerm.endDate}` : ""}.</p></div>` : ""}
  <div class="section"><h3>6. Termination Policy</h3><p>Either party may terminate this agreement by providing <strong>${sections.termination.noticePeriod} days'</strong> written notice to the other party.</p></div>
  ${sect("7", "Non-Payment & Enforcement", sections.nonPayment)}
  ${sect("8", "Confidentiality", sections.confidentiality)}
  ${sect("9", "Liability & Responsibilities", sections.liability)}
  ${sect("10", "Acceptance", sections.acceptance)}

  <div class="sig-block">
    <strong style="font-size:12pt">Signatures</strong>
    <p style="font-size:10pt;margin-top:6pt;color:#555">${sections.acceptance}</p>
    <div class="sig-grid">
      <div class="sig-col">
        <label>Service Provider</label>
        ${agr.providerSignature ? `<img class="sig-img" src="${agr.providerSignature}" alt="Provider Signature">` : '<div class="sig-line"></div>'}
        <div class="name">${provider.companyName || providerName}</div>
        ${agr.providerSignedAt ? `<div class="date-signed">Date: ${fmtDateShort(agr.providerSignedAt)}</div>` : '<div class="date-signed">Date: ___________</div>'}
      </div>
      <div class="sig-col">
        <label>Client</label>
        ${agr.signatureImage ? `<img class="sig-img" src="${agr.signatureImage}" alt="Client Signature">` : '<div class="sig-line"></div>'}
        <div class="name">${clientName}</div>
        ${agr.signedAt ? `<div class="date-signed">Date: ${fmtDateShort(agr.signedAt)}</div>` : '<div class="date-signed">Date: ___________</div>'}
      </div>
      ${agr.witnessEnabled ? `<div class="sig-col">
        <label>Witness</label>
        ${agr.witnessSignature ? `<img class="sig-img" src="${agr.witnessSignature}" alt="Witness Signature">` : '<div class="sig-line"></div>'}
        <div class="name">${agr.witnessName || "Witness"}</div>
        ${agr.witnessSignedAt ? `<div class="date-signed">Date: ${fmtDateShort(agr.witnessSignedAt)}</div>` : '<div class="date-signed">Date: ___________</div>'}
      </div>` : ""}
    </div>
  </div>

  <div class="print-footer">
    <span>Clockfield</span>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

// ── Send Email Dialog ─────────────────────────────────────────────────────────
function SendEmailDialog({ agr, open, onClose, publicUrl }: { agr: Agreement; open: boolean; onClose: () => void; publicUrl: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subject, setSubject] = useState(`Agreement for Your Review — ${agr.title}`);
  const [copied, setCopied] = useState(false);

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/agreements/${agr.id}/send-email`, { subject }).then(r => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agreements", agr.id] });
      qc.invalidateQueries({ queryKey: ["/api/admin/agreements", agr.id, "activity"] });
      if (data.success) toast({ title: "Agreement sent successfully." });
      else toast({ title: "Email failed — link generated. Copy and share manually.", variant: "destructive" });
      onClose();
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" /> Send Agreement</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">{agr.clientName || "Client"}</p>
            <p className="text-muted-foreground text-xs">{agr.clientEmail || "No email on file"}</p>
          </div>
          {!agr.clientEmail && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>No client email — copy the link to share manually.</span>
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">Email Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} data-testid="input-email-subject" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Public Link</Label>
            <div className="flex gap-2">
              <Input value={publicUrl} readOnly className="text-xs" data-testid="input-public-url" />
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} data-testid="button-copy-link">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-send-email" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} className="gap-1.5">
            {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Section Editors ───────────────────────────────────────────────────────────
function HeaderSection({ agr, form, setForm, isSigned }: any) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs mb-1 block">Agreement Title</Label>
        <Input data-testid="input-agr-title" value={form.title || ""} disabled={isSigned}
          onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} />
      </div>
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800 space-y-1">
        <p><span className="font-medium">Date Generated:</span> {fmtDateShort(agr.createdAt)}</p>
        <p><span className="font-medium">Agreement ID:</span> <span className="font-mono text-xs">{agr.id}</span></p>
        <p><span className="font-medium">Status:</span> {STATUS_LABELS[agr.status] || agr.status}</p>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Internal Notes (not visible to client)</Label>
        <Textarea data-testid="input-agr-notes" className="min-h-[80px] text-sm" disabled={isSigned}
          value={form.internalNotes || ""}
          onChange={e => setForm((p: any) => ({ ...p, internalNotes: e.target.value }))} />
      </div>
    </div>
  );
}

function PartiesSection({ sections, setSections, isSigned, form, setForm }: any) {
  const p = sections.parties.provider;
  const c = sections.parties.client;
  const setP = (k: string, v: string) => setSections((s: SectionsData) => ({ ...s, parties: { ...s.parties, provider: { ...s.parties.provider, [k]: v } } }));
  const setC = (k: string, v: string) => setSections((s: SectionsData) => ({ ...s, parties: { ...s.parties, client: { ...s.parties.client, [k]: v } } }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Service Provider</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label className="text-xs mb-1 block">Company Name</Label><Input disabled={isSigned} value={p.companyName} onChange={e => setP("companyName", e.target.value)} data-testid="input-provider-company" /></div>
          <div className="col-span-2"><Label className="text-xs mb-1 block">Street Address</Label><Input disabled={isSigned} value={p.address} onChange={e => setP("address", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">City</Label><Input disabled={isSigned} value={p.city} onChange={e => setP("city", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">Province</Label><Input disabled={isSigned} value={p.province} onChange={e => setP("province", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">Postal Code</Label><Input disabled={isSigned} value={p.postalCode} onChange={e => setP("postalCode", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">Email</Label><Input disabled={isSigned} type="email" value={p.email} onChange={e => setP("email", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">Phone</Label><Input disabled={isSigned} value={p.phone} onChange={e => setP("phone", e.target.value)} /></div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Client</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label className="text-xs mb-1 block">Client Company Name</Label><Input disabled={isSigned} value={c.companyName} onChange={e => setC("companyName", e.target.value)} data-testid="input-client-company-name" /></div>
          <div className="col-span-2"><Label className="text-xs mb-1 block">Contact Person</Label><Input disabled={isSigned} value={c.contactPerson} onChange={e => setC("contactPerson", e.target.value)} /></div>
          <div className="col-span-2"><Label className="text-xs mb-1 block">Street Address</Label><Input disabled={isSigned} value={c.address} onChange={e => setC("address", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">City</Label><Input disabled={isSigned} value={c.city} onChange={e => setC("city", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">Province</Label><Input disabled={isSigned} value={c.province} onChange={e => setC("province", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">Postal Code</Label><Input disabled={isSigned} value={c.postalCode} onChange={e => setC("postalCode", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">Email</Label><Input disabled={isSigned} type="email" value={c.email} onChange={e => setC("email", e.target.value)} /></div>
          <div><Label className="text-xs mb-1 block">Phone</Label><Input disabled={isSigned} value={c.phone} onChange={e => setC("phone", e.target.value)} /></div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Client Record Fields</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs mb-1 block">Full Name</Label><Input disabled={isSigned} value={form.clientName || ""} onChange={e => setForm((p: any) => ({ ...p, clientName: e.target.value }))} data-testid="input-client-name" /></div>
          <div><Label className="text-xs mb-1 block">Email</Label><Input disabled={isSigned} type="email" value={form.clientEmail || ""} onChange={e => setForm((p: any) => ({ ...p, clientEmail: e.target.value }))} data-testid="input-client-email" /></div>
          <div><Label className="text-xs mb-1 block">Service Address</Label><Input disabled={isSigned} value={form.serviceAddress || ""} onChange={e => setForm((p: any) => ({ ...p, serviceAddress: e.target.value }))} /></div>
          <div><Label className="text-xs mb-1 block">Phone</Label><Input disabled={isSigned} value={form.clientPhone || ""} onChange={e => setForm((p: any) => ({ ...p, clientPhone: e.target.value }))} /></div>
        </div>
      </div>
    </div>
  );
}

function TextSection({ label, hint, value, onChange, isSigned, testId }: { label: string; hint?: string; value: string; onChange: (v: string) => void; isSigned: boolean; testId?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs mb-1 block">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-2 flex-wrap">
        <VoiceButton onTranscript={t => onChange(value ? value + " " + t : t)} />
        <AIImproveMenu text={value} onResult={onChange} />
      </div>
      <Textarea data-testid={testId} className="min-h-[200px] text-sm" disabled={isSigned}
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ScheduleSection({ sections, setSections, isSigned }: any) {
  const s = sections.schedule;
  const set = (k: string, v: string) => setSections((sec: SectionsData) => ({ ...sec, schedule: { ...sec.schedule, [k]: v } }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs mb-1 block">Frequency</Label>
          <Select disabled={isSigned} value={s.frequency} onValueChange={v => set("frequency", v)}>
            <SelectTrigger data-testid="select-frequency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Daily">Daily</SelectItem>
              <SelectItem value="Weekly">Weekly</SelectItem>
              <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
              <SelectItem value="Monthly">Monthly</SelectItem>
              <SelectItem value="As needed">As needed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs mb-1 block">Days per Week</Label><Input disabled={isSigned} value={s.daysPerWeek} onChange={e => set("daysPerWeek", e.target.value)} placeholder="e.g. 3" /></div>
        <div><Label className="text-xs mb-1 block">Start Date</Label><Input disabled={isSigned} type="date" value={s.startDate} onChange={e => set("startDate", e.target.value)} data-testid="input-schedule-start" /></div>
        <div><Label className="text-xs mb-1 block">Preferred Time Window</Label><Input disabled={isSigned} value={s.preferredTime} onChange={e => set("preferredTime", e.target.value)} placeholder="e.g. 8:00 AM – 12:00 PM" /></div>
      </div>
      {s.frequency && (
        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground text-xs mb-1">Auto-generated clause:</p>
          <p className="text-xs">Services will be performed {s.frequency}{s.daysPerWeek ? `, ${s.daysPerWeek}× per week` : ""}{s.startDate ? `, starting ${s.startDate}` : ""}{s.preferredTime ? `. Preferred time window: ${s.preferredTime}` : ""}.</p>
        </div>
      )}
    </div>
  );
}

function PaymentSection({ sections, setSections, isSigned }: any) {
  const p = sections.payment;
  const set = (k: string, v: string) => setSections((s: SectionsData) => ({ ...s, payment: { ...s.payment, [k]: v } }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs mb-1 block">Monthly Amount ($)</Label><Input disabled={isSigned} value={p.monthlyAmount} onChange={e => set("monthlyAmount", e.target.value)} placeholder="0.00" data-testid="input-monthly-amount" /></div>
        <div><Label className="text-xs mb-1 block">Price Per Visit ($)</Label><Input disabled={isSigned} value={p.pricePerVisit} onChange={e => set("pricePerVisit", e.target.value)} placeholder="0.00" /></div>
        <div><Label className="text-xs mb-1 block">Billing Cycle</Label>
          <Select disabled={isSigned} value={p.billingCycle} onValueChange={v => set("billingCycle", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="per visit">Per Visit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs mb-1 block">Payment Due Day</Label><Input disabled={isSigned} value={p.paymentDueDay} onChange={e => set("paymentDueDay", e.target.value)} placeholder="1" /></div>
        <div><Label className="text-xs mb-1 block">Payment Method</Label>
          <Select disabled={isSigned} value={p.paymentMethod} onValueChange={v => set("paymentMethod", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="e_transfer">e-Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs mb-1 block">Grace Period (days)</Label><Input disabled={isSigned} value={p.gracePeriod} onChange={e => set("gracePeriod", e.target.value)} placeholder="3" /></div>
      </div>
      {p.monthlyAmount && (
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground mb-1">Auto-generated clauses:</p>
          <p>Client agrees to pay <strong>${p.monthlyAmount}</strong> per {p.billingCycle}{p.pricePerVisit ? ` ($${p.pricePerVisit} per visit)` : ""}.</p>
          <p>Invoices issued {p.billingCycle}. Payment due on the {p.paymentDueDay}{p.paymentDueDay === "1" ? "st" : p.paymentDueDay === "2" ? "nd" : p.paymentDueDay === "3" ? "rd" : "th"} of each billing period.</p>
          <p>If payment is not received within {p.gracePeriod} days, the Client must notify the Service Provider. Failure to do so may result in service suspension.</p>
        </div>
      )}
    </div>
  );
}

function ContractTermSection({ sections, setSections, isSigned }: any) {
  const ct = sections.contractTerm;
  const set = (k: string, v: any) => setSections((s: SectionsData) => ({ ...s, contractTerm: { ...s.contractTerm, [k]: v } }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs mb-1 block">Contract Type</Label>
          <Select disabled={isSigned} value={ct.contractType} onValueChange={v => set("contractType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month-to-month">Month-to-Month</SelectItem>
              <SelectItem value="fixed-term">Fixed Term</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Switch id="ct-ongoing" checked={ct.isOngoing} disabled={isSigned} onCheckedChange={v => set("isOngoing", v)} />
          <Label htmlFor="ct-ongoing" className="text-sm">Ongoing (no end date)</Label>
        </div>
        <div><Label className="text-xs mb-1 block">Start Date</Label><Input disabled={isSigned} type="date" value={ct.startDate} onChange={e => set("startDate", e.target.value)} data-testid="input-contract-start" /></div>
        {!ct.isOngoing && <div><Label className="text-xs mb-1 block">End Date</Label><Input disabled={isSigned} type="date" value={ct.endDate} onChange={e => set("endDate", e.target.value)} /></div>}
      </div>
    </div>
  );
}

function TerminationSection({ sections, setSections, isSigned }: any) {
  const t = sections.termination;
  const set = (k: string, v: string) => setSections((s: SectionsData) => ({ ...s, termination: { ...s.termination, [k]: v } }));
  return (
    <div className="space-y-4">
      <div><Label className="text-xs mb-1 block">Notice Period (days)</Label>
        <Input disabled={isSigned} value={t.noticePeriod} onChange={e => set("noticePeriod", e.target.value)} placeholder="30" data-testid="input-notice-period" />
      </div>
      <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Auto-generated clause:</p>
        <p>Either party may terminate this agreement by providing <strong>{t.noticePeriod} days'</strong> written notice to the other party.</p>
      </div>
    </div>
  );
}

function SignaturesSection({ form, setForm, isSigned }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch id="witness-sw" checked={!!(form.witnessEnabled)} disabled={isSigned}
          onCheckedChange={v => setForm((p: any) => ({ ...p, witnessEnabled: v }))} />
        <Label htmlFor="witness-sw" className="text-sm">Require witness signature</Label>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Provider Name (for signature block)</Label>
        <Input disabled={isSigned} value={form.providerName || ""} onChange={e => setForm((p: any) => ({ ...p, providerName: e.target.value }))} placeholder="Your name or company" data-testid="input-provider-name" />
      </div>
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800 space-y-1">
        <p className="font-medium">Signature Status</p>
        <p className="text-xs">Client: {form.signedAt ? `Signed by ${form.signerName} on ${fmtDateShort(form.signedAt)}` : "Not yet signed"}</p>
        {form.witnessEnabled && <p className="text-xs">Witness: {form.witnessSignedAt ? `${form.witnessName} on ${fmtDateShort(form.witnessSignedAt)}` : "Not yet signed"}</p>}
      </div>
      {isSigned && form.signatureImage && (
        <div>
          <Label className="text-xs mb-1 block">Client Signature</Label>
          <img src={form.signatureImage} alt="Signature" className="border rounded-lg max-h-24 bg-white p-2" />
        </div>
      )}
    </div>
  );
}

// ── Main Builder ──────────────────────────────────────────────────────────────
export default function AdminAgreementBuilder() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("header");
  const [showPreview, setShowPreview] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const { data: agr, isLoading } = useQuery<Agreement>({
    queryKey: ["/api/admin/agreements", params.id],
    queryFn: () => apiRequest("GET", `/api/admin/agreements/${params.id}`).then(r => r.json()),
  });
  const { data: activity = [] } = useQuery<AgreementActivityLog[]>({
    queryKey: ["/api/admin/agreements", params.id, "activity"],
    queryFn: () => apiRequest("GET", `/api/admin/agreements/${params.id}/activity`).then(r => r.json()),
  });

  const [form, setForm] = useState<Partial<Agreement>>({});
  const [sections, setSections] = useState<SectionsData>(DEFAULT_SECTIONS);

  useEffect(() => {
    if (agr) {
      setForm({ ...agr });
      if (agr.sectionsData) {
        setSections({ ...DEFAULT_SECTIONS, ...(agr.sectionsData as Partial<SectionsData>) });
      }
    }
  }, [agr]);

  const isSigned = agr?.status === "signed" || agr?.status === "completed";
  const publicUrl = agr ? `${window.location.origin}/public/agreements/${agr.publicToken}` : "";

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/admin/agreements/${params.id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agreements", params.id] });
      toast({ title: "Agreement saved." });
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to save", variant: "destructive" }),
  });

  function handleSave() {
    saveMutation.mutate({ ...form, sectionsData: sections, updatedAt: new Date().toISOString() });
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copied." });
  }

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-64" />
    </div>
  );
  if (!agr) return <div className="p-6 text-center text-muted-foreground">Agreement not found.</div>;

  const businessName = document.title?.split(" – ")?.[0] || "Service Provider";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-2 shrink-0 flex-wrap">
        <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={() => navigate("/admin/publications?tab=agreements")} data-testid="button-back">
          <ChevronLeft className="w-4 h-4" /> Agreements
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">{agr.title}</p>
            <Badge className={`text-xs shrink-0 ${STATUS_COLORS[agr.status] || "bg-gray-100 text-gray-700"}`}>
              {STATUS_LABELS[agr.status] || agr.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{agr.clientName || "No client"} · {fmtDateShort(agr.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 hidden sm:flex" onClick={copyLink} data-testid="button-copy-link">
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setShowActivity(!showActivity)} data-testid="button-view-activity">
            <Activity className="w-3.5 h-3.5" /> {showActivity ? "Editor" : "Activity"}
          </Button>
          {!isSigned && (
            <Button size="sm" className="gap-1.5 h-8" onClick={() => setSendDialogOpen(true)} data-testid="button-send-agreement">
              <Send className="w-3.5 h-3.5" /> Send
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 h-8"
            onClick={() => openPrintPreview(agr, sections, businessName)} data-testid="button-download-pdf">
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          {!isSigned && (
            <Button size="sm" className="gap-1.5 h-8 bg-primary" onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-agreement">
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </Button>
          )}
        </div>
      </div>

      {/* Activity Log overlay */}
      {showActivity ? (
        <div className="flex-1 overflow-auto p-6 max-w-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Activity Log</p>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map(log => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p>{EVENT_LABELS[log.eventType] || log.eventType}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 3-Panel Editor */
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Section Nav */}
          <div className="w-48 shrink-0 border-r overflow-y-auto bg-gray-50/50 hidden md:block">
            <div className="p-2 space-y-0.5">
              {SECTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    data-testid={`nav-section-${s.key}`}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-colors",
                      activeSection === s.key
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
                    )}>
                    <Icon className="w-3 h-3 shrink-0" />
                    <span className="leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile: Section Dropdown */}
          <div className="md:hidden border-b px-4 py-2">
            <Select value={activeSection} onValueChange={setActiveSection}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SECTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Center: Editor */}
          <div className="flex-1 overflow-y-auto p-5">
            {isSigned && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 mb-4">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>This agreement was signed by <strong>{agr.signerName}</strong> on {fmtDate(agr.signedAt)}. It is locked.</span>
              </div>
            )}

            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">{SECTIONS.find(s => s.key === activeSection)?.label}</h2>
            </div>

            {activeSection === "header" && <HeaderSection agr={agr} form={form} setForm={setForm} isSigned={isSigned} />}
            {activeSection === "parties" && <PartiesSection sections={sections} setSections={setSections} isSigned={isSigned} form={form} setForm={setForm} />}
            {activeSection === "overview" && (
              <TextSection
                label="Agreement Overview"
                hint="This paragraph appears at the top of the agreement. Leave blank to auto-generate from party info."
                value={sections.overview}
                onChange={v => setSections(s => ({ ...s, overview: v }))}
                isSigned={isSigned}
                testId="input-section-overview"
              />
            )}
            {activeSection === "scopeOfWork" && (
              <TextSection
                label="Scope of Work"
                hint="Describe the cleaning services, areas included, tasks, and frequency reference."
                value={sections.scopeOfWork}
                onChange={v => setSections(s => ({ ...s, scopeOfWork: v }))}
                isSigned={isSigned}
                testId="input-section-scope"
              />
            )}
            {activeSection === "schedule" && <ScheduleSection sections={sections} setSections={setSections} isSigned={isSigned} />}
            {activeSection === "payment" && <PaymentSection sections={sections} setSections={setSections} isSigned={isSigned} />}
            {activeSection === "contractTerm" && <ContractTermSection sections={sections} setSections={setSections} isSigned={isSigned} />}
            {activeSection === "termination" && <TerminationSection sections={sections} setSections={setSections} isSigned={isSigned} />}
            {activeSection === "nonPayment" && (
              <TextSection
                label="Non-Payment & Enforcement Clause"
                hint="This clause protects your right to suspend or terminate services due to non-payment."
                value={sections.nonPayment}
                onChange={v => setSections(s => ({ ...s, nonPayment: v }))}
                isSigned={isSigned}
                testId="input-section-nonpayment"
              />
            )}
            {activeSection === "confidentiality" && (
              <TextSection
                label="Confidentiality"
                value={sections.confidentiality}
                onChange={v => setSections(s => ({ ...s, confidentiality: v }))}
                isSigned={isSigned}
                testId="input-section-confidentiality"
              />
            )}
            {activeSection === "liability" && (
              <TextSection
                label="Liability & Responsibilities"
                hint="Client obligations, access requirements, damage reporting."
                value={sections.liability}
                onChange={v => setSections(s => ({ ...s, liability: v }))}
                isSigned={isSigned}
                testId="input-section-liability"
              />
            )}
            {activeSection === "acceptance" && (
              <TextSection
                label="Acceptance Statement"
                hint="This statement appears above the signature block."
                value={sections.acceptance}
                onChange={v => setSections(s => ({ ...s, acceptance: v }))}
                isSigned={isSigned}
                testId="input-section-acceptance"
              />
            )}
            {activeSection === "signatures" && <SignaturesSection form={form} setForm={setForm} isSigned={isSigned} />}

            {/* Section nav buttons */}
            <div className="flex justify-between mt-6 pt-4 border-t">
              {SECTIONS.findIndex(s => s.key === activeSection) > 0 ? (
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={() => setActiveSection(SECTIONS[SECTIONS.findIndex(s => s.key === activeSection) - 1].key)}>
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
              ) : <div />}
              {SECTIONS.findIndex(s => s.key === activeSection) < SECTIONS.length - 1 ? (
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={() => setActiveSection(SECTIONS[SECTIONS.findIndex(s => s.key === activeSection) + 1].key)}>
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                !isSigned && (
                  <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5" data-testid="button-save-agreement-bottom">
                    {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Agreement
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="w-72 shrink-0 border-l overflow-y-auto bg-white hidden lg:block">
            <div className="p-3 border-b bg-gray-50 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
            </div>
            <div className="p-3">
              <LivePreview agr={agr} sections={sections} businessName={businessName} />
            </div>
          </div>
        </div>
      )}

      {agr && <SendEmailDialog agr={agr} open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} publicUrl={publicUrl} />}
    </div>
  );
}
