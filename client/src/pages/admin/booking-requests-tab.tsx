import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, List, ChevronLeft, ChevronRight, Plus, Search, Sparkles,
  FileText, Send, CheckCircle, XCircle, Archive, Briefcase, Phone, Mail,
  MapPin, Clock, AlertTriangle, Copy, ExternalLink, User, Building2, Info,
} from "lucide-react";

type BookingRequest = {
  id: string; companyId: string; name: string; companyName?: string; phone: string; email: string;
  bestContactMethod?: string; serviceAddress: string; unitOrSuite?: string; city?: string; province?: string; postalCode?: string;
  serviceType: string; customerType: string; frequency: string; urgency: string;
  preferredDate: string; preferredTime: string; alternateDate?: string; alternateTime?: string;
  siteVisitPreference?: string; siteVisitDate?: string; siteVisitTime?: string; siteVisitContact?: string;
  commercialDetails?: any; residentialDetails?: any; postConstructionDetails?: any; moveInOutDetails?: any;
  uploadedPhotos?: any[]; notes?: string; specialInstructions?: string; areasAttention?: string;
  areasAvoid?: string; healthSafetyConcerns?: string; clientExpectations?: string;
  consentGiven?: boolean; status: string; estimateId?: string; quoteId?: string;
  convertedJobId?: string; createdAt: string; updatedAt?: string;
};

type BookingEstimate = {
  id: string; estimatedHours?: string; suggestedWorkerCount?: number;
  suggestedLowPrice?: string; suggestedHighPrice?: string; recommendedPrice?: string;
  minimumPriceWarning?: boolean; suggestedChecklist?: string[]; suggestedSupplies?: string[];
  aiSummary?: string; adminFinalPrice?: string;
};

