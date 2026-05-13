import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, AlertCircle, Building2, MapPin, Calendar, DollarSign, FileText, List } from "lucide-react";

function fmt(amount: string | null | undefined) {
  if (!amount) return "—";
  const n = parseFloat(amount);
  return isNaN(n) ? amount : `$${n.toFixed(2)}`;
}

export default function PublicBookingQuote() {
  const { slug } = useParams<{ slug: string }>();
  const [action, setAction] = useState<"none"|"accept"|"decline">("none");
  const [declineReason, setDeclineReason] = useState("");
  const [done, setDone] = useState<{ type: "accepted"|"declined"; message: string } | null>(null);

  const { data, isLoading, isError } = useQuery<{ quote: any; businessName: string }>({
    queryKey: ["/api/public/booking-quote", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/booking-quote/${slug}`);
      if (!res.ok) throw new Error("Quote not found");
      return res.json();
    },
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/public/booking-quote/${slug}/accept`, {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: (d) => setDone({ type: "accepted", message: d.message }),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/public/booking-quote/${slug}/decline`, { reason: declineReason || null });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: (d) => setDone({ type: "declined", message: d.message }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center"><div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500">Loading quote...</p></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Quote Not Found</h1>
          <p className="text-gray-500 text-sm">This quote link may be invalid or has expired. Please contact us for assistance.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${done.type === "accepted" ? "bg-green-100" : "bg-gray-100"}`}>
            {done.type === "accepted"
              ? <CheckCircle className="w-9 h-9 text-green-600" />
              : <XCircle className="w-9 h-9 text-gray-400" />
            }
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {done.type === "accepted" ? "Quote Accepted!" : "Quote Declined"}
          </h1>
          <p className="text-gray-600 leading-relaxed">{done.message}</p>
        </div>
      </div>
    );
  }

  const { quote, businessName } = data;
  const alreadyActed = ["accepted","declined"].includes(quote.status);

  const total = parseFloat(quote.price || "0")
    + parseFloat(quote.taxes || "0")
    - parseFloat(quote.discount || "0");

  const checklist: string[] = Array.isArray(quote.checklist) ? quote.checklist : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Business Header */}
        <div className="bg-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-blue-100 text-sm">Service Quote from</p>
              <h1 className="text-xl font-bold">{businessName}</h1>
            </div>
          </div>
        </div>

        {/* Quote Summary Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">{quote.quoteNumber}</p>
                <h2 className="text-xl font-bold text-gray-900">{quote.title}</h2>
                <p className="text-gray-600 mt-1">For: <span className="font-medium">{quote.clientName}</span>{quote.companyName ? ` — ${quote.companyName}` : ""}</p>
              </div>
              {quote.status === "accepted" && <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">Accepted</span>}
              {quote.status === "declined" && <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">Declined</span>}
              {!alreadyActed && <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">Awaiting Response</span>}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-gray-700">{quote.serviceType}</p>
                  <p className="text-gray-500">{quote.serviceAddress}</p>
                </div>
              </div>
              {(quote.preferredDate || quote.frequency) && (
                <div className="flex items-start gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-gray-600">
                    {quote.preferredDate && `Starting ${quote.preferredDate}`}
                    {quote.preferredDate && quote.frequency && " · "}
                    {quote.frequency && quote.frequency}
                  </p>
                </div>
              )}
            </div>

            {/* Scope */}
            {quote.scopeOfWork && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700">Scope of Work</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">{quote.scopeOfWork}</p>
              </div>
            )}

            {/* Checklist */}
            {checklist.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <List className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700">Service Checklist</h3>
                </div>
                <ul className="space-y-1.5">
                  {checklist.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Included / Excluded */}
            {(quote.includedItems || quote.excludedItems) && (
              <div className="grid grid-cols-2 gap-4">
                {quote.includedItems && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1.5 uppercase tracking-wide">Included</p>
                    <p className="text-xs text-green-800 whitespace-pre-line">{quote.includedItems}</p>
                  </div>
                )}
                {quote.excludedItems && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1.5 uppercase tracking-wide">Not Included</p>
                    <p className="text-xs text-red-800 whitespace-pre-line">{quote.excludedItems}</p>
                  </div>
                )}
              </div>
            )}

            {/* Pricing */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Pricing</h3>
              </div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Service Price</span><span className="font-medium">{fmt(quote.price)}</span></div>
              {quote.taxes && parseFloat(quote.taxes) > 0 && (
                <div className="flex justify-between text-sm"><span className="text-gray-600">Taxes</span><span>{fmt(quote.taxes)}</span></div>
              )}
              {quote.discount && parseFloat(quote.discount) > 0 && (
                <div className="flex justify-between text-sm"><span className="text-gray-600">Discount</span><span className="text-green-600">-{fmt(quote.discount)}</span></div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-2">
                <span>Total</span>
                <span className="text-blue-600">${total.toFixed(2)}</span>
              </div>
              {quote.deposit && parseFloat(quote.deposit) > 0 && (
                <p className="text-xs text-gray-500">Deposit required: {fmt(quote.deposit)}</p>
              )}
            </div>

            {/* Terms */}
            {quote.terms && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Terms & Conditions</h3>
                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3 whitespace-pre-line">{quote.terms}</p>
              </div>
            )}

            {/* Expiry */}
            {quote.expiresAt && (
              <p className="text-xs text-gray-400 text-center">This quote is valid until {quote.expiresAt}</p>
            )}

            {/* Site visit note */}
            {quote.siteVisitNote && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>Note: </strong>{quote.siteVisitNote}
              </div>
            )}
          </div>
        </div>

        {/* Action Area */}
        {!alreadyActed && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            {action === "none" && (
              <>
                <h3 className="text-base font-semibold text-gray-900 text-center">Ready to respond?</h3>
                <p className="text-sm text-gray-500 text-center">Review the quote above before accepting or declining.</p>
                <div className="flex gap-3">
                  <Button data-testid="button-accept-quote" onClick={() => setAction("accept")} className="flex-1 bg-green-600 hover:bg-green-700 h-11">
                    Accept Quote
                  </Button>
                  <Button data-testid="button-decline-quote" variant="outline" onClick={() => setAction("decline")} className="flex-1 h-11 border-red-200 text-red-600 hover:bg-red-50">
                    Decline
                  </Button>
                </div>
              </>
            )}

            {action === "accept" && (
              <div className="space-y-4">
                <div className="text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <h3 className="text-base font-semibold text-gray-900">Confirm Acceptance</h3>
                  <p className="text-sm text-gray-500 mt-1">By clicking below, you agree to the quoted price and terms above.</p>
                </div>
                {acceptMutation.isError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {(acceptMutation.error as Error)?.message}
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setAction("none")} className="flex-1">Back</Button>
                  <Button data-testid="button-confirm-accept" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
                    {acceptMutation.isPending ? "Processing..." : "Yes, Accept Quote"}
                  </Button>
                </div>
              </div>
            )}

            {action === "decline" && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900">Decline Quote</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Reason for declining (optional)</label>
                  <Select value={declineReason} onValueChange={setDeclineReason}>
                    <SelectTrigger data-testid="select-decline-reason"><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                    <SelectContent>
                      {["Price","Timing","Scope","No longer needed","Other"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {declineMutation.isError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {(declineMutation.error as Error)?.message}
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setAction("none")} className="flex-1">Back</Button>
                  <Button data-testid="button-confirm-decline" onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending} variant="destructive" className="flex-1">
                    {declineMutation.isPending ? "Processing..." : "Decline Quote"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {alreadyActed && (
          <div className={`rounded-2xl border p-5 text-center ${quote.status === "accepted" ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
            <p className="text-sm font-medium text-gray-600">
              {quote.status === "accepted" ? "You have accepted this quote." : "You have declined this quote."}
              {" "}If you have any questions, please contact us.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">Powered by ClockField</p>
      </div>
    </div>
  );
}
