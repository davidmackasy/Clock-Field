import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle, HelpCircle, Printer, Download } from "lucide-react";
import type {
  Proposal, BusinessSnapshot, ServiceDetails, ScopeSection, IncludedItem, PricingConfig,
} from "@shared/schema";

const REJECTION_REASONS = [
  "Price is too high",
  "Scope does not match what I need",
  "Need more time",
  "Chose another company",
  "Timing does not work",
  "Other",
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

function calcPricing(pricingConfig: PricingConfig) {
  const items = pricingConfig.lineItems ?? [];
  const lineSubtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const effectiveSubtotal = pricingConfig.subtotalOverride != null ? pricingConfig.subtotalOverride : lineSubtotal;
  const taxableAmount = pricingConfig.subtotalOverride != null
    ? effectiveSubtotal
    : items.filter(i => i.taxable).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxRate = Number(pricingConfig.taxConfig?.rate ?? 0);
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = effectiveSubtotal + taxAmount;
  return { lineSubtotal, effectiveSubtotal, taxAmount, total };
}

const BILLING_TYPE_META: Record<string, { label: string; suffix: string }> = {
  per_visit:       { label: "Per Visit Total",  suffix: "/ visit" },
  weekly:          { label: "Weekly Total",      suffix: "/ week" },
  bi_weekly:       { label: "Bi-Weekly Total",   suffix: "/ two weeks" },
  monthly:         { label: "Monthly Total",     suffix: "/ month" },
  every_3_months:  { label: "Quarterly Total",   suffix: "/ quarter" },
  every_6_months:  { label: "6-Month Total",     suffix: "/ 6 months" },
  yearly:          { label: "Annual Total",       suffix: "/ year" },
  full_contract:   { label: "Contract Total",    suffix: "" },
  custom:          { label: "Total",             suffix: "" },
};

function calcContractEstimate(total: number, billingType: string, contractLength: string, daysPerWeek: string): number | null {
  const monthsMap: Record<string, number> = { "3 Months": 3, "6 Months": 6, "12 Months": 12 };
  const months = monthsMap[contractLength];
  if (!months || months <= 1) return null;
  const dpw = parseFloat(daysPerWeek) || 0;
  const visitsPerMonth = dpw * 4.33;
  switch (billingType) {
    case "per_visit":      return visitsPerMonth > 0 ? total * months * visitsPerMonth : null;
    case "weekly":         return total * months * (52 / 12);
    case "bi_weekly":      return total * months * (26 / 12);
    case "monthly":        return total * months;
    case "every_3_months": return total * (months / 3);
    case "every_6_months": return total * (months / 6);
    case "yearly":         return total * (months / 12);
    default:               return null;
  }
}

export default function PublicProposal() {
  const { token } = useParams<{ token: string }>();
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [responded, setResponded] = useState<"accepted" | "rejected" | "thinking" | null>(null);

  // Accept form state
  const [aName, setAName] = useState("");
  const [aEmail, setAEmail] = useState("");
  const [aStartDate, setAStartDate] = useState("");
  const [aNote, setANote] = useState("");
  const [aConfirmed, setAConfirmed] = useState(false);

  // Reject form state
  const [rReason, setRReason] = useState("");
  const [rNote, setRNote] = useState("");
  const [rName, setRName] = useState("");
  const [rEmail, setREmail] = useState("");

  // Thinking form state
  const [tNote, setTNote] = useState("");
  const [tFollowUp, setTFollowUp] = useState("");
  const [tStart, setTStart] = useState("");
  const [tName, setTName] = useState("");
  const [tEmail, setTEmail] = useState("");

  const { data: proposal, isLoading, error } = useQuery<Proposal>({
    queryKey: ["/api/public/proposals", token],
    queryFn: () => fetch(`/api/public/proposals/${token}`).then(async r => {
      if (!r.ok) { const e = await r.json(); throw new Error(e.message || "Not found"); }
      return r.json();
    }),
  });

  // Mark as viewed
  useEffect(() => {
    if (!proposal || proposal.viewedAt) return;
    fetch(`/api/public/proposals/${token}/viewed`, { method: "POST" }).catch(() => {});
  }, [proposal, token]);

  const acceptMutation = useMutation({
    mutationFn: () => fetch(`/api/public/proposals/${token}/accept`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: aName, email: aEmail, preferredStartDate: aStartDate, note: aNote, confirmedCheckbox: aConfirmed }),
    }).then(r => r.json()),
    onSuccess: () => { setAcceptOpen(false); setResponded("accepted"); },
  });

  const rejectMutation = useMutation({
    mutationFn: () => fetch(`/api/public/proposals/${token}/reject`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rName, email: rEmail, rejectionReason: rReason, note: rNote }),
    }).then(r => r.json()),
    onSuccess: () => { setRejectOpen(false); setResponded("rejected"); },
  });

  const thinkingMutation = useMutation({
    mutationFn: () => fetch(`/api/public/proposals/${token}/thinking`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tName, email: tEmail, note: tNote, followUpDate: tFollowUp, preferredStartDate: tStart }),
    }).then(r => r.json()),
    onSuccess: () => { setThinkingOpen(false); setResponded("thinking"); },
  });

  function handlePrint() {
    window.print();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">Loading proposal…</div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md text-center">
          <div className="text-4xl mb-4">📄</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Proposal Not Available</h1>
          <p className="text-gray-500">{(error as Error)?.message || "This proposal link is not available."}</p>
        </div>
      </div>
    );
  }

  // Parse JSON fields
  let snapshot: BusinessSnapshot = { name: "", logoUrl: null, address: null, city: null, province: null, postalCode: null, phone: null, email: null, website: null, brandColor: null };
  let serviceDetails: ServiceDetails = { serviceType: "", frequency: "", daysPerWeek: "", hoursPerVisit: "", numCleaners: "1", preferredTime: "", contractLength: "", proposedStartDate: "" };
  let scopeSections: ScopeSection[] = [];
  let includedItems: IncludedItem[] = [];
  let pricingConfig: PricingConfig = { lineItems: [], taxConfig: { type: "none", rate: 0, label: "No Tax" }, subtotalOverride: null, notes: "" };

  try { snapshot = JSON.parse(proposal.businessSnapshot); } catch {}
  try { serviceDetails = JSON.parse(proposal.serviceDetails); } catch {}
  try { scopeSections = JSON.parse(proposal.scopeSections); } catch {}
  try { includedItems = JSON.parse(proposal.includedItems); } catch {}
  try { pricingConfig = JSON.parse(proposal.pricingConfig); } catch {}

  const { effectiveSubtotal, taxAmount, total } = calcPricing(pricingConfig);

  // Billing period label & suffix
  const billingType = pricingConfig.billingType || "";
  const btMeta = BILLING_TYPE_META[billingType];
  const billingLabel = pricingConfig.billingLabel || btMeta?.label || "Total";
  const billingSuffix = pricingConfig.billingSuffix !== undefined ? pricingConfig.billingSuffix : (btMeta?.suffix ?? "");
  const hasBillingType = !!billingType;

  // Contract estimate
  const contractEstimate = (hasBillingType && serviceDetails.contractLength && serviceDetails.daysPerWeek)
    ? calcContractEstimate(total, billingType, serviceDetails.contractLength, serviceDetails.daysPerWeek)
    : null;
  const brand = snapshot.brandColor || "#1e293b";
  const isExpired = proposal.expiryDate && new Date(proposal.expiryDate) < new Date();
  const isAlreadyAccepted = proposal.status === "accepted";
  const isAlreadyRejected = proposal.status === "rejected";
  const actionsDisabled = !!(isExpired || isAlreadyAccepted || isAlreadyRejected || responded);

  const businessAddress = [snapshot.address, snapshot.city, snapshot.province, snapshot.postalCode].filter(Boolean).join(", ");

  return (
    <>
      {/* Print / PDF global styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .proposal-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; max-width: 100% !important; }
        }
        @page { size: letter; margin: 0.75in; }
      `}</style>

      <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
        {/* Floating action bar */}
        <div className="no-print flex items-center justify-center gap-3 mb-6 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>

        {/* Paper */}
        <div className="proposal-page bg-white max-w-[816px] mx-auto shadow-lg rounded-xl overflow-hidden print:shadow-none print:rounded-none">

          {/* Header band */}
          <div style={{ backgroundColor: brand }} className="px-10 py-8 text-white">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                {snapshot.logoUrl ? (
                  <img src={snapshot.logoUrl} alt={snapshot.name} className="h-12 mb-3 object-contain" />
                ) : (
                  <div className="text-2xl font-bold mb-1">{snapshot.name}</div>
                )}
                <div className="text-sm opacity-80 space-y-0.5">
                  {businessAddress && <div>{businessAddress}</div>}
                  {snapshot.phone && <div>{snapshot.phone}</div>}
                  {snapshot.email && <div>{snapshot.email}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold opacity-20 mb-2">PROPOSAL</div>
                <div className="text-sm space-y-1 opacity-90">
                  <div><span className="opacity-70">Number</span> <strong>{proposal.proposalNumber}</strong></div>
                  <div><span className="opacity-70">Date</span> <strong>{fmtDate(proposal.proposalDate)}</strong></div>
                  <div><span className="opacity-70">Valid Until</span> <strong>{fmtDate(proposal.expiryDate)}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry / status banner */}
          {isExpired && (
            <div className="bg-orange-50 border-b border-orange-200 px-10 py-3 text-sm text-orange-700 font-medium">
              This proposal has expired. Please contact the business for an updated proposal.
            </div>
          )}
          {isAlreadyAccepted && (
            <div className="bg-green-50 border-b border-green-200 px-10 py-3 text-sm text-green-700 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              This proposal has been accepted.
            </div>
          )}
          {isAlreadyRejected && (
            <div className="bg-red-50 border-b border-red-200 px-10 py-3 text-sm text-red-700 font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              This proposal was declined.
            </div>
          )}
          {responded === "accepted" && (
            <div className="bg-green-50 border-b border-green-200 px-10 py-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-1" />
              <p className="font-semibold text-green-800">Proposal Accepted</p>
              <p className="text-sm text-green-700">Thank you. Your proposal has been accepted. The business will contact you to confirm next steps.</p>
            </div>
          )}
          {responded === "rejected" && (
            <div className="bg-gray-50 border-b px-10 py-4 text-center">
              <p className="font-semibold text-gray-700">Thank you for your feedback.</p>
            </div>
          )}
          {responded === "thinking" && (
            <div className="bg-amber-50 border-b border-amber-200 px-10 py-4 text-center">
              <HelpCircle className="w-8 h-8 text-amber-600 mx-auto mb-1" />
              <p className="font-semibold text-amber-800">Got it — we'll follow up soon.</p>
            </div>
          )}

          <div className="px-10 py-8 space-y-8">

            {/* Prepared For */}
            {(proposal.clientName || proposal.clientCompany || proposal.serviceAddress) && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Prepared For</h2>
                <div className="text-sm space-y-0.5">
                  {proposal.clientCompany && <div className="text-lg font-semibold text-gray-900">{proposal.clientCompany}</div>}
                  {proposal.clientName && <div className="text-gray-700">Contact: {proposal.clientName}</div>}
                  {proposal.contactPerson && proposal.contactPerson !== proposal.clientName && (
                    <div className="text-gray-600">{proposal.contactPerson}</div>
                  )}
                  {proposal.clientEmail && <div className="text-gray-600">{proposal.clientEmail}</div>}
                  {proposal.clientPhone && <div className="text-gray-600">{proposal.clientPhone}</div>}
                  {proposal.serviceAddress && <div className="text-gray-600 mt-1">Service Address: {proposal.serviceAddress}</div>}
                </div>
              </section>
            )}

            {/* Service Summary */}
            {(serviceDetails.serviceType || serviceDetails.frequency) && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Service Summary</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  {serviceDetails.serviceType && <div><span className="text-gray-400">Service Type</span><div className="font-medium text-gray-900">{serviceDetails.serviceType}</div></div>}
                  {serviceDetails.frequency && <div><span className="text-gray-400">Frequency</span><div className="font-medium text-gray-900">{serviceDetails.frequency}</div></div>}
                  {serviceDetails.daysPerWeek && <div><span className="text-gray-400">Days per Week</span><div className="font-medium text-gray-900">{serviceDetails.daysPerWeek}</div></div>}
                  {serviceDetails.hoursPerVisit && <div><span className="text-gray-400">Hours per Visit</span><div className="font-medium text-gray-900">{serviceDetails.hoursPerVisit} hours</div></div>}
                  {serviceDetails.numCleaners && serviceDetails.numCleaners !== "1" && <div><span className="text-gray-400">Cleaners</span><div className="font-medium text-gray-900">{serviceDetails.numCleaners}</div></div>}
                  {serviceDetails.preferredTime && <div><span className="text-gray-400">Preferred Time</span><div className="font-medium text-gray-900">{serviceDetails.preferredTime}</div></div>}
                  {serviceDetails.contractLength && <div><span className="text-gray-400">Contract Length</span><div className="font-medium text-gray-900">{serviceDetails.contractLength}</div></div>}
                  {serviceDetails.proposedStartDate && <div><span className="text-gray-400">Proposed Start</span><div className="font-medium text-gray-900">{fmtDate(serviceDetails.proposedStartDate)}</div></div>}
                  {serviceDetails.hoursPerVisit && serviceDetails.numCleaners && serviceDetails.daysPerWeek && (() => {
                    const hpv = parseFloat(serviceDetails.hoursPerVisit) || 0;
                    const nc = parseFloat(serviceDetails.numCleaners) || 1;
                    const dpw = parseFloat(serviceDetails.daysPerWeek) || 0;
                    const monthly = hpv * nc * dpw * 4.33;
                    return monthly > 0 ? (
                      <div className="col-span-2 mt-1 pt-1 border-t">
                        <span className="text-gray-400">Est. Monthly Hours</span>
                        <div className="font-medium text-gray-900">{monthly.toFixed(1)} hours</div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </section>
            )}

            {/* Scope of Work */}
            {scopeSections.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Scope of Work</h2>
                <div className="space-y-4">
                  {scopeSections.map(sec => (
                    <div key={sec.id}>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{sec.title}</h3>
                      {sec.items.length > 0 && (
                        <ul className="space-y-1 ml-1">
                          {sec.items.filter(b => b.text).map(bullet => (
                            <li key={bullet.id} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                              {bullet.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* What's Included */}
            {includedItems.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">What's Included</h2>
                <div className="space-y-1.5">
                  {includedItems.filter(i => i.label).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-700">{item.label}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.status === "included" ? "bg-green-100 text-green-700"
                        : item.status === "extra_cost" ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                      }`}>
                        {item.status === "included" ? "Included"
                          : item.status === "extra_cost" ? "Extra Cost"
                          : "Not Included"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Pricing */}
            {pricingConfig.lineItems.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Pricing</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-500 font-medium">Item</th>
                      <th className="text-center py-2 text-gray-500 font-medium w-16">Qty</th>
                      <th className="text-right py-2 text-gray-500 font-medium w-28">Unit Price</th>
                      <th className="text-right py-2 text-gray-500 font-medium w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingConfig.lineItems.map(item => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                        </td>
                        <td className="text-center py-2 text-gray-700">{item.quantity}</td>
                        <td className="text-right py-2 text-gray-700 tabular-nums">{fmtCurrency(item.unitPrice)}</td>
                        <td className="text-right py-2 text-gray-700 tabular-nums">{fmtCurrency(item.quantity * item.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {pricingConfig.subtotalOverride != null && (
                      <tr>
                        <td colSpan={3} className="text-right py-1.5 text-gray-500 pr-4">Subtotal</td>
                        <td className="text-right py-1.5 tabular-nums text-gray-700">{fmtCurrency(effectiveSubtotal)}</td>
                      </tr>
                    )}
                    {taxAmount > 0 && (
                      <tr>
                        <td colSpan={3} className="text-right py-1.5 text-gray-500 pr-4">{pricingConfig.taxConfig?.label ?? "Tax"}</td>
                        <td className="text-right py-1.5 tabular-nums text-gray-700">{fmtCurrency(taxAmount)}</td>
                      </tr>
                    )}
                    {/* Billing period total — replaces generic "Total" */}
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan={3} className="text-right py-2 pr-4">
                        <span className="font-bold text-gray-900">{billingLabel}</span>
                        {billingSuffix && (
                          <span className="text-gray-400 text-xs font-normal ml-1">{billingSuffix}</span>
                        )}
                      </td>
                      <td className="text-right py-2 font-bold text-gray-900 tabular-nums text-base">{fmtCurrency(total)}</td>
                    </tr>
                    {/* Contract estimate row */}
                    {contractEstimate != null && serviceDetails.contractLength && (
                      <tr className="border-t border-gray-100">
                        <td colSpan={3} className="text-right py-1.5 text-gray-500 pr-4 text-xs">
                          Estimated {serviceDetails.contractLength} Contract Total
                        </td>
                        <td className="text-right py-1.5 tabular-nums text-gray-700 font-semibold">{fmtCurrency(contractEstimate)}</td>
                      </tr>
                    )}
                  </tfoot>
                </table>
                {pricingConfig.notes && (
                  <p className="text-xs text-gray-500 mt-3 leading-relaxed">{pricingConfig.notes}</p>
                )}
              </section>
            )}

            {/* Terms */}
            {proposal.termsText && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Terms & Conditions</h2>
                <div className="text-sm text-gray-600 space-y-1 whitespace-pre-line">{proposal.termsText}</div>
              </section>
            )}
          </div>

          {/* Client action bar */}
          {!actionsDisabled && !responded && (
            <div className="no-print border-t bg-gray-50 px-10 py-6">
              <p className="text-sm text-center text-gray-500 mb-4">Please review the proposal above and let us know how you'd like to proceed.</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-center">
                <Button
                  className="flex-1 sm:flex-none sm:min-w-[160px] bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setAcceptOpen(true)}
                  data-testid="button-accept-proposal"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Accept Proposal
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none sm:min-w-[160px] border-amber-400 text-amber-700 hover:bg-amber-50"
                  onClick={() => setThinkingOpen(true)}
                  data-testid="button-thinking-proposal"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  I'm Thinking About It
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none sm:min-w-[160px] border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setRejectOpen(true)}
                  data-testid="button-reject-proposal"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline Proposal
                </Button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-10 py-4 border-t text-center text-xs text-gray-400">
            Powered by ClockField &bull; {snapshot.name}
          </div>
        </div>

        {/* Bottom print area spacing */}
        <div className="h-12 no-print" />
      </div>

      {/* ── Accept Dialog ─────────────────────────────────────────────── */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accept This Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Your Name</Label>
                <Input value={aName} onChange={e => setAName(e.target.value)} placeholder="Jane Smith" data-testid="input-accept-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Your Email</Label>
                <Input type="email" value={aEmail} onChange={e => setAEmail(e.target.value)} placeholder="jane@example.com" data-testid="input-accept-email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Start Date</Label>
              <Select value={aStartDate} onValueChange={setAStartDate}>
                <SelectTrigger data-testid="select-accept-start"><SelectValue placeholder="When would you like to start?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact_me">Contact me to schedule</SelectItem>
                  <SelectItem value="not_sure">I'm not sure yet</SelectItem>
                  <SelectItem value="specific">Pick a date below</SelectItem>
                </SelectContent>
              </Select>
              {aStartDate === "specific" && (
                <Input type="date" value={aNote.startsWith("date:") ? aNote.replace("date:", "") : ""} onChange={e => setANote(`date:${e.target.value}`)} data-testid="input-accept-start-date" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Optional Note</Label>
              <Textarea value={aStartDate !== "specific" ? aNote : ""} onChange={e => setANote(e.target.value)} rows={2} placeholder="Any questions or comments…" data-testid="textarea-accept-note" />
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                checked={aConfirmed}
                onCheckedChange={v => setAConfirmed(!!v)}
                id="accept-confirm"
                data-testid="checkbox-accept-confirm"
              />
              <label htmlFor="accept-confirm" className="text-sm text-gray-700 leading-snug cursor-pointer">
                I confirm that I have reviewed and accept this proposal.
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => acceptMutation.mutate()}
              disabled={!aConfirmed || acceptMutation.isPending}
              data-testid="button-confirm-accept"
            >
              {acceptMutation.isPending ? "Submitting…" : "Confirm Acceptance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ─────────────────────────────────────────────── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline This Proposal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Can you tell us why you are not accepting this proposal?</p>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={rReason} onValueChange={setRReason}>
                <SelectTrigger data-testid="select-reject-reason"><SelectValue placeholder="Select a reason…" /></SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Additional Note <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Textarea value={rNote} onChange={e => setRNote(e.target.value)} rows={2} placeholder="Any additional feedback…" data-testid="textarea-reject-note" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Your Name <span className="text-gray-400 text-xs">(optional)</span></Label>
                <Input value={rName} onChange={e => setRName(e.target.value)} placeholder="Jane Smith" data-testid="input-reject-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Your Email <span className="text-gray-400 text-xs">(optional)</span></Label>
                <Input type="email" value={rEmail} onChange={e => setREmail(e.target.value)} placeholder="jane@…" data-testid="input-reject-email" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Thinking Dialog ───────────────────────────────────────────── */}
      <Dialog open={thinkingOpen} onOpenChange={setThinkingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>I'm Thinking About It</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">No problem. Would you like us to follow up?</p>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Your Name</Label>
                <Input value={tName} onChange={e => setTName(e.target.value)} placeholder="Jane Smith" data-testid="input-thinking-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Your Email</Label>
                <Input type="email" value={tEmail} onChange={e => setTEmail(e.target.value)} placeholder="jane@…" data-testid="input-thinking-email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Textarea value={tNote} onChange={e => setTNote(e.target.value)} rows={2} placeholder="Anything you'd like us to know…" data-testid="textarea-thinking-note" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preferred Follow-Up Date</Label>
                <Input type="date" value={tFollowUp} onChange={e => setTFollowUp(e.target.value)} data-testid="input-thinking-followup" />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred Start Date</Label>
                <Select value={tStart} onValueChange={setTStart}>
                  <SelectTrigger data-testid="select-thinking-start"><SelectValue placeholder="If known…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_sure">I'm not sure yet</SelectItem>
                    <SelectItem value="contact_me">Contact me to schedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThinkingOpen(false)}>Cancel</Button>
            <Button
              onClick={() => thinkingMutation.mutate()}
              disabled={thinkingMutation.isPending}
              data-testid="button-confirm-thinking"
            >
              {thinkingMutation.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