type BookingQuote = {
  id: string; quoteNumber: string; title: string; clientName: string; companyName?: string;
  email: string; phone?: string; serviceAddress: string; serviceType: string; customerType?: string;
  scopeOfWork?: string; checklist?: string[]; frequency?: string;
  price: string; taxes?: string; discount?: string; deposit?: string;
  terms?: string; includedItems?: string; excludedItems?: string; internalNotes?: string;
  publicLinkSlug: string; status: string; sentAt?: string; viewedAt?: string;
  acceptedAt?: string; declinedAt?: string; declineReason?: string; expiresAt?: string;
  preferredDate?: string; preferredTime?: string; siteVisitNote?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New Request", color: "bg-blue-100 text-blue-700" },
  needs_review: { label: "Needs Review", color: "bg-yellow-100 text-yellow-800" },
  estimate_generated: { label: "Estimate Generated", color: "bg-purple-100 text-purple-700" },
  quote_draft: { label: "Quote Draft", color: "bg-orange-100 text-orange-700" },
  quote_sent: { label: "Quote Sent", color: "bg-cyan-100 text-cyan-700" },
  client_viewed: { label: "Client Viewed", color: "bg-sky-100 text-sky-700" },
  quote_accepted: { label: "Quote Accepted", color: "bg-green-100 text-green-700" },
  quote_declined: { label: "Quote Declined", color: "bg-red-100 text-red-700" },
  confirmed: { label: "Confirmed", color: "bg-emerald-100 text-emerald-700" },
  converted_to_job: { label: "Converted to Job", color: "bg-teal-100 text-teal-700" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500" },
  archived: { label: "Archived", color: "bg-gray-100 text-gray-400" },
};

const URGENCY_COLOR: Record<string, string> = {
  normal: "bg-gray-100 text-gray-600",
  soon: "bg-yellow-100 text-yellow-700",
  urgent: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const cls = URGENCY_COLOR[urgency?.toLowerCase()] || "bg-gray-100 text-gray-600";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{urgency}</span>;
}

// ── Calendar helpers ──────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Quote Builder Dialog ──────────────────────────────────────────────────────
function QuoteBuilderDialog({
  open, onClose, booking, estimate, existingQuote, companyId,
  onSaved,
}: {
  open: boolean; onClose: () => void; booking: BookingRequest; estimate?: BookingEstimate | null;
  existingQuote?: BookingQuote | null; companyId: string; onSaved: (q: BookingQuote) => void;
}) {
  const { toast } = useToast();
  const price = existingQuote?.price ?? estimate?.adminFinalPrice ?? estimate?.recommendedPrice ?? "";
  const [title, setTitle] = useState(existingQuote?.title || `${booking.serviceType} Quote`);
  const [clientName, setClientName] = useState(existingQuote?.clientName || booking.name);
  const [quoteCompany, setQuoteCompany] = useState(existingQuote?.companyName || booking.companyName || "");
  const [quoteEmail, setQuoteEmail] = useState(existingQuote?.email || booking.email);
  const [quotePhone, setQuotePhone] = useState(existingQuote?.phone || booking.phone);
  const [serviceAddr, setServiceAddr] = useState(existingQuote?.serviceAddress || booking.serviceAddress);
  const [serviceType, setServiceType] = useState(existingQuote?.serviceType || booking.serviceType);
  const [customerType, setCustomerType] = useState(existingQuote?.customerType || booking.customerType);
  const [scopeOfWork, setScopeOfWork] = useState(existingQuote?.scopeOfWork || (Array.isArray(estimate?.suggestedChecklist) ? estimate.suggestedChecklist.join("\n") : ""));
  const [quoteFrequency, setQuoteFrequency] = useState(existingQuote?.frequency || booking.frequency);
  const [quotePrice, setQuotePrice] = useState(price ? String(price) : "");
  const [taxes, setTaxes] = useState(existingQuote?.taxes || "");
  const [discount, setDiscount] = useState(existingQuote?.discount || "");
  const [deposit, setDeposit] = useState(existingQuote?.deposit || "");
  const [terms, setTerms] = useState(existingQuote?.terms || "");
  const [includedItems, setIncludedItems] = useState(existingQuote?.includedItems || "");
  const [excludedItems, setExcludedItems] = useState(existingQuote?.excludedItems || "");
  const [internalNotes, setInternalNotes] = useState(existingQuote?.internalNotes || "");
  const [expiresAt, setExpiresAt] = useState(existingQuote?.expiresAt || "");
  const [siteVisitNote, setSiteVisitNote] = useState(existingQuote?.siteVisitNote || (booking.siteVisitPreference === "yes" ? "A site visit was requested before final pricing." : ""));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!quotePrice || parseFloat(quotePrice) <= 0) throw new Error("Quote needs a client name, email, service address, and price before it can be saved.");
      const body = { title, clientName, companyName: quoteCompany || null, email: quoteEmail, phone: quotePhone || null, serviceAddress: serviceAddr, serviceType, customerType, scopeOfWork: scopeOfWork || null, frequency: quoteFrequency, price: quotePrice, taxes: taxes || null, discount: discount || null, deposit: deposit || null, terms: terms || null, includedItems: includedItems || null, excludedItems: excludedItems || null, internalNotes: internalNotes || null, expiresAt: expiresAt || null, siteVisitNote: siteVisitNote || null, preferredDate: booking.preferredDate, preferredTime: booking.preferredTime };
      if (existingQuote) {
        const res = await apiRequest("PATCH", `/api/booking-requests/${booking.id}/quotes/${existingQuote.id}`, body);
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/booking-requests/${booking.id}/quotes`, body);
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        return res.json();
      }
    },
    onSuccess: (q) => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests", booking.id, "quotes"] });
      toast({ title: existingQuote ? "Quote updated" : "Quote created" });
      onSaved(q);
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingQuote ? "Edit Quote" : "Create Quote"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {estimate?.aiSummary && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
              <span className="font-medium">AI Estimate Summary: </span>{estimate.aiSummary}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5"><Label>Quote Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Client Name *</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Company Name</Label><Input value={quoteCompany} onChange={e => setQuoteCompany(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={quoteEmail} onChange={e => setQuoteEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={quotePhone} onChange={e => setQuotePhone(e.target.value)} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Service Address *</Label><Input value={serviceAddr} onChange={e => setServiceAddr(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Service Type</Label><Input value={serviceType} onChange={e => setServiceType(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Frequency</Label><Input value={quoteFrequency} onChange={e => setQuoteFrequency(e.target.value)} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Scope of Work</Label><Textarea value={scopeOfWork} onChange={e => setScopeOfWork(e.target.value)} rows={3} placeholder="Describe what's included in this quote..." /></div>
            <div className="space-y-1.5"><Label>Price ($) *</Label><Input type="number" min="0" step="0.01" value={quotePrice} onChange={e => setQuotePrice(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Taxes ($)</Label><Input type="number" min="0" step="0.01" value={taxes} onChange={e => setTaxes(e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-1.5"><Label>Discount ($)</Label><Input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-1.5"><Label>Deposit ($)</Label><Input type="number" min="0" step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-1.5"><Label>Expires On</Label><Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Included Services</Label><Textarea value={includedItems} onChange={e => setIncludedItems(e.target.value)} rows={2} placeholder="List what's included..." /></div>
            <div className="col-span-2 space-y-1.5"><Label>Not Included</Label><Textarea value={excludedItems} onChange={e => setExcludedItems(e.target.value)} rows={2} placeholder="List what's excluded..." /></div>
            <div className="col-span-2 space-y-1.5"><Label>Terms & Conditions</Label><Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={2} placeholder="Payment terms, cancellation policy..." /></div>
            {booking.siteVisitPreference === "yes" && (
              <div className="col-span-2 space-y-1.5"><Label>Site Visit Note (shown to client)</Label><Input value={siteVisitNote} onChange={e => setSiteVisitNote(e.target.value)} /></div>
            )}
            <div className="col-span-2 space-y-1.5"><Label className="text-orange-600">Internal Notes (not shown to client)</Label><Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2} placeholder="Private notes for admin..." /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : existingQuote ? "Update Quote" : "Create Quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Booking Detail Drawer ─────────────────────────────────────────────────────
function BookingDetailDrawer({
  booking, onClose, onUpdated,
}: {
  booking: BookingRequest; onClose: () => void; onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [savedQuote, setSavedQuote] = useState<BookingQuote | null>(null);

  const { data: estimate, isLoading: estimateLoading, refetch: refetchEstimate } = useQuery<BookingEstimate | null>({
    queryKey: ["/api/booking-requests", booking.id, "estimate"],
    queryFn: async () => {
      const res = await fetch(`/api/booking-requests/${booking.id}/estimate`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: quotes = [], refetch: refetchQuotes } = useQuery<BookingQuote[]>({
    queryKey: ["/api/booking-requests", booking.id, "quotes"],
    queryFn: async () => {
      const res = await fetch(`/api/booking-requests/${booking.id}/quotes`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeQuote = savedQuote || quotes[0] || null;

  const generateEstimate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/booking-requests/${booking.id}/estimate`, {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      refetchEstimate();
      onUpdated();
      toast({ title: "Estimate generated", description: "AI estimate is ready to review." });
    },
    onError: (e: any) => toast({ title: "Estimate failed", description: e.message, variant: "destructive" }),
  });

  const sendQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/booking-requests/${booking.id}/quotes/${quoteId}/send`, {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: (d) => {
      refetchQuotes();
      onUpdated();
      if (d.warning) toast({ title: "Quote sent (email warning)", description: d.warning });
      else toast({ title: "Quote sent", description: "Client has been emailed the quote link." });
    },
    onError: (e: any) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/booking-requests/${booking.id}`, { status });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => { onUpdated(); toast({ title: "Status updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const confirmBooking = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/booking-requests/${booking.id}/confirm`, {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => { onUpdated(); toast({ title: "Booking confirmed!", description: "The booking has been confirmed." }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyQuoteLink = () => {
    if (!activeQuote) return;
    const url = `${window.location.origin}/public/booking-quote/${activeQuote.publicLinkSlug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Quote link copied!" });
  };

  const com = booking.commercialDetails as any || {};
  const res = booking.residentialDetails as any || {};
  const post = booking.postConstructionDetails as any || {};
  const move = booking.moveInOutDetails as any || {};
  const photos = (booking.uploadedPhotos as any[]) || [];

  // Timeline
  const timeline = [
    { label: "Booking submitted", date: booking.createdAt, done: true },
    { label: "Estimate generated", date: null, done: !!booking.estimateId },
    { label: "Quote created", date: null, done: !!booking.quoteId },
    { label: "Quote sent", date: activeQuote?.sentAt || null, done: !!activeQuote?.sentAt },
    { label: "Client viewed quote", date: activeQuote?.viewedAt || null, done: !!activeQuote?.viewedAt },
    { label: activeQuote?.status === "accepted" ? "Quote accepted" : "Client responded", date: activeQuote?.acceptedAt || activeQuote?.declinedAt || null, done: !!(activeQuote?.acceptedAt || activeQuote?.declinedAt) },
    { label: "Booking confirmed", date: null, done: booking.status === "confirmed" || booking.status === "converted_to_job" },
  ];

  return (
    <>
      <Sheet open onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-lg">{booking.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <StatusBadge status={booking.status} />
                  <UrgencyBadge urgency={booking.urgency} />
                  {booking.serviceType && <span className="text-xs text-gray-500">{booking.serviceType}</span>}
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="px-6 py-5 space-y-6">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pb-4 border-b border-gray-100">
              {!booking.estimateId && (
                <Button data-testid="button-get-estimate" size="sm" variant="outline" onClick={() => generateEstimate.mutate()} disabled={generateEstimate.isPending} className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
                  <Sparkles className="w-3.5 h-3.5" />
                  {generateEstimate.isPending ? "Generating..." : "Get Estimate"}
                </Button>
              )}
              {booking.estimateId && (
                <Button data-testid="button-regenerate-estimate" size="sm" variant="outline" onClick={() => generateEstimate.mutate()} disabled={generateEstimate.isPending} className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
                  <Sparkles className="w-3.5 h-3.5" />
                  Regenerate
                </Button>
              )}
              <Button data-testid="button-create-quote" size="sm" variant="outline" onClick={() => setShowQuoteBuilder(true)} className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                <FileText className="w-3.5 h-3.5" />
                {activeQuote ? "Edit Quote" : "Create Quote"}
              </Button>
              {activeQuote && (activeQuote.status === "draft") && (
                <Button data-testid="button-send-quote" size="sm" onClick={() => sendQuote.mutate(activeQuote.id)} disabled={sendQuote.isPending} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                  <Send className="w-3.5 h-3.5" />
                  {sendQuote.isPending ? "Sending..." : "Send Quote"}
                </Button>
              )}
              {activeQuote && activeQuote.status !== "draft" && (
                <Button size="sm" variant="outline" onClick={copyQuoteLink} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </Button>
              )}
              {["quote_accepted","confirmed"].includes(booking.status) && booking.status !== "confirmed" && (
                <Button data-testid="button-confirm-booking" size="sm" onClick={() => confirmBooking.mutate()} disabled={confirmBooking.isPending} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {confirmBooking.isPending ? "Confirming..." : "Confirm Booking"}
                </Button>
              )}
              <Select value={booking.status} onValueChange={s => updateStatus.mutate(s)}>
                <SelectTrigger className="h-8 w-auto text-xs border-gray-200 gap-1" data-testid="select-booking-status">
                  <span className="text-gray-500">Status:</span><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([v, cfg]) => <SelectItem key={v} value={v}>{cfg.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Contact Info */}
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" /><span className="font-medium">{booking.name}</span>{booking.companyName && <span className="text-gray-500">— {booking.companyName}</span>}</div>
                <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" /><a href={`tel:${booking.phone}`} className="text-blue-600">{booking.phone}</a>{booking.bestContactMethod && <span className="text-gray-400">· prefers {booking.bestContactMethod}</span>}</div>
                <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-gray-400" /><a href={`mailto:${booking.email}`} className="text-blue-600">{booking.email}</a></div>
              </div>
            </section>

            {/* Location */}
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Location</h3>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">{booking.serviceAddress}{booking.unitOrSuite ? ` #${booking.unitOrSuite}` : ""}</p>
                  {(booking.city || booking.province || booking.postalCode) && (
                    <p className="text-gray-500">{[booking.city, booking.province, booking.postalCode].filter(Boolean).join(", ")}</p>
                  )}
                </div>
              </div>
              {(booking.accessInstructions || booking.parkingInstructions || booking.entryInstructions || booking.alarmInstructions) && (
                <div className="mt-3 bg-amber-50 rounded-lg p-3 text-xs space-y-1">
                  {booking.accessInstructions && <p><span className="font-medium">Access:</span> {booking.accessInstructions}</p>}
                  {booking.parkingInstructions && <p><span className="font-medium">Parking:</span> {booking.parkingInstructions}</p>}
                  {booking.entryInstructions && <p><span className="font-medium">Entry:</span> {booking.entryInstructions}</p>}
                  {booking.alarmInstructions && <p><span className="font-medium">Alarm/Key:</span> {booking.alarmInstructions}</p>}
                </div>
              )}
            </section>

            {/* Service Details */}
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Service Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[["Service Type", booking.serviceType],["Customer Type", booking.customerType],["Frequency", booking.frequency],["Urgency", booking.urgency],["Preferred Date", booking.preferredDate],["Preferred Time", booking.preferredTime],booking.alternateDate ? ["Alternate Date", booking.alternateDate] : null,booking.alternateTime ? ["Alternate Time", booking.alternateTime] : null].filter(Boolean).map(([lbl, val]: any) => (
                  <div key={lbl as string}><p className="text-gray-400 text-xs">{lbl}</p><p className="font-medium">{val}</p></div>
                ))}
              </div>
              {booking.siteVisitPreference && booking.siteVisitPreference !== "no" && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 text-xs">
                  <p className="font-medium text-blue-800">Site Visit: {booking.siteVisitPreference === "yes" ? "Requested" : "Not sure"}</p>
                  {booking.siteVisitDate && <p className="text-blue-700 mt-1">{booking.siteVisitDate} {booking.siteVisitTime || ""}</p>}
                  {booking.siteVisitContact && <p className="text-blue-700">Contact: {booking.siteVisitContact}</p>}
                </div>
              )}
            </section>

            {/* Commercial Details */}
            {booking.commercialDetails && Object.keys(com).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Commercial Details</h3>
                <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-1.5">
                  {com.businessType && <p><span className="text-gray-500">Business Type:</span> {com.businessType}</p>}
                  {com.squareFootage && <p><span className="text-gray-500">Square Footage:</span> {com.squareFootage} sq ft</p>}
                  {(com.numOffices || com.numWashrooms || com.numFloors) && (
                    <p><span className="text-gray-500">Layout:</span> {[com.numOffices && `${com.numOffices} offices`, com.numWashrooms && `${com.numWashrooms} washrooms`, com.numFloors && `${com.numFloors} floors`].filter(Boolean).join(" · ")}</p>
                  )}
                  {com.floorTypes?.length > 0 && <p><span className="text-gray-500">Floors:</span> {com.floorTypes.join(", ")}</p>}
                  {com.floorCareNeeds?.length > 0 && <p><span className="text-gray-500">Floor Care:</span> {com.floorCareNeeds.join(", ")}</p>}
                  {com.cleaningTimePreference && <p><span className="text-gray-500">Cleaning Time:</span> {com.cleaningTimePreference}</p>}
                  {com.highTouchDisinfection && com.highTouchDisinfection !== "No" && <p><span className="text-gray-500">Disinfection:</span> {com.highTouchDisinfection}</p>}
                  {com.consumablesNeeded?.length > 0 && com.consumablesNeeded[0] !== "Not needed" && <p><span className="text-gray-500">Restock:</span> {com.consumablesNeeded.join(", ")}</p>}
                </div>
              </section>
            )}

            {/* Residential Details */}
            {booking.residentialDetails && Object.keys(res).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Residential Details</h3>
                <div className="bg-green-50 rounded-lg p-4 text-sm space-y-1.5">
                  {res.homeType && <p><span className="text-gray-500">Home Type:</span> {res.homeType}</p>}
                  {res.numStories && <p><span className="text-gray-500">Stories:</span> {res.numStories}</p>}
                  {(res.numBedrooms || res.numBathrooms) && <p><span className="text-gray-500">Rooms:</span> {[res.numBedrooms && `${res.numBedrooms} bed`, res.numBathrooms && `${res.numBathrooms} bath`].filter(Boolean).join(" · ")}</p>}
                  {res.squareFootage && <p><span className="text-gray-500">Sq Ft:</span> {res.squareFootage}</p>}
                  {res.cleaningType && <p><span className="text-gray-500">Cleaning Type:</span> {res.cleaningType}</p>}
                  {res.hasPets === "Yes" && <p><span className="text-gray-500">Pets:</span> {res.petTypes?.join(", ") || "Yes"}</p>}
                  {res.areasToClean?.length > 0 && <p><span className="text-gray-500">Areas:</span> {res.areasToClean.join(", ")}</p>}
                  {res.specialConditions?.length > 0 && <p><span className="text-gray-500">Conditions:</span> {res.specialConditions.join(", ")}</p>}
                </div>
              </section>
            )}

            {/* Post-Construction Details */}
            {booking.postConstructionDetails && Object.keys(post).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Post-Construction Details</h3>
                <div className="bg-orange-50 rounded-lg p-4 text-sm space-y-1.5">
                  {post.projectType && <p><span className="text-gray-500">Project:</span> {post.projectType}</p>}
                  {post.squareFootage && <p><span className="text-gray-500">Sq Ft:</span> {post.squareFootage}</p>}
                  {post.heavyDustPresent && <p><span className="text-gray-500">Heavy Dust:</span> {post.heavyDustPresent}</p>}
                  {post.debrisRemovalNeeded && <p><span className="text-gray-500">Debris Removal:</span> {post.debrisRemovalNeeded}</p>}
                  {post.completionDeadline && <p><span className="text-gray-500">Deadline:</span> {post.completionDeadline}</p>}
                </div>
              </section>
            )}

            {/* Notes */}
            {(booking.notes || booking.specialInstructions || booking.areasAttention || booking.areasAvoid || booking.healthSafetyConcerns || booking.clientExpectations) && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h3>
                <div className="space-y-2 text-sm">
                  {booking.notes && <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Notes</p><p>{booking.notes}</p></div>}
                  {booking.specialInstructions && <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Special Instructions</p><p>{booking.specialInstructions}</p></div>}
                  {booking.areasAttention && <div className="bg-yellow-50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Areas Needing Attention</p><p>{booking.areasAttention}</p></div>}
                  {booking.areasAvoid && <div className="bg-red-50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Areas to Avoid</p><p>{booking.areasAvoid}</p></div>}
                  {booking.healthSafetyConcerns && <div className="bg-red-50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Health/Safety Concerns</p><p>{booking.healthSafetyConcerns}</p></div>}
                  {booking.clientExpectations && <div className="bg-blue-50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Client Expectations</p><p>{booking.clientExpectations}</p></div>}
                </div>
              </section>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Uploaded Photos / Files</h3>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5 text-xs text-gray-700">
                      {p.name}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Estimate Section */}
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" /> AI Estimate
              </h3>
              {estimateLoading && <p className="text-sm text-gray-400">Loading...</p>}
              {!estimateLoading && !estimate && (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-5 text-center">
                  <p className="text-sm text-gray-500 mb-3">No estimate yet. Click "Get Estimate" to generate one from the booking details.</p>
                  <Button size="sm" variant="outline" onClick={() => generateEstimate.mutate()} disabled={generateEstimate.isPending} className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
                    <Sparkles className="w-3.5 h-3.5" />
                    {generateEstimate.isPending ? "Generating..." : "Get AI Estimate"}
                  </Button>
                </div>
              )}
              {!estimateLoading && estimate && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                  {estimate.aiSummary && <p className="text-sm text-purple-900">{estimate.aiSummary}</p>}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400">Low</p>
                      <p className="text-base font-bold text-gray-800">${parseFloat(estimate.suggestedLowPrice || "0").toFixed(0)}</p>
                    </div>
                    <div className="bg-purple-600 rounded-lg p-3 text-center">
                      <p className="text-xs text-purple-200">Recommended</p>
                      <p className="text-base font-bold text-white">${parseFloat(estimate.recommendedPrice || "0").toFixed(0)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400">High</p>
                      <p className="text-base font-bold text-gray-800">${parseFloat(estimate.suggestedHighPrice || "0").toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-purple-800">
                    {estimate.estimatedHours && <p>⏱ {estimate.estimatedHours} hrs estimated</p>}
                    {estimate.suggestedWorkerCount && <p>👷 {estimate.suggestedWorkerCount} worker{estimate.suggestedWorkerCount > 1 ? "s" : ""} suggested</p>}
                  </div>
                  {estimate.minimumPriceWarning && (
                    <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 rounded-lg p-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Consider minimum pricing — this job may be below minimum threshold.
                    </div>
                  )}
                  {estimate.suggestedChecklist && (estimate.suggestedChecklist as string[]).length > 0 && (
                    <div><p className="text-xs font-medium text-purple-700 mb-1">Suggested Checklist</p>
                      <div className="flex flex-wrap gap-1">{(estimate.suggestedChecklist as string[]).map((i, idx) => <span key={idx} className="bg-white text-purple-700 text-xs px-2 py-0.5 rounded-full border border-purple-200">{i}</span>)}</div>
                    </div>
                  )}
                  {estimate.suggestedSupplies && (estimate.suggestedSupplies as string[]).length > 0 && (
                    <div><p className="text-xs font-medium text-purple-700 mb-1">Suggested Supplies</p>
                      <div className="flex flex-wrap gap-1">{(estimate.suggestedSupplies as string[]).map((s, idx) => <span key={idx} className="bg-white text-purple-700 text-xs px-2 py-0.5 rounded-full border border-purple-200">{s}</span>)}</div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Quote Section */}
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" /> Quote
              </h3>
              {!activeQuote && (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-5 text-center">
                  <p className="text-sm text-gray-500 mb-3">No quote yet. Create one from the booking details{estimate ? " and AI estimate" : ""}.</p>
                  <Button size="sm" variant="outline" onClick={() => setShowQuoteBuilder(true)} className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                    <FileText className="w-3.5 h-3.5" /> Create Quote
                  </Button>
                </div>
              )}
              {activeQuote && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">{activeQuote.title}</p>
                      <p className="text-xs text-blue-600">{activeQuote.quoteNumber}</p>
                    </div>
                    <StatusBadge status={activeQuote.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                    <p>Price: <strong>${parseFloat(activeQuote.price || "0").toFixed(2)}</strong></p>
                    {activeQuote.expiresAt && <p>Expires: {activeQuote.expiresAt}</p>}
                    {activeQuote.sentAt && <p>Sent: {new Date(activeQuote.sentAt).toLocaleDateString()}</p>}
                    {activeQuote.viewedAt && <p>Viewed: {new Date(activeQuote.viewedAt).toLocaleDateString()}</p>}
                    {activeQuote.acceptedAt && <p>Accepted: {new Date(activeQuote.acceptedAt).toLocaleDateString()}</p>}
                    {activeQuote.declinedAt && <p>Declined: {new Date(activeQuote.declinedAt).toLocaleDateString()}{activeQuote.declineReason ? ` (${activeQuote.declineReason})` : ""}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setShowQuoteBuilder(true)} className="text-xs h-7">Edit</Button>
                    {activeQuote.status === "draft" && (
                      <Button data-testid="button-send-quote-drawer" size="sm" onClick={() => sendQuote.mutate(activeQuote.id)} disabled={sendQuote.isPending} className="text-xs h-7 gap-1 bg-blue-600 hover:bg-blue-700">
                        <Send className="w-3 h-3" />{sendQuote.isPending ? "Sending..." : "Send to Client"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={copyQuoteLink} className="text-xs h-7 gap-1">
                      <Copy className="w-3 h-3" /> Copy Link
                    </Button>
                    <a href={`/public/booking-quote/${activeQuote.publicLinkSlug}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1"><ExternalLink className="w-3 h-3" /> Preview</Button>
                    </a>
                  </div>
                </div>
              )}
            </section>

            {/* Timeline */}
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</h3>
              <div className="space-y-2">
                {timeline.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${item.done ? "bg-green-500" : "bg-gray-200"}`}>
                      {item.done ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div>
                      <p className={`text-sm ${item.done ? "text-gray-800 font-medium" : "text-gray-400"}`}>{item.label}</p>
                      {item.date && <p className="text-xs text-gray-400">{new Date(item.date).toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {showQuoteBuilder && (
        <QuoteBuilderDialog
          open={showQuoteBuilder} onClose={() => setShowQuoteBuilder(false)}
          booking={booking} estimate={estimate} existingQuote={activeQuote}
          companyId={booking.companyId}
          onSaved={(q) => { setSavedQuote(q); refetchQuotes(); }}
        />
      )}
    </>
  );
}

// ── Calendar Component ────────────────────────────────────────────────────────
function BookingCalendar({ bookings, onSelect }: { bookings: BookingRequest[]; onSelect: (b: BookingRequest) => void }) {
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, BookingRequest[]> = {};
    bookings.forEach(b => {
      if (!b.preferredDate) return;
      const key = b.preferredDate.substring(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [bookings]);

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const STATUS_DOT: Record<string, string> = {
    new: "bg-blue-500", needs_review: "bg-yellow-500", estimate_generated: "bg-purple-500",
    quote_draft: "bg-orange-500", quote_sent: "bg-cyan-500", client_viewed: "bg-sky-500",
    quote_accepted: "bg-green-500", quote_declined: "bg-red-500",
    confirmed: "bg-emerald-500", converted_to_job: "bg-teal-500",
    cancelled: "bg-gray-400", archived: "bg-gray-300",
  };

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedDate = selectedDay ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}` : null;
  const selectedBookings = selectedDate ? (bookingsByDate[selectedDate] || []) : [];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">{MONTH_NAMES[month]} {year}</h2>
        <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAY_NAMES.map(d => <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="min-h-[72px] bg-gray-50/50 border-b border-r border-gray-100" />;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayBookings = bookingsByDate[dateKey] || [];
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = day === selectedDay;
            return (
              <div
                key={i}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`min-h-[72px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? "bg-blue-600 text-white" : "text-gray-700"}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayBookings.slice(0, 3).map(b => (
                    <button
                      key={b.id}
                      onClick={e => { e.stopPropagation(); onSelect(b); }}
                      className="w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate hover:opacity-80"
                      style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#1d4ed8" }}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STATUS_DOT[b.status] || "bg-gray-400"}`} />
                      {b.name}
                    </button>
                  ))}
                  {dayBookings.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{dayBookings.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day bookings */}
      {selectedDay && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">{MONTH_NAMES[month]} {selectedDay}, {year} — {selectedBookings.length} booking{selectedBookings.length !== 1 ? "s" : ""}</h3>
          </div>
          {selectedBookings.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">No bookings on this date</p>
            : selectedBookings.map(b => (
                <button key={b.id} onClick={() => onSelect(b)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-left">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-500">{b.serviceType} · {b.preferredTime}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <UrgencyBadge urgency={b.urgency} />
                    <StatusBadge status={b.status} />
                  </div>
                </button>
              ))
          }
        </div>
      )}
    </div>
  );
}

// ── Request List ──────────────────────────────────────────────────────────────
function RequestList({ bookings, onSelect }: { bookings: BookingRequest[]; onSelect: (b: BookingRequest) => void }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? bookings.filter(b => b.name.toLowerCase().includes(q) || b.serviceType.toLowerCase().includes(q) || b.email.toLowerCase().includes(q) || b.serviceAddress.toLowerCase().includes(q)) : bookings;
  }, [bookings, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, service, address..." className="pl-9" />
      </div>
      {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No bookings found</p>}
      <div className="space-y-2">
        {filtered.map(b => (
          <button key={b.id} data-testid={`booking-row-${b.id}`} onClick={() => onSelect(b)} className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                  {b.companyName && <span className="text-xs text-gray-500">— {b.companyName}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{b.serviceType} · {b.serviceAddress}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <StatusBadge status={b.status} />
                  <UrgencyBadge urgency={b.urgency} />
                  <span className="text-xs text-gray-400">{b.preferredDate}</span>
                  {b.customerType && <span className="text-xs text-gray-400">{b.customerType}</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 mt-1 shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BookingRequestsTab({ companyId: propCompanyId }: { companyId?: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"calendar"|"requests"|"quotes"|"accepted"|"archived">("calendar");
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);

  const { data: company } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/auth/company"],
    queryFn: async () => {
      const res = await fetch("/api/auth/company", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !propCompanyId,
  });
  const companyId = propCompanyId || company?.id || "";

  const { data: allBookings = [], refetch } = useQuery<BookingRequest[]>({
    queryKey: ["/api/booking-requests"],
    queryFn: async () => {
      const res = await fetch("/api/booking-requests", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const categorized = useMemo(() => {
    return {
      all: allBookings,
      requests: allBookings.filter(b => !["confirmed","converted_to_job","cancelled","archived","quote_accepted"].includes(b.status)),
      quotes: allBookings.filter(b => ["quote_draft","quote_sent","client_viewed","quote_accepted","quote_declined"].includes(b.status)),
      accepted: allBookings.filter(b => ["quote_accepted","confirmed","converted_to_job"].includes(b.status)),
      archived: allBookings.filter(b => ["cancelled","archived"].includes(b.status)),
    };
  }, [allBookings]);

  const tabs = [
    { key: "calendar" as const, label: "Calendar", icon: Calendar, count: null },
    { key: "requests" as const, label: "Requests", icon: List, count: categorized.requests.length },
    { key: "quotes" as const, label: "Quotes", icon: FileText, count: categorized.quotes.length },
    { key: "accepted" as const, label: "Accepted", icon: CheckCircle, count: categorized.accepted.length },
    { key: "archived" as const, label: "Archived", icon: Archive, count: null },
  ];

  const handleUpdated = () => {
    refetch();
    if (selectedBooking) {
      // Refresh selected booking data
      fetch(`/api/booking-requests/${selectedBooking.id}`, { credentials: "include" })
        .then(r => r.json())
        .then(updated => setSelectedBooking(updated))
        .catch(() => {});
    }
  };

  // Get public booking link
  const bookingFormUrl = `${window.location.origin}/public/booking/${companyId}`;

  return (
    <div className="space-y-4">
      {/* Public link banner */}
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-blue-700">Public Booking Form</p>
          <p className="text-xs text-blue-500 truncate">{bookingFormUrl}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-300" onClick={() => { navigator.clipboard.writeText(bookingFormUrl); toast({ title: "Link copied!" }); }}>
            <Copy className="w-3 h-3" /> Copy
          </Button>
          <a href={bookingFormUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-300"><ExternalLink className="w-3 h-3" /> Open</Button>
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "calendar" && (
        <BookingCalendar bookings={categorized.all} onSelect={setSelectedBooking} />
      )}
      {activeTab === "requests" && (
        <RequestList bookings={categorized.requests} onSelect={setSelectedBooking} />
      )}
      {activeTab === "quotes" && (
        <RequestList bookings={categorized.quotes} onSelect={setSelectedBooking} />
      )}
      {activeTab === "accepted" && (
        <RequestList bookings={categorized.accepted} onSelect={setSelectedBooking} />
      )}
      {activeTab === "archived" && (
        <RequestList bookings={categorized.archived} onSelect={setSelectedBooking} />
      )}

      {/* Detail Drawer */}
      {selectedBooking && (
        <BookingDetailDrawer
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
